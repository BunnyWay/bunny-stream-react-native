package net.bunny.reactnative.view

import com.facebook.react.uimanager.BaseViewManagerDelegate
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Fabric ViewManager for the broadcaster host view.
 *
 * Implements the Codegen-generated interface and routes prop updates through
 * the delegate. The manager name `BunnyStreamBroadcasterView` matches the
 * Codegen component name exactly.
 *
 * Registered in [net.bunny.reactnative.BunnyStreamPlayerPackage].
 *
 * TODO(Android SDK): Commands (`startBroadcast`, `stopBroadcast`,
 * `switchCamera`, `setMuted`, `toggleMute`) are currently exposed as methods
 * on the view and invoked via the public TS wrapper's ref. When the SDK
 * exposes a public start method, `startBroadcast` will be a real command.
 */
class BunnyStreamBroadcasterViewManager :
  SimpleViewManager<BunnyStreamBroadcasterView>() {

  private var delegate:
    BaseViewManagerDelegate<BunnyStreamBroadcasterView, BunnyStreamBroadcasterViewManager>? =
    null

  override fun getName(): String = NAME

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

  // --- Prop setters ---

  @com.facebook.react.uimanager.annotations.ReactProp(name = "accessKey")
  fun setAccessKey(view: BunnyStreamBroadcasterView, value: String?) {
    view.setAccessKey(value)
  }

  @com.facebook.react.uimanager.annotations.ReactProp(name = "libraryId")
  fun setLibraryId(view: BunnyStreamBroadcasterView, value: Int) {
    view.setLibraryId(value)
  }

  @com.facebook.react.uimanager.annotations.ReactProp(name = "streamId")
  fun setStreamId(view: BunnyStreamBroadcasterView, value: String?) {
    view.setStreamId(value)
  }

  @com.facebook.react.uimanager.annotations.ReactProp(name = "ingestEndpoint")
  fun setIngestEndpoint(view: BunnyStreamBroadcasterView, value: String?) {
    view.setIngestEndpoint(value)
  }

  @com.facebook.react.uimanager.annotations.ReactProp(name = "quality")
  fun setQuality(view: BunnyStreamBroadcasterView, value: String?) {
    // Quality is not configurable on Android (hard-coded by SDK). Accepted
    // but ignored.
  }

  @com.facebook.react.uimanager.annotations.ReactProp(name = "cameraPosition")
  fun setCameraPosition(view: BunnyStreamBroadcasterView, value: String?) {
    view.setCameraPosition(value)
  }

  @com.facebook.react.uimanager.annotations.ReactProp(name = "hideDefaultControls", defaultBoolean = false)
  fun setHideDefaultControls(view: BunnyStreamBroadcasterView, value: Boolean) {
    view.setHideDefaultControls(value)
  }

  @com.facebook.react.uimanager.annotations.ReactProp(name = "dualPublish", defaultBoolean = false)
  fun setDualPublish(view: BunnyStreamBroadcasterView, value: Boolean) {
    view.setDualPublish(value)
  }

  @com.facebook.react.uimanager.annotations.ReactProp(name = "autoStart", defaultBoolean = false)
  fun setAutoStart(view: BunnyStreamBroadcasterView, value: Boolean) {
    view.setAutoStart(value)
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
