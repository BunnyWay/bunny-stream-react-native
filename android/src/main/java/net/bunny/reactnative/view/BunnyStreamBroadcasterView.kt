package net.bunny.reactnative.view

import android.content.Context
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter
import net.bunny.api.BunnyStreamApi
import net.bunny.bunnystreamcameraupload.BunnyStreamCameraUpload
import net.bunny.bunnystreamcameraupload.DeviceCamera
import net.bunny.bunnystreamcameraupload.IngestEndpoint
import net.bunny.bunnystreamcameraupload.IngestEndpointState
import net.bunny.bunnystreamcameraupload.RecordingDurationListener
import net.bunny.bunnystreamcameraupload.RecordingStateListener

/**
 * React Native Fabric wrapper that hosts the SDK's [BunnyStreamCameraUpload]
 * view for camera recording and live broadcasting.
 *
 * The SDK ships the camera upload as a `FrameLayout` subclass, so the bridge
 * wraps it directly — no Compose hosting is needed (unlike the live player).
 *
 * The bridge:
 *  1. Creates a [BunnyStreamCameraUpload] and adds it as a child view.
 *  2. Assigns a [RecordingStateListener] and [RecordingDurationListener] that
 *     forward SDK callbacks to JS via Fabric direct events.
 *  3. Exposes prop setters for `liveStreamId`, `liveIngestEndpoint`,
 *     `dualPublish`, `hideDefaultControls`, and `cameraPosition`.
 *  4. Exposes command methods for `stopBroadcast`, `switchCamera`, and
 *     `setMuted`.
 *
 * TODO(Android SDK): There is no public `startBroadcast()` / `startRecording()`
 * method on `BunnyStreamCameraUpload`. The SDK only starts streaming when the
 * built-in start/stop button is pressed. When `hideDefaultControls` is `false`
 * (default), the user can start via the native button. When controls are
 * hidden, `startBroadcast` is a no-op. This will be resolved when the SDK
 * exposes a public start method.
 *
 * Camera and microphone permissions must be granted by the host app before
 * the view is mounted — the SDK checks but does not request them.
 */
class BunnyStreamBroadcasterView(context: Context) : FrameLayout(context) {

  private val cameraView: BunnyStreamCameraUpload = BunnyStreamCameraUpload(context)

  // Accumulated props — applied in commitProps() after a prop batch.
  private var pendingAccessKey: String? = null
  private var pendingLibraryId: Int = -1
  private var pendingStreamId: String? = null
  private var pendingIngestEndpoint: String? = null
  private var pendingCameraPosition: String = "back"
  private var pendingHideDefaultControls: Boolean = false
  private var pendingDualPublish: Boolean = false
  private var pendingAutoStart: Boolean = false
  private var propsCommitted = false

  init {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    cameraView.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    addView(cameraView)

    cameraView.streamStateListener = object : RecordingStateListener {
      override fun onStreamInitializing() {
        emitStateChange("preparing")
      }

      override fun onStreamConnected() {
        emitStateChange("live")
      }

      override fun onStreamStopped() {
        emitStateChange("idle")
      }

      override fun onStreamDisconnected() {
        emitReconnecting(attempt = 1, usingBackup = false)
      }

      override fun onStreamAuthError() {
        emitError("Authentication error")
      }

      override fun onStreamConnectionFailed(message: String) {
        emitReconnectFailed()
        emitError(message)
      }

      override fun onCameraChanged(deviceCamera: DeviceCamera) {
        val position = when (deviceCamera) {
          DeviceCamera.FRONT -> "front"
          DeviceCamera.BACK -> "back"
        }
        emitCameraChange(position)
      }

      override fun onAudioMuted(muted: Boolean) {
        emitMuteChange(muted)
      }

      override fun onIngestEndpointChanged(endpoint: IngestEndpoint, state: IngestEndpointState) {
        val endpointStr = when (endpoint) {
          IngestEndpoint.PRIMARY -> "primary"
          IngestEndpoint.BACKUP -> "backup"
        }
        val stateStr = when (state) {
          IngestEndpointState.CONNECTING -> "connecting"
          IngestEndpointState.LIVE -> "live"
          IngestEndpointState.OFFLINE -> "offline"
        }
        emitIngestStateChange(endpointStr, stateStr)
      }
    }

    cameraView.streamDurationListener = object : RecordingDurationListener {
      override fun onDurationUpdated(durationMillis: Long, durationFormatted: String) {
        emitElapsedTime(durationMillis.toInt(), durationFormatted)
      }
    }
  }

  // --- Prop setters (called by the ViewManager delegate) ---

  fun setAccessKey(value: String?) {
    pendingAccessKey = value
  }

  fun setLibraryId(value: Int) {
    pendingLibraryId = value
  }

  fun setStreamId(value: String?) {
    pendingStreamId = value
  }

  fun setIngestEndpoint(value: String?) {
    pendingIngestEndpoint = value
  }

  fun setCameraPosition(value: String?) {
    pendingCameraPosition = value ?: "back"
  }

  fun setHideDefaultControls(value: Boolean) {
    pendingHideDefaultControls = value
  }

  fun setDualPublish(value: Boolean) {
    pendingDualPublish = value
  }

  fun setAutoStart(value: Boolean) {
    pendingAutoStart = value
  }

  /**
   * Applies all pending props after a prop batch. Called from the
   * ViewManager's `onAfterUpdateTransaction`.
   */
  fun commitProps() {
    // The SDK requires BunnyStreamApi to be initialised before startPreview.
    // The bridge API module handles initialisation; if it hasn't happened,
    // startPreview will warn and return.
    if (BunnyStreamApi.isInitialized()) {
      cameraView.bunny = BunnyStreamApi.getInstance()
    }

    cameraView.hideDefaultControls = pendingHideDefaultControls
    cameraView.liveStreamId = pendingStreamId
    cameraView.liveIngestEndpoint = pendingIngestEndpoint
    cameraView.dualPublish = pendingDualPublish

    if (!propsCommitted) {
      // First commit — start the camera preview.
      cameraView.startPreview()
      propsCommitted = true

      // TODO(Android SDK): autoStart is not supported because there is no
      // public startBroadcast() method. The user must use the native
      // start button when hideDefaultControls is false.
      if (pendingAutoStart && !pendingHideDefaultControls) {
        post { performStartViaNativeButton() }
      }
    }
  }

  // --- Commands ---

  /**
   * TODO(Android SDK): There is no public startBroadcast() method. This
   * simulates clicking the built-in start/stop button when controls are
   * visible. When controls are hidden, this is a no-op.
   */
  fun startBroadcast() {
    if (!pendingHideDefaultControls) {
      performStartViaNativeButton()
    }
  }

  fun stopBroadcast() {
    cameraView.stopRecording()
  }

  fun switchCamera() {
    cameraView.switchCamera()
  }

  fun setMuted(muted: Boolean) {
    cameraView.setAudioMuted(muted)
  }

  fun toggleMute() {
    // The SDK doesn't expose a toggle; track state internally.
    // TODO(Android SDK): expose isAudioMuted() or toggleMute().
    cameraView.setAudioMuted(!lastKnownMuted)
  }

  private var lastKnownMuted = false

  /**
   * Simulates pressing the SDK's built-in start/stop button.
   *
   * TODO(Android SDK): Replace with a public startBroadcast() method when
   * the SDK exposes one. This workaround finds the button view and performs
   * a click, which triggers the internal StreamHandler.startStreaming()
   * or startLiveStreaming() call.
   */
  private fun performStartViaNativeButton() {
    // The SDK's BunnyStreamCameraUpload has a built-in start/stop button.
    // When hideDefaultControls is false, we can find and click it.
    // This is fragile but the only option until the SDK exposes a public
    // start method.
    val startButton = findStartButton(cameraView)
    startButton?.performClick()
  }

  private fun findStartButton(view: android.view.View): android.view.View? {
    if (view is android.widget.Button) {
      // Heuristic: the SDK's start button has "start" or "stop" in its text.
      val text = view.text?.toString()?.lowercase() ?: ""
      if (text.contains("start") || text.contains("stop") || text.contains("go live")) {
        return view
      }
    }
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        findStartButton(view.getChildAt(i))?.let { return it }
      }
    }
    return null
  }

  // --- Event emitters ---

  private fun emitStateChange(state: String) {
    emit("topStateChange", Arguments.createMap().apply { putString("state", state) })
  }

  private fun emitElapsedTime(elapsedMs: Int, formatted: String) {
    emit("topElapsedTime", Arguments.createMap().apply {
      putInt("elapsedMs", elapsedMs)
      putString("formatted", formatted)
    })
  }

  private fun emitCameraChange(position: String) {
    emit("topCameraChange", Arguments.createMap().apply { putString("position", position) })
  }

  private fun emitMuteChange(muted: Boolean) {
    lastKnownMuted = muted
    emit("topMuteChange", Arguments.createMap().apply { putBoolean("muted", muted) })
  }

  private fun emitIngestStateChange(endpoint: String, state: String) {
    emit("topIngestStateChange", Arguments.createMap().apply {
      putString("endpoint", endpoint)
      putString("state", state)
    })
  }

  private fun emitReconnecting(attempt: Int, usingBackup: Boolean) {
    emit("topReconnecting", Arguments.createMap().apply {
      putInt("attempt", attempt)
      putBoolean("usingBackup", usingBackup)
    })
  }

  private fun emitReconnectFailed() {
    emit("topReconnectFailed", Arguments.createMap())
  }

  private fun emitFailover(usingBackup: Boolean) {
    emit("topFailover", Arguments.createMap().apply { putBoolean("usingBackup", usingBackup) })
  }

  private fun emitError(message: String) {
    emit("topError", Arguments.createMap().apply { putString("message", message) })
  }

  private fun emit(eventName: String, payload: WritableMap) {
    val reactContext = context as? com.facebook.react.bridge.ReactContext ?: return
    reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, eventName, payload)
  }

  /**
   * Called when the view is removed from the React Native tree. Stops any
   * active recording/broadcast and releases camera resources.
   */
  fun cleanup() {
    if (cameraView.isRecording()) {
      cameraView.stopRecording()
    }
  }
}
