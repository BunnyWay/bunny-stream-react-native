package net.bunny.reactnative.view

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Fabric ViewManager for the Bunny Stream player component.
 *
 * Creates [BunnyStreamPlayerView] instances and wires props via the
 * Codegen-generated delegate. The manager name must match the Codegen
 * component name exactly: `BunnyStreamPlayerView`.
 *
 * Full prop setters, command dispatch, and event emission are added in
 * plan sections 4, 5, and 6.
 */
class BunnyStreamPlayerViewManager(
  @Suppress("unused") private val reactContext: ReactApplicationContext,
) : SimpleViewManager<BunnyStreamPlayerView>() {

  override fun getName(): String = NAME

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

  companion object {
    const val NAME = "BunnyStreamPlayerView"
  }
}
