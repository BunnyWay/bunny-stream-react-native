package net.bunny.reactnative.drm

import android.media.MediaDrm
import android.os.Build
import android.util.Log
import androidx.media3.common.C
import net.bunny.api.settings.domain.model.PlayerSettings

/**
 * Bridge-side mirror of the SDK's internal `WidevinePolicy` (added in
 * bunny-stream-android PR #88, ships in 4.2.1). That class is `internal`, so
 * the two decisions the bridge needs — classifying a pre-load security-level
 * refusal and intersecting `setVideoQuality` overrides with the L3 cap — are
 * recomputed here from the public `PlayerSettings` fields.
 *
 * Same rules as upstream: Widevine levels count downwards (1 = L1,
 * hardware-backed, strictest; 3 = L3, software only), only L3 is
 * resolution-capped, and an unknown device level applies neither rule.
 * The functions are pure; only [deviceLevel] touches the platform.
 */
internal object WidevinePolicy {

  /** The SD ceiling when the library enables the flag without a resolution. */
  private const val DEFAULT_SD_RESOLUTION = 480

  private const val TAG = "WidevinePolicy"

  /**
   * This device's Widevine security level (1, 2 or 3), or null when it can't
   * be read. Read once per process: it is a property of the hardware.
   */
  val deviceLevel: Int? by lazy { readDeviceLevel() }

  /**
   * The track-selector size cap for [settings], or null when every rendition
   * is allowed. Mirrors the SDK: only L3 devices are capped, and the cap sits
   * on the picture's shorter side so portrait videos are covered too
   * ([videoWidth]/[videoHeight] decide the axis; unknown shape is landscape).
   */
  fun maxVideoSize(
    settings: PlayerSettings?,
    deviceLevel: Int?,
    videoWidth: Int,
    videoHeight: Int,
  ): Pair<Int, Int>? {
    if (settings == null || !settings.drmEnabled || !settings.widevineSdOnlyForL3) return null
    if (deviceLevel != 3) return null
    val cap = settings.maxSoftwareWidevineResolution?.takeIf { it > 0 } ?: DEFAULT_SD_RESOLUTION
    val portrait = videoWidth in 1 until videoHeight
    return if (portrait) cap to Int.MAX_VALUE else Int.MAX_VALUE to cap
  }

  /**
   * True when the library requires a stronger Widevine level than this
   * device has — the case where the SDK refuses playback before the engine
   * starts (`widevineMinClientSecurityLevel`). An unknown device level is let
   * through: the license server is the one that decides.
   */
  fun isSecurityLevelRefused(settings: PlayerSettings?, deviceLevel: Int?): Boolean {
    if (settings == null || !settings.drmEnabled) return false
    val required = settings.widevineMinClientSecurityLevel?.takeIf { it in 1..3 } ?: return false
    if (deviceLevel == null) return false
    return deviceLevel > required
  }

  private fun readDeviceLevel(): Int? {
    val drm = try {
      MediaDrm(C.WIDEVINE_UUID)
    } catch (
      @Suppress("TooGenericExceptionCaught") e: Exception,
    ) {
      Log.w(TAG, "Widevine is not available on this device", e)
      return null
    }
    return try {
      when (drm.getPropertyString("securityLevel")?.trim()?.uppercase()) {
        "L1" -> 1
        "L2" -> 2
        "L3" -> 3
        else -> null
      }.also { Log.d(TAG, "Widevine security level: $it") }
    } catch (
      @Suppress("TooGenericExceptionCaught") e: Exception,
    ) {
      Log.w(TAG, "Could not read the Widevine security level", e)
      null
    } finally {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        drm.close()
      } else {
        @Suppress("DEPRECATION")
        drm.release()
      }
    }
  }
}
