package net.bunny.reactnative.module

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
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
import net.bunny.api.video.domain.model.AddCaptionRequest
import net.bunny.api.video.domain.model.CreateVideoRequest
import net.bunny.api.video.domain.model.FetchVideoRequest
import net.bunny.api.video.domain.model.SmartGenerateRequest
import net.bunny.api.video.domain.model.TranscribeVideoRequest
import net.bunny.api.video.domain.model.UpdateVideoRequest
import net.bunny.api.video.domain.model.VideoCodec
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

  override fun fetchVideoHeatmap(libraryId: Double, videoId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.videoRepository
        .fetchVideoHeatmap(libraryId.toLong(), videoId)
        .let { mappers.run { it.toEnvelope { heatmap -> heatmapToWritableMap(heatmap) } } }
    }
  }

  override fun fetchVideoStatistics(
    libraryId: Double,
    videoId: String?,
    dateFrom: String?,
    dateTo: String?,
    hourly: Boolean,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.videoRepository
        .fetchVideoStatistics(libraryId.toLong(), videoId, dateFrom, dateTo, hourly)
        .let { mappers.run { it.toEnvelope { statistics -> statistics.toWritableMap() } } }
    }
  }

  override fun fetchVideoResolutions(libraryId: Double, videoId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.videoRepository
        .fetchVideoResolutions(libraryId.toLong(), videoId)
        .let { mappers.run { it.toEnvelope { resolutions -> resolutions.toWritableMap() } } }
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
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun deleteVideo(libraryId: Double, videoId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.videoRepository
        .deleteVideo(libraryId.toLong(), videoId)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  // endregion

  // region — VideoRepository: thumbnails and import —

  override fun setThumbnail(
    libraryId: Double,
    videoId: String,
    thumbnailUrl: String,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.videoRepository
        .setThumbnail(libraryId.toLong(), videoId, thumbnailUrl)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun uploadThumbnail(
    libraryId: Double,
    videoId: String,
    uri: String,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      // The Android SDK's VideoRepository.uploadThumbnail accepts a File, not
      // a ByteArray. Copy the URI content to a temp file, upload, then delete.
      val tempFile = try {
        copyUriToTempFile(uri)
      } catch (t: Throwable) {
        return@launchApi mappers.errEnvelope(
          BunnyError.LocalFile(t.message ?: "Unable to read thumbnail URI", t),
        )
      }

      val result = api.videoRepository
        .uploadThumbnail(libraryId.toLong(), videoId, tempFile)

      tempFile.delete()
      mappers.run { result.toUnitEnvelope() }
    }
  }

  override fun fetchNewVideo(libraryId: Double, request: ReadableMap, promise: Promise) {
    val parsed = parseFetchVideoRequest(request) ?: run {
      promise.resolve(invalidState("fetchNewVideo: missing required field 'url'"))
      return
    }
    val collectionId = if (request.hasKey("collectionId") && !request.isNull("collectionId")) request.getString("collectionId") else null
    val thumbnailTime = if (request.hasKey("thumbnailTime") && !request.isNull("thumbnailTime")) request.getInt("thumbnailTime") else null
    launchApi(promise) { api ->
      api.videoRepository
        .fetchNewVideo(libraryId.toLong(), parsed, collectionId, thumbnailTime)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun refetchVideo(libraryId: Double, videoId: String, request: ReadableMap, promise: Promise) {
    val parsed = parseFetchVideoRequest(request) ?: run {
      promise.resolve(invalidState("refetchVideo: missing required field 'url'"))
      return
    }
    val collectionId = if (request.hasKey("collectionId") && !request.isNull("collectionId")) request.getString("collectionId") else null
    val thumbnailTime = if (request.hasKey("thumbnailTime") && !request.isNull("thumbnailTime")) request.getInt("thumbnailTime") else null
    val enabledResolutions = if (request.hasKey("enabledResolutions") && !request.isNull("enabledResolutions")) {
      request.getArray("enabledResolutions")?.let { array ->
        List(array.size()) { idx -> array.getString(idx) }.filterNotNull()
      }
    } else null
    val lowPriority = if (request.hasKey("lowPriority") && !request.isNull("lowPriority")) request.getBoolean("lowPriority") else false
    launchApi(promise) { api ->
      api.videoRepository
        .refetchVideo(libraryId.toLong(), videoId, parsed, collectionId, enabledResolutions, lowPriority, thumbnailTime)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  // endregion

  // region — VideoRepository: captions —

  override fun addCaption(libraryId: Double, videoId: String, request: ReadableMap, promise: Promise) {
    val parsed = parseAddCaptionRequest(request) ?: run {
      promise.resolve(invalidState("addCaption: missing required fields 'languageCode', 'label', 'captionsFileBase64'"))
      return
    }
    launchApi(promise) { api ->
      api.videoRepository
        .addCaption(libraryId.toLong(), videoId, parsed)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun deleteCaption(libraryId: Double, videoId: String, languageCode: String, promise: Promise) {
    launchApi(promise) { api ->
      api.videoRepository
        .deleteCaption(libraryId.toLong(), videoId, languageCode)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  // endregion

  // region — VideoRepository: encoding / storage —

  override fun reencodeVideo(libraryId: Double, videoId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.videoRepository
        .reencodeVideo(libraryId.toLong(), videoId)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun reencodeUsingCodec(libraryId: Double, videoId: String, codec: String, promise: Promise) {
    val parsedCodec = parseVideoCodec(codec) ?: run {
      promise.resolve(invalidState("reencodeUsingCodec: unknown codec '$codec'. Expected: h264, vp9, hevc, av1."))
      return
    }
    launchApi(promise) { api ->
      api.videoRepository
        .reencodeUsingCodec(libraryId.toLong(), videoId, parsedCodec)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun repackageVideo(libraryId: Double, videoId: String, keepOriginalFiles: Boolean, promise: Promise) {
    launchApi(promise) { api ->
      api.videoRepository
        .repackageVideo(libraryId.toLong(), videoId, keepOriginalFiles)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun deleteResolutions(libraryId: Double, videoId: String, options: ReadableMap, promise: Promise) {
    val resolutions = if (options.hasKey("resolutions") && !options.isNull("resolutions")) {
      options.getArray("resolutions")?.let { array ->
        List(array.size()) { idx -> array.getString(idx) }.filterNotNull()
      } ?: emptyList()
    } else emptyList()

    val deleteNonConfigured = optBool(options, "deleteNonConfiguredResolutions", false)
    val deleteMp4Files = optBool(options, "deleteMp4Files", false)
    val deleteOriginal = optBool(options, "deleteOriginal", false)
    val deleteAll = optBool(options, "deleteAllResolutions", false)
    val dryRun = optBool(options, "dryRun", false)

    launchApi(promise) { api ->
      api.videoRepository
        .deleteResolutions(
          libraryId.toLong(), videoId, resolutions,
          deleteNonConfigured, deleteMp4Files, deleteOriginal, deleteAll, dryRun,
        )
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  // endregion

  // region — VideoRepository: AI —

  override fun smartGenerate(libraryId: Double, videoId: String, request: ReadableMap, promise: Promise) {
    val parsed = parseSmartGenerateRequest(request)
    launchApi(promise) { api ->
      api.videoRepository
        .smartGenerate(libraryId.toLong(), videoId, parsed)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun transcribeVideo(libraryId: Double, videoId: String, request: ReadableMap, promise: Promise) {
    val innerRequest = if (request.hasKey("request") && !request.isNull("request")) {
      request.getMap("request")
    } else null
    val parsed = if (innerRequest != null) {
      parseTranscribeVideoRequest(innerRequest)
    } else {
      TranscribeVideoRequest()
    }
    val force = optBool(request, "force", false)
    launchApi(promise) { api ->
      api.videoRepository
        .transcribeVideo(libraryId.toLong(), videoId, parsed, force)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  // endregion

  // region — CollectionRepository —

  override fun listCollections(
    libraryId: Double,
    page: Double,
    itemsPerPage: Double,
    search: String?,
    orderBy: String,
    includeThumbnails: Boolean,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.collectionRepository
        .listCollections(
          libraryId.toLong(),
          page.toInt(),
          itemsPerPage.toInt(),
          search,
          orderBy,
          includeThumbnails,
        )
        .let { mappers.run { it.toEnvelope { collections -> collections.toWritableMap() } } }
    }
  }

  override fun getCollection(
    libraryId: Double,
    collectionId: String,
    includeThumbnails: Boolean,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.collectionRepository
        .getCollection(libraryId.toLong(), collectionId, includeThumbnails)
        .let { mappers.run { it.toEnvelope { collection -> collection.toWritableMap() } } }
    }
  }

  override fun createCollection(libraryId: Double, name: String, promise: Promise) {
    if (name.isBlank()) {
      promise.resolve(invalidState("createCollection: 'name' must not be blank"))
      return
    }
    launchApi(promise) { api ->
      api.collectionRepository
        .createCollection(libraryId.toLong(), name)
        .let { mappers.run { it.toEnvelope { collection -> collection.toWritableMap() } } }
    }
  }

  override fun updateCollection(libraryId: Double, collectionId: String, name: String, promise: Promise) {
    if (name.isBlank()) {
      promise.resolve(invalidState("updateCollection: 'name' must not be blank"))
      return
    }
    launchApi(promise) { api ->
      api.collectionRepository
        .updateCollection(libraryId.toLong(), collectionId, name)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun deleteCollection(libraryId: Double, collectionId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.collectionRepository
        .deleteCollection(libraryId.toLong(), collectionId)
        .let { mappers.run { it.toUnitEnvelope() } }
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
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun deleteLiveStream(libraryId: Double, streamId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .deleteLiveStream(libraryId.toLong(), streamId)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun startLiveStream(libraryId: Double, streamId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .startLiveStream(libraryId.toLong(), streamId)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun stopLiveStream(libraryId: Double, streamId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .stopLiveStream(libraryId.toLong(), streamId)
        .let { mappers.run { it.toEnvelope { v -> v.toWritableMap() } } }
    }
  }

  override fun getLiveStreamStatus(libraryId: Double, streamId: String, promise: Promise) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .getLiveStreamStatus(libraryId.toLong(), streamId)
        .let { mappers.run { it.toEnvelope { status -> status.toWritableMap() } } }
    }
  }

  override fun setLiveStreamThumbnail(
    libraryId: Double,
    streamId: String,
    thumbnailUrl: String,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .setLiveStreamThumbnail(libraryId.toLong(), streamId, thumbnailUrl)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun uploadLiveStreamThumbnail(
    libraryId: Double,
    streamId: String,
    uri: String,
    contentType: String,
    promise: Promise,
  ) {
    thumbnailUploadValidationError(uri, contentType)?.let { message ->
      promise.resolve(invalidState(message))
      return
    }

    launchApi(promise) { api ->
      val imageBytes = try {
        val schemeSeparator = uri.indexOf(':')
        val parsedUri = Uri.parse(uri.replaceRange(0, schemeSeparator, uri.substring(0, schemeSeparator).lowercase()))
        reactApplicationContext.contentResolver.openInputStream(parsedUri)?.use { input ->
          readThumbnailBytes(input)
        } ?: return@launchApi mappers.errEnvelope(
          BunnyError.LocalFile("Unable to open live stream thumbnail URI"),
        )
      } catch (t: Throwable) {
        return@launchApi mappers.errEnvelope(
          BunnyError.LocalFile(t.message ?: "Unable to read live stream thumbnail URI", t),
        )
      }

      if (imageBytes.isEmpty()) {
        return@launchApi mappers.errEnvelope(
          BunnyError.LocalFile("Live stream thumbnail file is empty"),
        )
      }

      api.liveStreamRepository
        .uploadLiveStreamThumbnail(libraryId.toLong(), streamId, imageBytes, contentType)
        .let { mappers.run { it.toUnitEnvelope() } }
    }
  }

  override fun listLiveStreamThumbnails(
    libraryId: Double,
    streamId: String,
    limit: Double?,
    from: String?,
    to: String?,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .listLiveStreamThumbnails(libraryId.toLong(), streamId, limit?.toInt(), from, to)
        .let {
          mappers.run {
            it.toArrayEnvelope { thumbnails -> liveStreamThumbnailsToWritableArray(thumbnails) }
          }
        }
    }
  }

  override fun deleteLiveStreamThumbnail(
    libraryId: Double,
    streamId: String,
    restoreLibraryDefault: Boolean,
    promise: Promise,
  ) {
    launchApi(promise) { api ->
      api.liveStreamRepository
        .deleteLiveStreamThumbnail(libraryId.toLong(), streamId, restoreLibraryDefault)
        .let { mappers.run { it.toUnitEnvelope() } }
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

  /**
   * Parses a JS `FetchVideoRequestInput` into the SDK's [FetchVideoRequest].
   * Returns `null` when the required `url` is missing.
   */
  private fun parseFetchVideoRequest(map: ReadableMap): FetchVideoRequest? {
    val url = if (map.hasKey("url") && !map.isNull("url")) map.getString("url") else null
    val urlSafe = url ?: return null
    val title = if (map.hasKey("title") && !map.isNull("title")) map.getString("title") else null
    val headers = if (map.hasKey("headers") && !map.isNull("headers")) {
      map.getMap("headers")?.let { headersMap ->
        val result = mutableMapOf<String, String>()
        val iterator = headersMap.keySetIterator()
        while (iterator.hasNextKey()) {
          val key = iterator.nextKey()
          headersMap.getString(key)?.let { value -> result[key] = value }
        }
        result
      }
    } else null
    return FetchVideoRequest(url = urlSafe, headers = headers, title = title)
  }

  /**
   * Copies the content of a file/content URI to a temporary file and returns
   * it. The caller is responsible for deleting the temp file after use.
   */
  private fun copyUriToTempFile(uri: String): File {
    val parsedUri = Uri.parse(uri)
    val tempFile = File.createTempFile("bunny_thumbnail_", ".tmp", reactApplicationContext.cacheDir)
    reactApplicationContext.contentResolver.openInputStream(parsedUri)?.use { input ->
      tempFile.outputStream().use { output -> input.copyTo(output) }
    } ?: throw java.io.IOException("Unable to open thumbnail URI: $uri")
    return tempFile
  }

  /**
   * Reads an optional boolean from a [ReadableMap], returning [default] when
   * the key is absent or null.
   */
  private fun optBool(map: ReadableMap, key: String, default: Boolean): Boolean =
    if (map.hasKey(key) && !map.isNull(key)) map.getBoolean(key) else default

  /**
   * Parses a JS `AddCaptionRequestInput` into the SDK's [AddCaptionRequest].
   * Returns `null` when any required field is missing.
   */
  private fun parseAddCaptionRequest(map: ReadableMap): AddCaptionRequest? {
    val languageCode = optString(map, "languageCode") ?: return null
    val label = optString(map, "label") ?: return null
    val captionsFileBase64 = optString(map, "captionsFileBase64") ?: return null
    return AddCaptionRequest(
      languageCode = languageCode,
      label = label,
      captionsFileBase64 = captionsFileBase64,
    )
  }

  /**
   * Parses a codec string ("h264", "vp9", "hevc", "av1") into [VideoCodec].
   * Returns `null` for unknown values.
   */
  private fun parseVideoCodec(codec: String): VideoCodec? =
    when (codec.lowercase()) {
      "h264" -> VideoCodec.H264
      "vp9" -> VideoCodec.VP9
      "hevc" -> VideoCodec.HEVC
      "av1" -> VideoCodec.AV1
      else -> null
    }

  /**
   * Parses a JS `SmartGenerateRequestInput` into the SDK's
   * [SmartGenerateRequest].
   */
  private fun parseSmartGenerateRequest(map: ReadableMap): SmartGenerateRequest {
    return SmartGenerateRequest(
      generateTitle = optBoolNullable(map, "generateTitle"),
      generateDescription = optBoolNullable(map, "generateDescription"),
      generateChapters = optBoolNullable(map, "generateChapters"),
      generateMoments = optBoolNullable(map, "generateMoments"),
      sourceLanguage = optString(map, "sourceLanguage"),
    )
  }

  /**
   * Parses a JS `TranscribeVideoRequestInput` into the SDK's
   * [TranscribeVideoRequest].
   */
  private fun parseTranscribeVideoRequest(map: ReadableMap): TranscribeVideoRequest {
    val targetLanguages = if (map.hasKey("targetLanguages") && !map.isNull("targetLanguages")) {
      map.getArray("targetLanguages")?.let { array ->
        List(array.size()) { idx -> array.getString(idx) }.filterNotNull()
      }
    } else null
    return TranscribeVideoRequest(
      targetLanguages = targetLanguages,
      generateTitle = optBoolNullable(map, "generateTitle"),
      generateDescription = optBoolNullable(map, "generateDescription"),
      generateChapters = optBoolNullable(map, "generateChapters"),
      generateMoments = optBoolNullable(map, "generateMoments"),
      sourceLanguage = optString(map, "sourceLanguage"),
    )
  }

  /** Reads an optional string from a [ReadableMap], or `null` if absent. */
  private fun optString(map: ReadableMap, key: String): String? =
    if (map.hasKey(key) && !map.isNull(key)) map.getString(key) else null

  /** Reads an optional nullable boolean from a [ReadableMap]. */
  private fun optBoolNullable(map: ReadableMap, key: String): Boolean? =
    if (map.hasKey(key) && !map.isNull(key)) map.getBoolean(key) else null

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

    private const val MAX_THUMBNAIL_BYTES = 20 * 1024 * 1024

    private val THUMBNAIL_CONTENT_TYPES = setOf(
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    )

    /** Pure validation shared by the bridge and focused JVM tests. */
    internal fun thumbnailUploadValidationError(uri: String, contentType: String): String? {
      if (contentType !in THUMBNAIL_CONTENT_TYPES) {
        return "Unsupported live stream thumbnail content type: $contentType"
      }
      val scheme = uri.substringBefore(':', missingDelimiterValue = "").lowercase()
      if (scheme != "file" && scheme != "content") {
        return "Live stream thumbnail URI must use the file or content scheme"
      }
      return null
    }

    internal fun readThumbnailBytes(
      input: InputStream,
      maxBytes: Int = MAX_THUMBNAIL_BYTES,
    ): ByteArray {
      val output = ByteArrayOutputStream()
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      var total = 0
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        total += count
        if (total > maxBytes) {
          throw IllegalArgumentException("Live stream thumbnail exceeds the $maxBytes byte limit")
        }
        output.write(buffer, 0, count)
      }
      return output.toByteArray()
    }

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
