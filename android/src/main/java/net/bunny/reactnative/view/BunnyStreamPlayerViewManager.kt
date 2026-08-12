package net.bunny.reactnative.view

import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Fabric ViewManager stub for the Bunny Stream player component.
 *
 * This is a minimal placeholder so that [net.bunny.reactnative.module.BunnyStreamPlayerPackage]
 * compiles and autolinking recognises the view manager. The full implementation —
 * extending the Codegen-generated `BunnyStreamPlayerViewManagerInterface`,
 * wiring props setters via the generated delegate, and managing the native
 * [net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer] wrapper — is added in
 * plan section 4.
 */
class BunnyStreamPlayerViewManager(
  @Suppress("unused") private val reactContext: ReactApplicationContext,
) : SimpleViewManager<View>() {

  override fun getName(): String = NAME

  override fun createViewInstance(reactContext: ThemedReactContext): View =
    View(reactContext)

  companion object {
    const val NAME = "BunnyStreamPlayerView"
  }
}
