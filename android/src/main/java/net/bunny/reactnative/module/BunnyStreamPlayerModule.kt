package net.bunny.reactnative.module

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule stub for Bunny Stream player initialization.
 *
 * This is a minimal placeholder so that [BunnyStreamPlayerPackage] compiles and
 * autolinking recognises the module. The full implementation — extending the
 * Codegen-generated `NativeBunnyStreamPlayerSpec` and wiring
 * `BunnyStreamApi.initialize` — is added in plan section 2.
 */
@ReactModule(name = BunnyStreamPlayerModule.NAME)
class BunnyStreamPlayerModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  companion object {
    const val NAME = "BunnyStreamPlayer"
  }
}
