package net.bunny.reactnative.adapter

import android.net.FakeUri
import androidx.media3.common.PlaybackException
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.HttpDataSource
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import net.bunny.reactnative.state.PlayerErrorCategory

/**
 * Unit tests for [classifyPlaybackError] — the bridge's mirror of the SDK's
 * internal `PlaybackFailureInfo` (not visible outside its module).
 *
 * `InvalidResponseCodeException` is built for real: it is final and its only
 * constructor wants a [DataSpec]. [DataSpec] only stores its `uri`, and
 * `Uri`'s constructor is package-private, so the test uses [FakeUri] — a
 * trivial subclass declared in the `android.net` package under src/test.
 */
class PlaybackErrorClassifierTest {

  @Test
  fun `a 403 anywhere in the cause chain is unavailable`() {
    val error = PlaybackException(
      "Source error",
      httpError(403),
      PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
    )
    val result = classifyPlaybackError(error)
    assertEquals(PlayerErrorCategory.UNAVAILABLE, result.category)
    assertEquals(403, result.httpStatus)
  }

  @Test
  fun `a 403 buried three levels down still counts`() {
    val error = PlaybackException(
      "Source error",
      IOException("d0", IOException("d1", IOException("d2", httpError(403)))),
      PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
    )
    val result = classifyPlaybackError(error)
    assertEquals(PlayerErrorCategory.UNAVAILABLE, result.category)
    assertEquals(403, result.httpStatus)
  }

  @Test
  fun `a DNS sinkhole connection refusal is unavailable`() {
    // Bunny's "Blocked countries" makes the CDN host resolve to loopback —
    // the only trace is a refused connection to 127.0.0.1, no HTTP status.
    val error = PlaybackException(
      "Source error",
      ConnectException("Failed to connect to vz-test.b-cdn.net/127.0.0.1:443"),
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
    )
    val result = classifyPlaybackError(error)
    assertEquals(PlayerErrorCategory.UNAVAILABLE, result.category)
    assertNull(result.httpStatus)
  }

  @Test
  fun `an IPv6 sinkhole is unavailable too`() {
    val error = PlaybackException(
      "Source error",
      ConnectException("Failed to connect to vz-test.b-cdn.net/[::1]:443"),
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
    )
    assertEquals(PlayerErrorCategory.UNAVAILABLE, classifyPlaybackError(error).category)
  }

  @Test
  fun `a refused connection to a real public address is network, not blocked`() {
    val error = PlaybackException(
      "Source error",
      ConnectException("Failed to connect to vz-test.b-cdn.net/185.60.12.34:443"),
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
    )
    val result = classifyPlaybackError(error)
    assertEquals(PlayerErrorCategory.NETWORK, result.category)
    assertNull(result.httpStatus)
  }

  @Test
  fun `a network timeout without a status or sinkhole is network`() {
    val error = PlaybackException(
      "Source error",
      SocketTimeoutException("timeout"),
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
    )
    assertEquals(PlayerErrorCategory.NETWORK, classifyPlaybackError(error).category)
  }

  @Test
  fun `an unresolvable host without a status or sinkhole is network`() {
    val error = PlaybackException(
      "Source error",
      UnknownHostException("vz-test.b-cdn.net"),
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
    )
    assertEquals(PlayerErrorCategory.NETWORK, classifyPlaybackError(error).category)
  }

  @Test
  fun `a non-403 status keeps its httpStatus but is unknown`() {
    val error = PlaybackException(
      "Source error",
      httpError(500),
      PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
    )
    val result = classifyPlaybackError(error)
    assertEquals(PlayerErrorCategory.UNKNOWN, result.category)
    assertEquals(500, result.httpStatus)
  }

  @Test
  fun `a decoder failure is unknown`() {
    val error = PlaybackException(
      "Decoder init failed",
      IllegalStateException("codec"),
      PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
    )
    val result = classifyPlaybackError(error)
    assertEquals(PlayerErrorCategory.UNKNOWN, result.category)
    assertNull(result.httpStatus)
  }

  @Test
  fun `a cyclic cause chain terminates`() {
    val a = RuntimeException("a")
    val b = RuntimeException("b", a)
    a.initCause(b) // a -> b -> a
    val error = PlaybackException("cyclic", a, PlaybackException.ERROR_CODE_UNSPECIFIED)
    val result = classifyPlaybackError(error)
    assertEquals(PlayerErrorCategory.UNKNOWN, result.category)
    assertNull(result.httpStatus)
  }

  private fun httpError(status: Int) = HttpDataSource.InvalidResponseCodeException(
    status,
    "status $status",
    null,
    emptyMap<String, List<String>>(),
    DataSpec(FakeUri("https://vz-test.b-cdn.net/s/playlist.m3u8")),
    byteArrayOf(),
  )
}
