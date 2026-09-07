package net.bunny.reactnative.state

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LivePlaybackSpeedTest {
  @Test
  fun `resets accelerated playback while live is active`() {
    assertTrue(requiresLiveSpeedReset(isLivePlaybackActive = true, speed = 2.0f))
  }

  @Test
  fun `keeps normal playback while live is active`() {
    assertFalse(requiresLiveSpeedReset(isLivePlaybackActive = true, speed = 1.0f))
  }

  @Test
  fun `does not reset remembered speed outside active live playback`() {
    assertFalse(requiresLiveSpeedReset(isLivePlaybackActive = false, speed = 2.0f))
  }
}
