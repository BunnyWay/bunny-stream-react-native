package net.bunny.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import net.bunny.reactnative.module.BunnyStreamApiModule
import net.bunny.reactnative.module.BunnyStreamPlayerModule
import net.bunny.reactnative.view.BunnyLiveStreamPlayerViewManager
import net.bunny.reactnative.view.BunnyStreamPlayerViewManager

/**
 * React Native package for the Bunny Stream player bridge.
 *
 * Registered automatically via autolinking — the host app does not need to
 * add it manually to `PackageList`. The TurboModule ([BunnyStreamPlayerModule])
 * and both Fabric ViewManagers ([BunnyStreamPlayerViewManager] for VOD and
 * [BunnyLiveStreamPlayerViewManager] for live) are declared here so that
 * React Native can discover them on app startup.
 *
 * The live ViewManager is internal to the bridge — the public npm API exposes
 * a single `BunnyStreamPlayer` component that selects between the two hosts
 * based on `source.type` (PLAN.md §5).
 */
class BunnyStreamPlayerPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      BunnyStreamPlayerModule.NAME -> BunnyStreamPlayerModule(reactContext)
      BunnyStreamApiModule.NAME -> BunnyStreamApiModule(reactContext)
      else -> null
    }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(
      BunnyStreamPlayerViewManager(),
      BunnyLiveStreamPlayerViewManager(),
    )

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
      BunnyStreamApiModule.NAME to ReactModuleInfo(
        name = BunnyStreamApiModule.NAME,
        className = BunnyStreamApiModule::class.java.name,
        canOverrideExistingModule = false,
        needsEagerInit = false,
        isCxxModule = false,
        isTurboModule = true,
      ),
    )
  }
}
