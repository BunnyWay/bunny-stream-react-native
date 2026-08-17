package net.bunny.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
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
class BunnyStreamPlayerPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      BunnyStreamPlayerModule.NAME -> BunnyStreamPlayerModule(reactContext)
      else -> null
    }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(BunnyStreamPlayerViewManager())

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      BunnyStreamPlayerModule.NAME to ReactModuleInfo(
        name = BunnyStreamPlayerModule.NAME,
        className = BunnyStreamPlayerModule::class.java.name,
        canOverrideExistingModule = false,
        needsEagerInit = false,
        isCxxModule = false,
        isTurboModule = true,
      ),
    )
  }
}
