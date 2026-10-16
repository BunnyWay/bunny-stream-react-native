package net.bunny.reactnative.drm

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import net.bunny.api.settings.domain.model.PlayerSettings

/**
 * Unit tests for the bridge-side [WidevinePolicy] mirror.
 *
 * Pure JVM tests — the policy functions take the device level as a
 * parameter, so no MediaDrm/Android runtime is needed. Covers the same
 * cases the SDK's own tests do upstream: level parsing rules, the L3 cap,
 * portrait orientation, and the refusal decision.
 */
class WidevinePolicyTest {

  private fun settings(
    drmEnabled: Boolean = true,
    minLevel: Int? = null,
    sdOnlyForL3: Boolean = false,
    maxSdResolution: Int? = null,
  ) = PlayerSettings(
    thumbnailUrl = "",
    controls = "",
    keyColor = 0,
    captionsFontSize = 0,
    captionsFontColor = null,
    captionsBackgroundColor = null,
    uiLanguage = "en",
    showHeatmap = false,
    fontFamily = "",
    playbackSpeeds = emptyList(),
    drmEnabled = drmEnabled,
    vastTagUrl = null,
    videoUrl = "https://vz-000.b-cdn.net/12345/video-guid/playlist.m3u8",
    seekPath = "",
    captionsPath = "",
    widevineMinClientSecurityLevel = minLevel,
    widevineSdOnlyForL3 = sdOnlyForL3,
    maxSoftwareWidevineResolution = maxSdResolution,
  )

  @Test
  fun `L3 device is capped to the library resolution on the shorter side`() {
    val cap = WidevinePolicy.maxVideoSize(
      settings(sdOnlyForL3 = true, maxSdResolution = 480),
      deviceLevel = 3,
      videoWidth = 1920,
      videoHeight = 1080,
    )
    assertEquals(Int.MAX_VALUE to 480, cap)
  }

  @Test
  fun `portrait video takes the cap on its width`() {
    val cap = WidevinePolicy.maxVideoSize(
      settings(sdOnlyForL3 = true, maxSdResolution = 480),
      deviceLevel = 3,
      videoWidth = 720,
      videoHeight = 1280,
    )
    assertEquals(480 to Int.MAX_VALUE, cap)
  }

  @Test
  fun `missing resolution falls back to the 480 default`() {
    val cap = WidevinePolicy.maxVideoSize(
      settings(sdOnlyForL3 = true),
      deviceLevel = 3,
      videoWidth = 1920,
      videoHeight = 1080,
    )
    assertEquals(Int.MAX_VALUE to 480, cap)
  }

  @Test
  fun `L1 and L2 devices are not capped`() {
    val settings = settings(sdOnlyForL3 = true, maxSdResolution = 480)
    assertNull(WidevinePolicy.maxVideoSize(settings, 1, 1920, 1080))
    assertNull(WidevinePolicy.maxVideoSize(settings, 2, 1920, 1080))
    assertNull(WidevinePolicy.maxVideoSize(settings, null, 1920, 1080))
  }

  @Test
  fun `non-DRM libraries and flag-off libraries are never capped`() {
    assertNull(
      WidevinePolicy.maxVideoSize(
        settings(drmEnabled = false, sdOnlyForL3 = true, maxSdResolution = 480),
        3,
        1920,
        1080,
      ),
    )
    assertNull(
      WidevinePolicy.maxVideoSize(settings(maxSdResolution = 480), 3, 1920, 1080),
    )
    assertNull(WidevinePolicy.maxVideoSize(null, 3, 1920, 1080))
  }

  @Test
  fun `refusal fires only below the required level`() {
    val l1Required = settings(minLevel = 1)
    assertTrue(WidevinePolicy.isSecurityLevelRefused(l1Required, 3))
    assertTrue(WidevinePolicy.isSecurityLevelRefused(l1Required, 2))
    assertFalse(WidevinePolicy.isSecurityLevelRefused(l1Required, 1))
    assertFalse(WidevinePolicy.isSecurityLevelRefused(l1Required, null))
  }

  @Test
  fun `unrestricted and non-DRM libraries never refuse`() {
    assertFalse(WidevinePolicy.isSecurityLevelRefused(settings(), 3))
    assertFalse(WidevinePolicy.isSecurityLevelRefused(settings(drmEnabled = false, minLevel = 1), 3))
    // Out-of-range values restrict nothing — only 1..3 are real levels.
    assertFalse(WidevinePolicy.isSecurityLevelRefused(settings(minLevel = 4), 3))
    assertFalse(WidevinePolicy.isSecurityLevelRefused(null, 3))
  }
}
