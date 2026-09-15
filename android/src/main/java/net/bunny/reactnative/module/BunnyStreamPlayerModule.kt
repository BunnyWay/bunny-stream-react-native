package net.bunny.reactnative.module

import android.content.pm.PackageManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import net.bunny.api.BunnyStreamApi
import net.bunny.api.playback.DefaultPlaybackPositionManager
import net.bunny.api.playback.PlaybackPositionManager
import net.bunny.api.playback.ResumeConfig
import net.bunny.bunnystreamplayer.DefaultBunnyPlayer
import net.bunny.reactnative.NativeBunnyStreamPlayerSpec
import net.bunny.reactnative.state.toJsonString
import org.json.JSONArray

/**
 * TurboModule implementing the Codegen-generated [NativeBunnyStreamPlayerSpec].
 *
 * Exposes `initialize(accessKey, libraryId)` to JS, which must be called before
 * any [net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer] view can play video.
 * Delegates to [BunnyStreamApi.initialize] on the application context.
 *
 * Also exposes device queries (`isRunningOnTV`, `getPlaybackSpeeds`) and the
 * resume-position management API (Phase 7). Position management creates a
 * standalone [DefaultPlaybackPositionManager] — the same fallback the Android
 * demo's ResumePositionViewModel uses when no player has enabled resume yet.
 * It shares the SDK's "bunny_resume_positions" SharedPreferences file.
 *
 * Security: this module never logs `accessKey`, tokens, or playback URLs.
 * Validation errors include only the offending field name and reason.
 */
@ReactModule(name = BunnyStreamPlayerModule.NAME)
class BunnyStreamPlayerModule(reactContext: ReactApplicationContext) :
  NativeBunnyStreamPlayerSpec(reactContext) {

  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  /**
   * Standalone position manager bound to the same prefs file the player uses.
   * Works even when no BunnyStreamPlayer view has enabled resume in this
   * process (the engine's own `positionManager` is null until then).
   */
  private fun positionManager(): PlaybackPositionManager =
    DefaultPlaybackPositionManager(reactApplicationContext, ResumeConfig())

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

  /**
   * Phase 7 — Android TV detection via the leanback system feature, the same
   * check the SDK's `BunnyStreamPlayer.isRunningOnTV` performs.
   */
  override fun isRunningOnTV(): Boolean {
    return reactApplicationContext.packageManager
      .hasSystemFeature(PackageManager.FEATURE_LEANBACK)
  }

  /**
   * Phase 7 — allowed playback speeds from the engine
   * (`allowedSpeeds` → dashboard `playerSettings` → SDK defaults). Falls back
   * to the SDK's default list when the engine is not initialized.
   */
  override fun getPlaybackSpeeds(promise: Promise) {
    try {
      val speeds = DefaultBunnyPlayer.getInstance(reactApplicationContext).getPlaybackSpeeds()
      val arr = Arguments.createArray()
      for (speed in speeds) arr.pushDouble(speed.toDouble())
      promise.resolve(arr)
    } catch (e: Exception) {
      val arr = Arguments.createArray()
      for (speed in DEFAULT_SPEEDS) arr.pushDouble(speed)
      promise.resolve(arr)
    }
  }

  // --- Resume position management (Android-native) ---

  override fun getAllSavedPositions(promise: Promise) {
    moduleScope.launch {
      try {
        val positions = positionManager().getAllPositions()
        val arr = JSONArray()
        for (pos in positions) arr.put(org.json.JSONObject(pos.toJsonString()))
        promise.resolve(arr.toString())
      } catch (e: Exception) {
        promise.resolve("[]")
      }
    }
  }

  override fun clearSavedPosition(videoId: String, promise: Promise) {
    moduleScope.launch {
      try {
        positionManager().clearPosition(videoId)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_RESUME", "clearSavedPosition failed", e)
      }
    }
  }

  override fun clearAllSavedPositions(promise: Promise) {
    moduleScope.launch {
      try {
        positionManager().clearAllPositions()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_RESUME", "clearAllSavedPositions failed", e)
      }
    }
  }

  override fun exportPositions(promise: Promise) {
    moduleScope.launch {
      try {
        promise.resolve(positionManager().exportPositions())
      } catch (e: Exception) {
        promise.resolve("[]")
      }
    }
  }

  override fun importPositions(jsonData: String, promise: Promise) {
    moduleScope.launch {
      try {
        promise.resolve(positionManager().importPositions(jsonData))
      } catch (e: Exception) {
        promise.resolve(false)
      }
    }
  }

  override fun cleanupExpiredPositions(promise: Promise) {
    moduleScope.launch {
      try {
        positionManager().cleanupExpiredPositions()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_RESUME", "cleanupExpiredPositions failed", e)
      }
    }
  }

  companion object {
    const val NAME = "BunnyStreamPlayer"

    /** Mirrors the iOS SDK's hardcoded speed list; used when the engine is down. */
    private val DEFAULT_SPEEDS = doubleArrayOf(0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0)

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
