package net.bunny.reactnative.view

import com.facebook.react.uimanager.BaseViewManagerDelegate
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.viewmanagers.BunnyLiveStreamPlayerViewManagerDelegate
import com.facebook.react.viewmanagers.BunnyLiveStreamPlayerViewManagerInterface

/**
 * Fabric ViewManager for the live-stream host view.
 *
 * Implements the Codegen-generated [BunnyLiveStreamPlayerViewManagerInterface]
 * and routes prop updates through [BunnyLiveStreamPlayerViewManagerDelegate].
 * The manager name `BunnyLiveStreamPlayerView` matches the Codegen component
 * name exactly.
 *
 * This manager is registered in [net.bunny.reactnative.BunnyStreamPlayerPackage]
 * but the corresponding native component is NOT exported from the public npm
 * API — the public `BunnyStreamPlayer` (src/index.tsx) selects between the VOD
 * host and this live host based on `source.type` (PLAN.md §5).
 *
 * Prop setters delegate to [BunnyLiveStreamPlayerView]'s accumulation fields;
 * the actual composition happens in [BunnyLiveStreamPlayerView.commitProps],
 * called from [onAfterUpdateTransaction] after all props in a batch are set.
 *
 * No commands today — the SDK does not yet expose a public live controller
 * (PLAN.md §6 Faza 5). When it does, command methods will be added here and
 * in the Codegen spec's `NativeCommands`.
 */
class BunnyLiveStreamPlayerViewManager :
  SimpleViewManager<BunnyLiveStreamPlayerView>(),
  BunnyLiveStreamPlayerViewManagerInterface<BunnyLiveStreamPlayerView> {

  private var delegate:
    BunnyLiveStreamPlayerViewManagerDelegate<BunnyLiveStreamPlayerView, BunnyLiveStreamPlayerViewManager>? =
    null

  override fun getName(): String = NAME

  override fun getDelegate():
    BaseViewManagerDelegate<BunnyLiveStreamPlayerView, BunnyLiveStreamPlayerViewManager> {
    if (delegate == null) {
      delegate = BunnyLiveStreamPlayerViewManagerDelegate(this)
    }
    return delegate!!
  }

  override fun createViewInstance(reactContext: ThemedReactContext): BunnyLiveStreamPlayerView =
    BunnyLiveStreamPlayerView(reactContext)

  override fun onAfterUpdateTransaction(view: BunnyLiveStreamPlayerView) {
    super.onAfterUpdateTransaction(view)
    view.commitProps()
  }

  override fun onDropViewInstance(view: BunnyLiveStreamPlayerView) {
    view.cleanup()
    super.onDropViewInstance(view)
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
    (super.getExportedCustomDirectEventTypeConstants() ?: emptyMap()).toMutableMap().apply {
      putAll(DIRECT_EVENTS)
    }

  // --- Prop setters (delegate calls these during a prop batch) ---

  override fun setLibraryId(view: BunnyLiveStreamPlayerView, value: Double) {
    view.setLibraryId(value)
  }

  override fun setStreamId(view: BunnyLiveStreamPlayerView, value: String?) {
    view.setStreamId(value)
  }

  override fun setToken(view: BunnyLiveStreamPlayerView, value: String?) {
    view.setToken(value)
  }

  override fun setExpires(view: BunnyLiveStreamPlayerView, value: Double) {
    view.setExpires(value)
  }

  companion object {
    const val NAME = "BunnyLiveStreamPlayerView"

    private val DIRECT_EVENTS = mapOf(
      "topVideoSizeChange" to mapOf("registrationName" to "onVideoSizeChange"),
      "topLiveStateChange" to mapOf("registrationName" to "onLiveStateChange"),
      "topLiveError" to mapOf("registrationName" to "onLiveError"),
    )
  }
}
