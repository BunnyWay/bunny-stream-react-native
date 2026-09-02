package net.bunny.reactnative.module

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.security.MessageDigest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import net.bunny.api.BunnyStreamApi
import net.bunny.api.StreamApi
import net.bunny.api.error.BunnyError
import net.bunny.api.livestream.domain.model.LiveStreamCreateRequest
import net.bunny.api.livestream.domain.model.RtmpOutput
import net.bunny.api.video.domain.model.CreateVideoRequest
import net.bunny.api.video.domain.model.UpdateVideoRequest
import net.bunny.reactnative.NativeBunnyStreamApiSpec

/**
 * TurboModule implementing the Codegen-generated [NativeBunnyStreamApiSpec].
 *
 * Bridges the Bunny Stream REST API (`net.bunny:api`) to JS. Every method
 * resolves its Promise with a `BunnyResult`-shaped envelope
 * (`{ ok: true, value }` / `{ ok: false, error }`) — never rejects — so the
 * typed error taxonomy (terminal vs transient, Auth vs NotFound vs Network)
 * stays available to the JS caller. See `src/api/BunnyStreamApi.ts`.
 *
 * Reaches the SDK through [BunnyStreamApi.getInstance] — the same instance that
 * [net.bunny.reactnative.module.BunnyStreamPlayerModule.initialize] registered.
 * Methods return an `InvalidState` error when the SDK has not been initialised.
 *
 * Security: this module never logs `accessKey`, tokens, or playback URLs.
 */
@ReactModule(name = BunnyStreamApiModule.NAME)
class BunnyStreamApiModule(reactContext: ReactApplicationContext) :
  NativeBunnyStreamApiSpec(reactContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  private val mappers = BunnyApiMappers

  override fun isInitialized(): Boolean = BunnyStreamApi.isInitialized()

  // region — VideoRepository: reading —

  override fun listVideos(
    libraryId: Double,
    page: Double,
    itemsPerPage: Double,
    search: String?,
    orderBy: String?,
    collectionId: String?,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.videoRepository
        .listVideos(
          libraryId.toLong(),
          page.toInt(),
          itemsPerPage.toInt(),
          search,
          orderBy ?: "date",
          collectionId,
        )
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun getVideo(libraryId: Double, videoId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.videoRepository
        .getVideo(libraryId.toLong(), videoId)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun fetchVideoPlayData(
    libraryId: Double,
    videoId: String,
    token: String?,
    expires: Double?,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.videoRepository
        .fetchVideoPlayData(libraryId.toLong(), videoId, token, expires?.toLong())
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  // endregion

  // region — VideoRepository: creating and changing —

  override fun createVideo(libraryId: Double, request: ReadableMap, promise: Promise) {
    val parsed = parseCreateVideoRequest(request) ?: run {
      promise.resolve(invalidState("createVideo: missing required field 'title'"))
      return
    }
    launchApi(promise) { api ->
      api.videoRepository
        .createVideo(libraryId.toLong(), parsed)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun updateVideo(libraryId: Double, videoId: String, request: ReadableMap, promise: Promise) {
    val parsed = parseUpdateVideoRequest(request)
    launchApi(promise) { api ->
      api.videoRepository
        .updateVideo(libraryId.toLong(), videoId, parsed)
        .let { mappers.run { it.toEnvelope { mappers.unitValue() } } }
    }
  }

  override fun deleteVideo(libraryId: Double, videoId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.videoRepository
        .deleteVideo(libraryId.toLong(), videoId)
        .let { mappers.run { it.toEnvelope { mappers.unitValue() } } }
    }
  }

  // endregion

  // region — LiveStreamRepository: reading —

  override fun listLiveStreams(
    libraryId: Double,
    page: Double?,
    itemsPerPage: Double?,
    search: String?,
    orderBy: String?,
    collectionId: String?,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .listLiveStreams(
          libraryId.toLong(),
          page?.toInt(),
          itemsPerPage?.toInt(),
          search,
          orderBy,
          collectionId,
        )
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun getLiveStream(libraryId: Double, streamId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .getLiveStream(libraryId.toLong(), streamId)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun fetchLiveStreamPlayData(
    libraryId: Double,
    streamId: String,
    token: String?,
    expires: Double?,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .fetchLiveStreamPlayData(libraryId.toLong(), streamId, token, expires?.toLong())
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  // endregion

  // region — LiveStreamRepository: creating and changing —

  override fun createLiveStream(libraryId: Double, request: ReadableMap, promise: Promise) {
    val parsed = parseLiveStreamCreateRequest(request)
    launchApi(promise) { api ->
      api.liveStreamRepository
        .createLiveStream(libraryId.toLong(), parsed)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun updateLiveStream(libraryId: Double, streamId: String, request: ReadableMap, promise: Promise) {
    val parsed = parseLiveStreamCreateRequest(request)
    launchApi(promise) { api ->
      api.liveStreamRepository
        .updateLiveStream(libraryId.toLong(), streamId, parsed)
        .let { mappers.run { it.toEnvelope { mappers.unitValue() } } }
    }
  }

  override fun deleteLiveStream(libraryId: Double, streamId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .deleteLiveStream(libraryId.toLong(), streamId)
        .let { mappers.run { it.toEnvelope { mappers.unitValue() } } }
    }
  }

  // endregion

  // region — Player settings —

  override fun fetchPlayerSettings(
    libraryId: Double,
    videoId: String,
    token: String?,
    expires: Double?,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.fetchPlayerSettings(libraryId.toLong(), videoId, token, expires?.toLong())
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  // endregion

  // region — Token auth —

  override fun generateEmbedToken(tokenAuthKey: String, videoId: String, expires: Double): String {
    val raw = (tokenAuthKey + videoId + expires.toLong()).toByteArray(Charsets.UTF_8)
    val hash = MessageDigest.getInstance("SHA-256").digest(raw)
    return hash.joinToString("") { "%02x".format(it) }
  }

  // endregion

  // region — request parsing —

  /**
   * Parses a JS `CreateVideoRequestInput` into the SDK's [CreateVideoRequest].
   * Returns `null` when the required `title` is missing.
   */
  private fun parseCreateVideoRequest(map: ReadableMap): CreateVideoRequest? {
    val title = if (map.hasKey("title") && !map.isNull("title")) map.getString("title") else null
    val titleSafe = title ?: return null
    val collectionId = if (map.hasKey("collectionId") && !map.isNull("collectionId")) map.getString("collectionId") else null
    val thumbnailTime = if (map.hasKey("thumbnailTime") && !map.isNull("thumbnailTime")) map.getInt("thumbnailTime") else null
    return CreateVideoRequest(title = titleSafe, collectionId = collectionId, thumbnailTime = thumbnailTime)
  }

  /**
   * Parses a JS `UpdateVideoRequestInput` into the SDK's [UpdateVideoRequest].
   * Missing keys map to `null` (leave unchanged).
   */
  private fun parseUpdateVideoRequest(map: ReadableMap): UpdateVideoRequest {
    val title = if (map.hasKey("title") && !map.isNull("title")) map.getString("title") else null
    val collectionId = if (map.hasKey("collectionId") && !map.isNull("collectionId")) map.getString("collectionId") else null
    return UpdateVideoRequest(title = title, collectionId = collectionId)
  }

  /**
   * Parses a JS `LiveStreamCreateRequestInput` into the SDK's
   * [LiveStreamCreateRequest]. Missing keys map to `null` (not sent).
   */
  private fun parseLiveStreamCreateRequest(map: ReadableMap): LiveStreamCreateRequest {
    fun bool(key: String): Boolean? = if (map.hasKey(key) && !map.isNull(key)) map.getBoolean(key) else null
    fun string(key: String): String? =
      if (map.hasKey(key) && !map.isNull(key)) map.getString(key) else null
    fun int(key: String): Int? = if (map.hasKey(key) && !map.isNull(key)) map.getInt(key) else null

    val rtmpOutputs = if (map.hasKey("rtmpOutputs")) {
      map.getArray("rtmpOutputs")?.let { array ->
        List(array.size()) { idx ->
          val item = array.getMap(idx)
          RtmpOutput(
            endpoint = item?.getString("endpoint"),
            streamKey = item?.getString("streamKey"),
          )
        }
      }
    } else {
      null
    }

    return LiveStreamCreateRequest(
      title = string("title"),
      description = string("description"),
      collectionId = string("collectionId"),
      isPublic = bool("isPublic"),
      scheduledStartTime = string("scheduledStartTime"),
      scheduledEndTime = string("scheduledEndTime"),
      dvrEnabled = bool("dvrEnabled"),
      dvrWindowSeconds = int("dvrWindowSeconds"),
      recordVod = bool("recordVod"),
      enableCountdown = bool("enableCountdown"),
      preStreamTrailerVideoId = string("preStreamTrailerVideoId"),
      rtmpOutputs = rtmpOutputs,
    )
  }

  // endregion

  // region — coroutine launch helper —

  /**
   * Launches a suspend block on the IO scope and resolves [promise] with the
   * envelope the block returns. When the SDK is not initialised the block is
   * skipped and an `InvalidState` envelope is resolved instead. Unexpected
   * exceptions are caught and resolved as a `Network` error so the Promise
   * never rejects — the JS contract is "always resolves with BunnyResult".
   */
  private fun launchApi(
    promise: Promise,
    block: suspend (api: StreamApi) -> WritableMap,
  ) {
    if (!BunnyStreamApi.isInitialized()) {
      promise.resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first."))
      return
    }
    scope.launch {
      try {
        val result = withContext(Dispatchers.IO) { block(BunnyStreamApi.getInstance()) }
        promise.resolve(result)
      } catch (t: Throwable) {
        // A Throwable escaping a repository is a bridge/SDK bug, not an API
        // failure — surface it as a Network error (transient, no HTTP status)
        // so the JS caller still gets a typed envelope rather than a rejected
        // Promise.
        promise.resolve(mappers.errEnvelope(BunnyError.Network(t.message ?: t.toString(), t)))
      }
    }
  }

  // endregion

  companion object {
    const val NAME = "BunnyStreamApi"

    /** Builds an `InvalidState` envelope for the not-initialised guard. */
    internal fun invalidState(message: String): WritableMap =
      BunnyApiMappers.errEnvelope(BunnyError.InvalidState(message, isTerminal = true))
  }
}

/**
 * Returns the string for [key] or `null` when the key is absent or the value is
 * null. React Native's [ReadableMap.getString] throws on a missing key, so this
 * guards every optional-string read.
 */
private fun ReadableMap.optString(key: String): String? =
  if (hasKey(key) && !isNull(key)) getString(key) else null
