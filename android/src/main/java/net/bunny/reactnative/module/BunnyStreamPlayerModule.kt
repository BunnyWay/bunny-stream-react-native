package net.bunny.reactnative.module

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import net.bunny.api.BunnyStreamApi
import net.bunny.reactnative.NativeBunnyStreamPlayerSpec

/**
 * TurboModule implementing the Codegen-generated [NativeBunnyStreamPlayerSpec].
 *
 * Exposes `initialize(accessKey, libraryId)` to JS, which must be called before
 * any [net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer] view can play video.
 * Delegates to [BunnyStreamApi.initialize] on the application context.
 *
 * Security: this module never logs `accessKey`, tokens, or playback URLs.
 * Validation errors include only the offending field name and reason.
 */
@ReactModule(name = BunnyStreamPlayerModule.NAME)
class BunnyStreamPlayerModule(reactContext: ReactApplicationContext) :
  NativeBunnyStreamPlayerSpec(reactContext) {

  override fun initialize(accessKey: String, libraryId: Double) {
    require(accessKey.isNotBlank()) {
      "accessKey must be a non-empty string (SDK 4.0.0 requirement)"
    }
    val libraryIdLong = validateLibraryId(libraryId)
    BunnyStreamApi.initialize(
      context = reactApplicationContext.applicationContext,
      accessKey = accessKey,
      libraryId = libraryIdLong,
    )
  }

  companion object {
    const val NAME = "BunnyStreamPlayer"

    /**
     * Validates and converts the JS `Double` library ID to a `Long`.
     *
     * @throws IllegalArgumentException if the value is not finite, not positive,
     *   or has a fractional part.
     */
    internal fun validateLibraryId(libraryId: Double): Long {
      require(libraryId.isFinite()) {
        "libraryId must be a finite number"
      }
      require(libraryId > 0) {
        "libraryId must be positive"
      }
      require(libraryId % 1.0 == 0.0) {
        "libraryId must be an integer"
      }
      return libraryId.toLong()
    }
  }
}
