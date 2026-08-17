package net.bunny.reactnative.view

import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.BaseViewManagerDelegate
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.viewmanagers.BunnyStreamPlayerViewManagerDelegate
import com.facebook.react.viewmanagers.BunnyStreamPlayerViewManagerInterface

/**
 * Fabric ViewManager for the Bunny Stream player component.
 *
 * Implements the Codegen-generated [BunnyStreamPlayerViewManagerInterface] and
 * routes prop updates through [BunnyStreamPlayerViewManagerDelegate]. The
 * manager name `BunnyStreamPlayerView` matches the Codegen component name exactly.
 *
 * Prop setters delegate to [BunnyStreamPlayerView]'s accumulation fields; the
 * actual video reload happens in [BunnyStreamPlayerView.commitProps], called
 * from [onAfterUpdateTransaction] after all props in a batch have been set.
 *
 * Commands are dispatched on the UI thread. `setVolume` and `setPlaybackRate`
 * target the `DefaultBunnyPlayer` singleton (not the view) because those
 * methods are not exposed on [net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer].
 * Full command validation and queueing is added in plan section 5.
 */
class BunnyStreamPlayerViewManager : SimpleViewManager<BunnyStreamPlayerView>(),
  BunnyStreamPlayerViewManagerInterface<BunnyStreamPlayerView> {

  private var delegate: BunnyStreamPlayerViewManagerDelegate<BunnyStreamPlayerView, BunnyStreamPlayerViewManager>? =
    null

  override fun getName(): String = NAME

  override fun getDelegate(): BaseViewManagerDelegate<BunnyStreamPlayerView, BunnyStreamPlayerViewManager> {
    if (delegate == null) {
      delegate = BunnyStreamPlayerViewManagerDelegate(this)
    }
    return delegate!!
  }

  override fun createViewInstance(reactContext: ThemedReactContext): BunnyStreamPlayerView =
    BunnyStreamPlayerView(reactContext)

  override fun onAfterUpdateTransaction(view: BunnyStreamPlayerView) {
    super.onAfterUpdateTransaction(view)
    view.commitProps()
  }

  override fun onDropViewInstance(view: BunnyStreamPlayerView) {
    view.cleanup()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    (super.getExportedCustomDirectEventTypeConstants() ?: emptyMap()).toMutableMap().apply {
      putAll(DIRECT_EVENTS)
    }

  // --- Prop setters (delegate calls these during a prop batch) ---

  override fun setVideoId(view: BunnyStreamPlayerView, value: String?) {
    view.setVideoId(value)
  }

  override fun setLibraryId(view: BunnyStreamPlayerView, value: Double) {
    view.setLibraryId(value)
  }

  override fun setToken(view: BunnyStreamPlayerView, value: String?) {
    view.setToken(value)
  }

  override fun setExpires(view: BunnyStreamPlayerView, value: Double) {
    view.setExpires(value)
  }

  override fun setAutoPlay(view: BunnyStreamPlayerView, value: Boolean) {
    view.setAutoPlay(value)
  }

  override fun setControls(view: BunnyStreamPlayerView, value: Boolean) {
    view.setControls(value)
  }

  // --- Commands (dispatched by delegate.receiveCommand) ---

  @ReactMethod
  override fun play(view: BunnyStreamPlayerView) {
    view.play()
  }

  @ReactMethod
  override fun pause(view: BunnyStreamPlayerView) {
    view.pause()
  }

  @ReactMethod
  override fun seekTo(view: BunnyStreamPlayerView, positionMs: Double) {
    view.seekTo(positionMs)
  }

  @ReactMethod
  override fun setVolume(view: BunnyStreamPlayerView, volume: Double) {
    view.setVolume(volume)
  }

  @ReactMethod
  override fun setPlaybackRate(view: BunnyStreamPlayerView, rate: Double) {
    view.setPlaybackRate(rate)
  }

  companion object {
    const val NAME = "BunnyStreamPlayerView"

    private val DIRECT_EVENTS = mapOf(
      "ready" to mapOf("registrationName" to "onReady"),
      "topReady" to mapOf("registrationName" to "onReady"),
      "playbackStateChange" to mapOf("registrationName" to "onPlaybackStateChange"),
      "topPlaybackStateChange" to mapOf("registrationName" to "onPlaybackStateChange"),
      "progress" to mapOf("registrationName" to "onProgress"),
      "topProgress" to mapOf("registrationName" to "onProgress"),
      "error" to mapOf("registrationName" to "onError"),
      "topError" to mapOf("registrationName" to "onError"),
      "buffering" to mapOf("registrationName" to "onBuffering"),
      "topBuffering" to mapOf("registrationName" to "onBuffering"),
      "play" to mapOf("registrationName" to "onPlay"),
      "topPlay" to mapOf("registrationName" to "onPlay"),
      "pause" to mapOf("registrationName" to "onPause"),
      "topPause" to mapOf("registrationName" to "onPause"),
      "end" to mapOf("registrationName" to "onEnd"),
      "topEnd" to mapOf("registrationName" to "onEnd"),
      "volumeChange" to mapOf("registrationName" to "onVolumeChange"),
      "topVolumeChange" to mapOf("registrationName" to "onVolumeChange"),
      "playbackRateChange" to mapOf("registrationName" to "onPlaybackRateChange"),
      "topPlaybackRateChange" to mapOf("registrationName" to "onPlaybackRateChange"),
    )
  }
}
