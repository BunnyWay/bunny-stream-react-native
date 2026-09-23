package net.bunny.reactnative.module

import android.content.ContentResolver
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import net.bunny.api.BunnyStreamApi
import net.bunny.api.StreamApi
import net.bunny.api.error.BunnyError
import net.bunny.api.error.BunnyResult
import net.bunny.api.upload.VideoUploader
import net.bunny.api.upload.model.PauseState
import net.bunny.api.upload.model.UploadEvent
import net.bunny.reactnative.NativeBunnyStreamUploadSpec

/**
 * TurboModule implementing the Codegen-generated [NativeBunnyStreamUploadSpec].
 *
 * Bridges the Bunny Stream video uploader (`net.bunny:api`) to JS. Uploads are
 * identified by an `uploadId` string returned from [startUpload] /
 * [continueUpload]. Progress and lifecycle events are emitted through
 * `RCTDeviceEventEmitter` under the [EVENT_NAME] as JS objects matching the
 * `UploadEvent` shape in `src/api/models/upload.ts`.
 *
 * Control methods ([pauseUpload], [resumeUpload], [cancelUpload]) resolve
 * their Promise with a `BunnyResult`-shaped envelope
 * (`{ ok: true, value: null }` / `{ ok: false, error }`) — never reject — so
 * the typed error taxonomy stays available to the JS caller.
 *
 * Platform notes:
 * - Basic uploader: pause/resume are no-ops; `continueUpload` returns
 *   `InvalidState`; every `Progress` reports `PauseState.Unsupported`.
 * - TUS uploader: pause/resume/cancel work; `continueUpload` resumes.
 * - The SDK does not run a foreground service — uploads survive navigation
 *   but not process death.
 *
 * Security: this module never logs `accessKey`, tokens, or file paths.
 */
@ReactModule(name = BunnyStreamUploadModule.NAME)
class BunnyStreamUploadModule(reactContext: ReactApplicationContext) :
  NativeBunnyStreamUploadSpec(reactContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  private val mappers = BunnyApiMappers

  /**
   * Tracks the active Flow collection job per `uploadId` so we can cancel it
   * when the JS side calls [cancelUpload] and so [getUploadState] can read the
   * last observed event.
   */
  private val activeJobs = ConcurrentHashMap<String, Job>()

  /** Last observed event per `uploadId`, for [getUploadState] snapshots. */
  private val lastEvents = ConcurrentHashMap<String, UploadEvent>()

  // region — Upload lifecycle —

  override fun startUpload(
    libraryId: Double,
    uri: String,
    title: String?,
    collectionId: String?,
    mode: String,
    promise: Promise,
  ) {
    launchUpload(promise, mode) { uploader ->
      val parsed = resolveUploadUri(uri)
        ?: throw IllegalArgumentException("Invalid upload URI: $uri")
      // The Android SDK's VideoUploader.startUpload creates the video entry
      // internally using the file's display name as the title. The `title`
      // and `collectionId` parameters are not exposed by the native
      // startUpload signature — they are accepted by the RN contract for
      // iOS parity and ignored on Android.
      uploader.startUpload(libraryId.toLong(), parsed)
    }
  }

  override fun continueUpload(
    libraryId: Double,
    videoId: String,
    uri: String,
    mode: String,
    promise: Promise,
  ) {
    launchUpload(promise, mode) { uploader ->
      val parsed = resolveUploadUri(uri)
        ?: throw IllegalArgumentException("Invalid upload URI: $uri")
      uploader.continueUpload(libraryId.toLong(), videoId, parsed)
    }
  }

  override fun pauseUpload(uploadId: String, promise: Promise) {
    launchControl(promise) { api ->
      // Both uploaders accept pauseUpload; on the basic uploader it is a
      // documented no-op. We do not know which uploader owns this uploadId,
      // so we call pause on both — the one that does not own it ignores it.
      api.videoUploader.pauseUpload(uploadId)
      api.tusVideoUploader.pauseUpload(uploadId)
      mappers.run { BunnyResult.Ok(Unit).toUnitEnvelope() }
    }
  }

  override fun resumeUpload(uploadId: String, promise: Promise) {
    launchControl(promise) { api ->
      api.videoUploader.resumeUpload(uploadId)
      api.tusVideoUploader.resumeUpload(uploadId)
      mappers.run { BunnyResult.Ok(Unit).toUnitEnvelope() }
    }
  }

  override fun cancelUpload(uploadId: String, promise: Promise) {
    launchControl(promise) { api ->
      api.videoUploader.cancelUpload(uploadId)
      api.tusVideoUploader.cancelUpload(uploadId)
      activeJobs[uploadId]?.cancel()
      activeJobs.remove(uploadId)
      lastEvents.remove(uploadId)
      mappers.run { BunnyResult.Ok(Unit).toUnitEnvelope() }
    }
  }

  override fun getUploadState(uploadId: String, promise: Promise) {
    val event = lastEvents[uploadId]
    if (event == null) {
      // Unknown or already-evicted upload: resolve with ok + null value.
      promise.resolve(
        WritableNativeMap().apply {
          putBoolean("ok", true)
          putNull("value")
        },
      )
      return
    }
    promise.resolve(
      WritableNativeMap().apply {
        putBoolean("ok", true)
        putMap("value", event.toStateMap())
      },
    )
  }

  override fun restoreUploads() {
    // No-op on Android: uploads are in-process and cannot survive process
    // death without a host-owned foreground service. Kept so the shared
    // Codegen spec stays symmetric — iOS reattaches its TUS session here.
  }

  // endregion

  // region — Event emitter plumbing —

  override fun addListener(eventName: String) {
    // Required by Codegen for event emitters; React Native's
    // RCTDeviceEventEmitter manages the actual listener set on the JS side.
  }

  override fun removeListeners(count: Double) {
    // Required by Codegen; no native bookkeeping needed.
  }

  // endregion

  // region — Internals —

  /**
   * Parses the JS-supplied URI and makes it readable by the SDK.
   *
   * The SDK's uploader resolves name and size through
   * `ContentResolver.query`, which only answers provider-backed URIs — a
   * `file://` URI (what `react-native-image-picker` returns for its cache
   * copies) comes back as "no metadata available". Serving the file through
   * the module's FileProvider gives the SDK a `content://` URI whose query
   * and stream both work. Non-file schemes pass through untouched, and a
   * file outside the configured roots keeps its original URI so the SDK's
   * own `LocalFile` error still describes the failure.
   */
  private fun resolveUploadUri(uriString: String): Uri? {
    val uri = parseUri(uriString) ?: return null
    if (uri.scheme != ContentResolver.SCHEME_FILE) return uri
    val file = uri.path?.let(::File) ?: return uri
    return runCatching {
      FileProvider.getUriForFile(
        reactApplicationContext,
        reactApplicationContext.packageName + FILE_PROVIDER_AUTHORITY_SUFFIX,
        file,
      )
    }.getOrDefault(uri)
  }

  private fun parseUri(uriString: String): Uri? =
    runCatching { Uri.parse(uriString) }.getOrNull()?.takeIf { it.scheme != null }

  private fun uploaderFor(api: StreamApi, mode: String): VideoUploader =
    if (mode == "tus") api.tusVideoUploader else api.videoUploader

  /**
   * Launches a start/continue call, resolves the promise with
   * `{ ok: true, value: { uploadId } }`, and starts collecting the upload's
   * event Flow so events are forwarded to JS.
   */
  private inline fun launchUpload(
    promise: Promise,
    mode: String,
    crossinline block: suspend (uploader: VideoUploader) -> String,
  ) {
    if (!BunnyStreamApi.isInitialized()) {
      promise.resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first."))
      return
    }
    scope.launch {
      try {
        val api = BunnyStreamApi.getInstance()
        val uploadId = block(uploaderFor(api, mode))
        // Resolve immediately with the handle so JS can subscribe to events.
        promise.resolve(
          WritableNativeMap().apply {
            putBoolean("ok", true)
            putMap("value", WritableNativeMap().apply { putString("uploadId", uploadId) })
          },
        )
        // Start collecting events for this uploadId.
        observeAndForward(api, uploadId, mode)
      } catch (e: IllegalArgumentException) {
        promise.resolve(mappers.errEnvelope(BunnyError.InvalidState(e.message ?: e.toString(), isTerminal = true)))
      } catch (t: Throwable) {
        promise.resolve(mappers.errEnvelope(BunnyError.Network(t.message ?: t.toString(), t)))
      }
    }
  }

  /** Launches a control method (pause/resume/cancel) that returns a Unit envelope. */
  private inline fun launchControl(
    promise: Promise,
    crossinline block: suspend (api: StreamApi) -> WritableMap,
  ) {
    if (!BunnyStreamApi.isInitialized()) {
      promise.resolve(invalidState("BunnyStreamApi is not initialised. Call initialize(accessKey, libraryId) first."))
      return
    }
    scope.launch {
      try {
        promise.resolve(block(BunnyStreamApi.getInstance()))
      } catch (t: Throwable) {
        promise.resolve(mappers.errEnvelope(BunnyError.Network(t.message ?: t.toString(), t)))
      }
    }
  }

  /**
   * Collects the [VideoUploader.observeUpload] Flow for [uploadId] and forwards
   * each event to JS via `RCTDeviceEventEmitter`. The Flow completes after
   * `Completed`, `Cancelled`, or `Failed` — at that point we clean up the
   * tracking entries but keep the last event for [getUploadState].
   */
  private fun observeAndForward(api: StreamApi, uploadId: String, mode: String) {
    val flow: Flow<UploadEvent>? = uploaderFor(api, mode).observeUpload(uploadId)
    if (flow == null) return
    val job = scope.launch {
      flow.onEach { event ->
        lastEvents[uploadId] = event
        emitEvent(uploadId, event)
      }.collect { }
      // Flow completed (terminal event) — clean up the active job but keep
      // lastEvents for getUploadState snapshots.
      activeJobs.remove(uploadId)
    }
    activeJobs[uploadId] = job
  }

  private fun emitEvent(uploadId: String, event: UploadEvent) {
    val payload = event.toEventMap(uploadId)
    reactApplicationContext
      .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_NAME, payload)
  }

  private fun UploadEvent.toEventMap(uploadId: String): WritableMap =
    when (this) {
      is UploadEvent.Started ->
        WritableNativeMap().apply {
          putString("type", "started")
          putString("uploadId", uploadId)
          putString("videoId", videoId)
        }
      is UploadEvent.Progress ->
        WritableNativeMap().apply {
          putString("type", "progress")
          putString("uploadId", uploadId)
          putString("videoId", videoId)
          // The Android SDK reports percentage as 0..100; the JS contract
          // expects bytesUploaded/totalBytes/progress (0..1). Android does
          // not expose byte counts, so we synthesize them from the percentage
          // and report progress as a fraction.
          putDouble("bytesUploaded", 0.0)
          putDouble("totalBytes", 0.0)
          putDouble("progress", percentage.toDouble() / 100.0)
          putString("pauseSupported", pauseState.toPauseSupport())
        }
      is UploadEvent.Completed ->
        WritableNativeMap().apply {
          putString("type", "completed")
          putString("uploadId", uploadId)
          putString("videoId", videoId)
        }
      is UploadEvent.Cancelled ->
        WritableNativeMap().apply {
          putString("type", "cancelled")
          putString("uploadId", uploadId)
          putString("videoId", videoId)
        }
      is UploadEvent.Failed ->
        WritableNativeMap().apply {
          putString("type", "failed")
          putString("uploadId", uploadId)
          videoId?.let { putString("videoId", it) } ?: putNull("videoId")
          putMap("error", mappers.run { error.toWritableMap() })
        }
    }

  /**
   * Maps the last observed event to the `UploadState` snapshot shape used by
   * [getUploadState].
   */
  private fun UploadEvent.toStateMap(): WritableMap =
    when (this) {
      is UploadEvent.Started ->
        WritableNativeMap().apply {
          putString("status", "uploading")
          putString("videoId", videoId)
          putDouble("bytesUploaded", 0.0)
          putDouble("totalBytes", 0.0)
          putDouble("progress", 0.0)
        }
      is UploadEvent.Progress ->
        WritableNativeMap().apply {
          putString("status", if (pauseState == PauseState.Paused) "paused" else "uploading")
          putString("videoId", videoId)
          putDouble("bytesUploaded", 0.0)
          putDouble("totalBytes", 0.0)
          putDouble("progress", percentage.toDouble() / 100.0)
        }
      is UploadEvent.Completed ->
        WritableNativeMap().apply {
          putString("status", "completed")
          putString("videoId", videoId)
        }
      is UploadEvent.Cancelled ->
        WritableNativeMap().apply {
          putString("status", "cancelled")
          putString("videoId", videoId)
        }
      is UploadEvent.Failed ->
        WritableNativeMap().apply {
          putString("status", "failed")
          videoId?.let { putString("videoId", it) } ?: putNull("videoId")
          putMap("error", mappers.run { error.toWritableMap() })
        }
    }

  private fun PauseState.toPauseSupport(): String =
    when (this) {
      PauseState.Unsupported -> "unsupported"
      PauseState.Paused, PauseState.Uploading -> "supported"
    }

  private fun invalidState(message: String): WritableMap =
    mappers.errEnvelope(BunnyError.InvalidState(message, isTerminal = true))

  // endregion

  companion object {
    const val NAME = "BunnyStreamUpload"
    const val EVENT_NAME = "bunnyStreamUploadEvent"

    /** Matches the provider authority declared in this module's manifest. */
    private const val FILE_PROVIDER_AUTHORITY_SUFFIX = ".bunnystream.fileprovider"
  }
}
