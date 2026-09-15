package net.bunny.reactnative.view

import com.facebook.react.uimanager.BaseViewManagerDelegate
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.viewmanagers.BunnyStreamBroadcasterViewManagerDelegate
import com.facebook.react.viewmanagers.BunnyStreamBroadcasterViewManagerInterface

/**
 * Fabric ViewManager for the broadcaster host view.
 *
 * Implements the Codegen-generated [BunnyStreamBroadcasterViewManagerInterface]
 * and routes prop updates through [BunnyStreamBroadcasterViewManagerDelegate].
 * The manager name `BunnyStreamBroadcasterView` matches the Codegen component
 * name exactly.
 *
 * Commands are dispatched by the delegate's `receiveCommand`, which routes
 * `startBroadcast`, `stopBroadcast`, `switchCamera`, `setMuted`, and
 * `toggleMute` to the view.
 *
 * Registered in [net.bunny.reactnative.BunnyStreamPlayerPackage].
 *
 * `startBroadcast` simulates the built-in native start button when
 * `hideDefaultControls` is false — the SDK exposes no public start method
 * (verified in 4.0.0).
 */
class BunnyStreamBroadcasterViewManager :
  SimpleViewManager<BunnyStreamBroadcasterView>(),
  BunnyStreamBroadcasterViewManagerInterface<BunnyStreamBroadcasterView> {

  private var delegate:
    BunnyStreamBroadcasterViewManagerDelegate<BunnyStreamBroadcasterView, BunnyStreamBroadcasterViewManager>? =
    null

  override fun getName(): String = NAME

  override fun getDelegate(): BaseViewManagerDelegate<BunnyStreamBroadcasterView, BunnyStreamBroadcasterViewManager> {
    if (delegate == null) {
      delegate = BunnyStreamBroadcasterViewManagerDelegate(this)
    }
    return delegate!!
  }

  override fun createViewInstance(reactContext: ThemedReactContext): BunnyStreamBroadcasterView =
    BunnyStreamBroadcasterView(reactContext)

  override fun onAfterUpdateTransaction(view: BunnyStreamBroadcasterView) {
    super.onAfterUpdateTransaction(view)
    view.commitProps()
  }

  override fun onDropViewInstance(view: BunnyStreamBroadcasterView) {
    view.cleanup()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    (super.getExportedCustomDirectEventTypeConstants() ?: emptyMap()).toMutableMap().apply {
      putAll(DIRECT_EVENTS)
    }

  // --- Prop setters (delegate calls these during a prop batch) ---

  override fun setAccessKey(view: BunnyStreamBroadcasterView, value: String?) {
    view.setAccessKey(value)
  }

  override fun setLibraryId(view: BunnyStreamBroadcasterView, value: Int) {
    view.setLibraryId(value)
  }

  override fun setStreamId(view: BunnyStreamBroadcasterView, value: String?) {
    view.setStreamId(value)
  }

  override fun setIngestEndpoint(view: BunnyStreamBroadcasterView, value: String?) {
    view.setIngestEndpoint(value)
  }

  override fun setQuality(view: BunnyStreamBroadcasterView, value: String?) {
    // Quality is not configurable on Android (hard-coded by SDK). Accepted
    // but ignored.
  }

  override fun setCameraPosition(view: BunnyStreamBroadcasterView, value: String?) {
    view.setCameraPosition(value)
  }

  override fun setHideDefaultControls(view: BunnyStreamBroadcasterView, value: Boolean) {
    view.setHideDefaultControls(value)
  }

  override fun setDualPublish(view: BunnyStreamBroadcasterView, value: Boolean) {
    view.setDualPublish(value)
  }

  override fun setAutoStart(view: BunnyStreamBroadcasterView, value: Boolean) {
    view.setAutoStart(value)
  }

  // --- Commands (dispatched by delegate.receiveCommand) ---

  override fun startBroadcast(view: BunnyStreamBroadcasterView) {
    view.startBroadcast()
  }

  override fun stopBroadcast(view: BunnyStreamBroadcasterView) {
    view.stopBroadcast()
  }

  override fun switchCamera(view: BunnyStreamBroadcasterView) {
    view.switchCamera()
  }

  override fun setMuted(view: BunnyStreamBroadcasterView, muted: Boolean) {
    view.setMuted(muted)
  }

  override fun toggleMute(view: BunnyStreamBroadcasterView) {
    view.toggleMute()
  }

  companion object {
    const val NAME = "BunnyStreamBroadcasterView"

    private val DIRECT_EVENTS = mapOf(
      "topStateChange" to mapOf("registrationName" to "onStateChange"),
      "topElapsedTime" to mapOf("registrationName" to "onElapsedTime"),
      "topCameraChange" to mapOf("registrationName" to "onCameraChange"),
      "topMuteChange" to mapOf("registrationName" to "onMuteChange"),
      "topIngestStateChange" to mapOf("registrationName" to "onIngestStateChange"),
      "topReconnecting" to mapOf("registrationName" to "onReconnecting"),
      "topReconnectFailed" to mapOf("registrationName" to "onReconnectFailed"),
      "topFailover" to mapOf("registrationName" to "onFailover"),
      "topError" to mapOf("registrationName" to "onError"),
    )
  }
}
