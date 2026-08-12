package net.bunny.reactnative.state

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Unit tests for the [transition] state machine.
 *
 * Pure JVM tests — no Android or SDK dependencies required.
 * Covers: state transitions, event emission, deduplication, illegal
 * transitions, progress normalisation, and error handling.
 */
class PlaybackStateTest {

  @Test
  fun `Idle + BUFFERING emits onBuffering and onPlaybackStateChange loading`() {
    val (next, events) = transition(
      PlaybackState.Idle,
      Media3Event.PlaybackStateChanged(
        state = Media3PlaybackState.BUFFERING,
        videoId = "v1",
        positionMs = 0,
        durationMs = 0,
      ),
    )

    assertIs<PlaybackState.Loading>(next)
    assertEquals(2, events.size)
    assertEquals("onBuffering", events[0].eventName)
    assertEquals("onPlaybackStateChange", events[1].eventName)
    assertEquals("loading", events[1].payloadBuilder()["state"])
  }

  @Test
  fun `Loading + READY emits onReady and onPlaybackStateChange ready`() {
    val (next, events) = transition(
      PlaybackState.Loading,
      Media3Event.PlaybackStateChanged(
        state = Media3PlaybackState.READY,
        videoId = "v1",
        positionMs = 0,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Ready>(next)
    assertEquals(2, events.size)
    assertEquals("onReady", events[0].eventName)
    assertEquals("v1", events[0].payloadBuilder()["videoId"])
    assertEquals(10_000L, events[0].payloadBuilder()["durationMs"])
    assertEquals("ready", events[1].payloadBuilder()["state"])
  }

  @Test
  fun `READY + READY is no-op (deduplication)`() {
    val (next, events) = transition(
      PlaybackState.Ready,
      Media3Event.PlaybackStateChanged(
        state = Media3PlaybackState.READY,
        videoId = "v1",
        positionMs = 100,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Ready>(next)
    assertTrue(events.isEmpty())
  }

  @Test
  fun `Playing + READY is no-op (deduplication from already-playing state)`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.PlaybackStateChanged(
        state = Media3PlaybackState.READY,
        videoId = "v1",
        positionMs = 100,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Playing>(next)
    assertTrue(events.isEmpty())
  }

  @Test
  fun `Ready + isPlaying=true emits onPlay and onPlaybackStateChange playing`() {
    val (next, events) = transition(
      PlaybackState.Ready,
      Media3Event.IsPlayingChanged(
        isPlaying = true,
        positionMs = 0,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Playing>(next)
    assertEquals(2, events.size)
    assertEquals("onPlay", events[0].eventName)
    assertEquals("playing", events[1].payloadBuilder()["state"])
  }

  @Test
  fun `Playing + isPlaying=false emits onPause and onPlaybackStateChange paused`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.IsPlayingChanged(
        isPlaying = false,
        positionMs = 5000,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Paused>(next)
    assertEquals(2, events.size)
    assertEquals("onPause", events[0].eventName)
    assertEquals("paused", events[1].payloadBuilder()["state"])
  }

  @Test
  fun `Loading + isPlaying=false is ignored (spurious during initial buffering)`() {
    val (next, events) = transition(
      PlaybackState.Loading,
      Media3Event.IsPlayingChanged(
        isPlaying = false,
        positionMs = 0,
        durationMs = 0,
      ),
    )

    assertIs<PlaybackState.Loading>(next)
    assertTrue(events.isEmpty())
  }

  @Test
  fun `Idle + isPlaying=false is ignored`() {
    val (next, events) = transition(
      PlaybackState.Idle,
      Media3Event.IsPlayingChanged(
        isPlaying = false,
        positionMs = 0,
        durationMs = 0,
      ),
    )

    assertIs<PlaybackState.Idle>(next)
    assertTrue(events.isEmpty())
  }

  @Test
  fun `Playing + isPlaying=true is no-op (deduplication)`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.IsPlayingChanged(
        isPlaying = true,
        positionMs = 100,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Playing>(next)
    assertTrue(events.isEmpty())
  }

  @Test
  fun `Playing + ENDED emits onEnd and onPlaybackStateChange ended`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.PlaybackStateChanged(
        state = Media3PlaybackState.ENDED,
        videoId = "v1",
        positionMs = 10_000,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Ended>(next)
    assertEquals(2, events.size)
    assertEquals("onEnd", events[0].eventName)
    assertEquals(10_000L, events[0].payloadBuilder()["positionMs"])
    assertEquals("ended", events[1].payloadBuilder()["state"])
  }

  @Test
  fun `Ended + ENDED is no-op (deduplication)`() {
    val (next, events) = transition(
      PlaybackState.Ended,
      Media3Event.PlaybackStateChanged(
        state = Media3PlaybackState.ENDED,
        videoId = "v1",
        positionMs = 10_000,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Ended>(next)
    assertTrue(events.isEmpty())
  }

  @Test
  fun `PlayerError emits onError and onPlaybackStateChange error`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.PlayerError(
        message = "Network timeout",
        nativeCode = "404",
        positionMs = 5000,
      ),
    )

    val error = assertIs<PlaybackState.Error>(next)
    assertEquals("PLAYBACK_ERROR", error.code)
    assertEquals("Network timeout", error.message)
    assertEquals("404", error.nativeCode)
    assertEquals(2, events.size)
    assertEquals("onError", events[0].eventName)
    assertEquals("PLAYBACK_ERROR", events[0].payloadBuilder()["code"])
    assertEquals("error", events[1].payloadBuilder()["state"])
  }

  @Test
  fun `VolumeChanged emits onVolumeChange and preserves state`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.VolumeChanged(volume = 0.5f, isMuted = false),
    )

    assertIs<PlaybackState.Playing>(next)
    assertEquals(1, events.size)
    assertEquals("onVolumeChange", events[0].eventName)
    assertEquals(0.5f, events[0].payloadBuilder()["volume"])
    assertEquals(false, events[0].payloadBuilder()["isMuted"])
  }

  @Test
  fun `PlaybackParametersChanged emits onPlaybackRateChange and preserves state`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.PlaybackParametersChanged(rate = 2.0f),
    )

    assertIs<PlaybackState.Playing>(next)
    assertEquals(1, events.size)
    assertEquals("onPlaybackRateChange", events[0].eventName)
    assertEquals(2.0f, events[0].payloadBuilder()["rate"])
  }

  @Test
  fun `Progress with valid duration emits onProgress with normalised progress`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.Progress(positionMs = 2500, durationMs = 10_000),
    )

    assertIs<PlaybackState.Playing>(next)
    assertEquals(1, events.size)
    assertEquals("onProgress", events[0].eventName)
    val payload = events[0].payloadBuilder()
    assertEquals(2500L, payload["positionMs"])
    assertEquals(10_000L, payload["durationMs"])
    assertEquals(0.25, payload["progress"])
  }

  @Test
  fun `Progress with zero duration is dropped`() {
    val (next, events) = transition(
      PlaybackState.Loading,
      Media3Event.Progress(positionMs = 0, durationMs = 0),
    )

    assertIs<PlaybackState.Loading>(next)
    assertTrue(events.isEmpty())
  }

  @Test
  fun `Progress beyond duration is clamped to 1`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.Progress(positionMs = 15_000, durationMs = 10_000),
    )

    assertIs<PlaybackState.Playing>(next)
    assertEquals(1.0, events[0].payloadBuilder()["progress"])
  }

  @Test
  fun `Progress with negative position is clamped to 0`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.Progress(positionMs = -100, durationMs = 10_000),
    )

    assertIs<PlaybackState.Playing>(next)
    assertEquals(0.0, events[0].payloadBuilder()["progress"])
  }

  @Test
  fun `Idle + IDLE is no-op`() {
    val (next, events) = transition(
      PlaybackState.Idle,
      Media3Event.PlaybackStateChanged(
        state = Media3PlaybackState.IDLE,
        videoId = "v1",
        positionMs = 0,
        durationMs = 0,
      ),
    )

    assertIs<PlaybackState.Idle>(next)
    assertTrue(events.isEmpty())
  }

  @Test
  fun `Playing + IDLE emits onPlaybackStateChange idle`() {
    val (next, events) = transition(
      PlaybackState.Playing,
      Media3Event.PlaybackStateChanged(
        state = Media3PlaybackState.IDLE,
        videoId = "v1",
        positionMs = 100,
        durationMs = 10_000,
      ),
    )

    assertIs<PlaybackState.Idle>(next)
    assertEquals(1, events.size)
    assertEquals("idle", events[0].payloadBuilder()["state"])
  }

  @Test
  fun `PlaybackState name property matches Codegen union`() {
    assertEquals("idle", PlaybackState.Idle.name)
    assertEquals("loading", PlaybackState.Loading.name)
    assertEquals("ready", PlaybackState.Ready.name)
    assertEquals("playing", PlaybackState.Playing.name)
    assertEquals("paused", PlaybackState.Paused.name)
    assertEquals("ended", PlaybackState.Ended.name)
    assertEquals("error", PlaybackState.Error("X", "Y").name)
  }

  @Test
  fun `Full lifecycle - load, ready, play, pause, end`() {
    var state: PlaybackState = PlaybackState.Idle
    var events: List<RnEvent>

    // BUFFERING
    val r1 = transition(state, Media3Event.PlaybackStateChanged(Media3PlaybackState.BUFFERING, "v1", 0, 0))
    state = r1.first
    assertIs<PlaybackState.Loading>(state)

    // READY
    val r2 = transition(state, Media3Event.PlaybackStateChanged(Media3PlaybackState.READY, "v1", 0, 60_000))
    state = r2.first
    assertIs<PlaybackState.Ready>(state)
    assertEquals("onReady", r2.second[0].eventName)

    // isPlaying=true
    val r3 = transition(state, Media3Event.IsPlayingChanged(true, 0, 60_000))
    state = r3.first
    assertIs<PlaybackState.Playing>(state)

    // isPlaying=false (pause)
    val r4 = transition(state, Media3Event.IsPlayingChanged(false, 30_000, 60_000))
    state = r4.first
    assertIs<PlaybackState.Paused>(state)

    // ENDED
    val r5 = transition(state, Media3Event.PlaybackStateChanged(Media3PlaybackState.ENDED, "v1", 60_000, 60_000))
    state = r5.first
    assertIs<PlaybackState.Ended>(state)
  }
}
