package net.bunny.reactnative

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import net.bunny.reactnative.module.BunnyStreamPlayerModule
import net.bunny.reactnative.view.BunnyStreamPlayerViewManager

/**
 * React Native package for the Bunny Stream player bridge.
 *
 * Registered automatically via autolinking — the host app does not need to
 * add it manually to `PackageList`. Both the TurboModule ([BunnyStreamPlayerModule])
 * and the Fabric ViewManager ([BunnyStreamPlayerViewManager]) are declared here so
 * that React Native can discover them on app startup.
 */
class BunnyStreamPlayerPackage : ReactPackage {
  @Suppress("DEPRECATION")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf<NativeModule>(BunnyStreamPlayerModule(reactContext))

  @Suppress("DEPRECATION", "UNCHECKED_CAST")
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(BunnyStreamPlayerViewManager(reactContext))
}
