package net.bunny.reactnative.adapter

import androidx.media3.common.PlaybackException
import androidx.media3.datasource.HttpDataSource
import java.net.ConnectException
import java.net.HttpURLConnection
import java.util.Collections
import java.util.IdentityHashMap
import net.bunny.reactnative.state.PlayerErrorCategory

/**
 * Result of classifying a Media3 [PlaybackException] for the RN `onError`
 * contract — a stable [PlayerErrorCategory] plus the HTTP status when the
 * CDN answered one.
 */
internal data class PlaybackErrorClassification(
  val category: String,
  val httpStatus: Int?,
)

/**
 * Maps a Media3 [PlaybackException] to a [PlayerErrorCategory].
 *
 * Mirrors the SDK's internal `PlaybackFailureInfo`, which is not visible
 * outside its module:
 * - A 403 anywhere in the cause chain, or a `ConnectException` aimed at a
 *   loopback/unspecified sinkhole address, means the CDN refused the stream
 *   (geo-blocking, referrer protection or token auth — deliberately not
 *   told apart). Terminal → [PlayerErrorCategory.UNAVAILABLE].
 * - A network-connection error code without either of those is a plain
 *   connectivity loss → [PlayerErrorCategory.NETWORK] (retryable).
 * - Everything else → [PlayerErrorCategory.UNKNOWN].
 */
internal fun classifyPlaybackError(error: PlaybackException): PlaybackErrorClassification {
  var httpStatus: Int? = null
  var sinkhole = false

  val seen = Collections.newSetFromMap(IdentityHashMap<Throwable, Boolean>())
  var current: Throwable? = error
  var depth = 0
  while (current != null && depth < MAX_CAUSE_DEPTH && seen.add(current)) {
    when {
      httpStatus == null && current is HttpDataSource.InvalidResponseCodeException ->
        httpStatus = current.responseCode
      !sinkhole && current is ConnectException ->
        sinkhole = sinkholeAddressIn(current.message) != null
    }
    current = current.cause
    depth++
  }

  val isNetwork =
    error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
      error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT

  val category = when {
    httpStatus == HttpURLConnection.HTTP_FORBIDDEN || sinkhole -> PlayerErrorCategory.UNAVAILABLE
    httpStatus == null && !sinkhole && isNetwork -> PlayerErrorCategory.NETWORK
    else -> PlayerErrorCategory.UNKNOWN
  }
  return PlaybackErrorClassification(category, httpStatus)
}

/**
 * Pulls the connect target out of an OkHttp-style `ConnectException` message.
 * The socket address prints as `host/ip:port` (`host/[::1]:port` or
 * `host/::1:port` for IPv6), so take what follows the last `/`, drop the port
 * and the IPv6 brackets, and keep it only if it is a sinkhole address. A
 * genuine outage fails to resolve at all or times out against a real public
 * address, so the loopback/unspecified literal is the whole discriminator.
 * Same parsing as the SDK's `sinkholeAddressIn`.
 */
private fun sinkholeAddressIn(message: String?): String? {
  val target = message?.substringAfterLast('/', "")?.takeIf { it.isNotEmpty() } ?: return null
  val literal = target.substringBeforeLast(':').removePrefix("[").removeSuffix("]")
  return literal.takeIf { isLoopbackOrUnspecified(it) }
}

private fun isLoopbackOrUnspecified(address: String): Boolean =
  address == "0.0.0.0" || address.startsWith("127.") ||
    address == "::" || address == "::1" ||
    address == "0:0:0:0:0:0:0:0" || address == "0:0:0:0:0:0:0:1"

private const val MAX_CAUSE_DEPTH = 10

/** HTTP statuses the SDK treats as terminal refusals (mirrors `BunnyError.isTerminal`). */
private val TERMINAL_HTTP_STATUSES = setOf(401, 403, 404, 410)

private val ERROR_STATUS_MESSAGE = Regex("^Error: (\\d{3})$")

/**
 * Classifies a failure reported through the SDK's `onPlaybackError` callback —
 * the `/play` and player-settings fetches, which fail before Media3 exists.
 * The only signal crossing that callback is the `BunnyError` message string,
 * so this matches the stable `BunnyErrorMapper` vocabulary of the pinned SDK
 * version rather than guessing at arbitrary text:
 * - `"Forbidden"`, `"Not Found"`, `"Authorization required Unauthorized"` and
 *   `"Error: 410"` carry the terminal statuses 401/403/404/410 →
 *   [PlayerErrorCategory.UNAVAILABLE].
 * - `"Error: <status>"` keeps its status but stays [PlayerErrorCategory.UNKNOWN]
 *   — a 5xx is transient, not a refusal.
 * - `"Network error: …"` is a transport failure → [PlayerErrorCategory.NETWORK].
 * - Anything else → [PlayerErrorCategory.UNKNOWN].
 */
internal fun classifyPrePlaybackError(message: String): PlaybackErrorClassification {
  val httpStatus = when {
    message == "Forbidden" -> HttpURLConnection.HTTP_FORBIDDEN
    message == "Not Found" -> HttpURLConnection.HTTP_NOT_FOUND
    message == "Authorization required Unauthorized" -> HttpURLConnection.HTTP_UNAUTHORIZED
    else -> ERROR_STATUS_MESSAGE.matchEntire(message)?.groupValues?.get(1)?.toIntOrNull()
  }
  val category = when {
    message.startsWith("Network error:") -> PlayerErrorCategory.NETWORK
    httpStatus != null && httpStatus in TERMINAL_HTTP_STATUSES -> PlayerErrorCategory.UNAVAILABLE
    else -> PlayerErrorCategory.UNKNOWN
  }
  return PlaybackErrorClassification(category, httpStatus)
}
