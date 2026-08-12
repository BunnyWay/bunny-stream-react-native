package net.bunny.reactnative.adapter

import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import net.bunny.bunnystreamplayer.DefaultBunnyPlayer
import net.bunny.reactnative.commands.GenerationToken
import net.bunny.reactnative.events.FabricEventEmitter
import net.bunny.reactnative.state.Media3Event
import net.bunny.reactnative.state.Media3PlaybackState
import net.bunny.reactnative.state.PlaybackState
import net.bunny.reactnative.state.RnEvent
import net.bunny.reactnative.state.transition

/**
 * Adapter that registers a Media3 [Player.Listener] on
 * [DefaultBunnyPlayer.currentPlayer] and translates callbacks into RN events
 * via the [transition] state machine.
 *
 * Why not use `BunnyPlayer.playerStateListener`?
 * The singleton `DefaultBunnyPlayer` has a single `playerStateListener` slot
 * that is occupied by the SDK's internal UI (`BunnyPlayerView`). Overwriting
 * it would break the native controls. Instead, we register a `Player.Listener`
 * directly on `currentPlayer` (the underlying `ExoPlayer`), which coexists
 * with the SDK's own listener.
 *
 * Re-attach: `currentPlayer` is recreated on each `playVideo` call. The adapter
 * must be re-attached after every source change. [attach] is idempotent and
 * safe to call multiple times; [detach] removes the listener.
 *
 * Generation safety: every callback checks [GenerationToken.isActive] before
 * dispatching, so stale callbacks from a previous source are silently dropped.
 */
class PlayerEventListener(
  private val emitter: FabricEventEmitter,
  private val generationToken: GenerationToken,
  private val videoIdProvider: () -> String,
  private val onReady: () -> Unit,
) {
  private var currentPlayer: Player? = null
  private var state: PlaybackState = PlaybackState.Idle

  private val listener = object : Player.Listener {
    override fun onPlaybackStateChanged(playbackState: Int) {
      if (!generationToken.isActive(generation)) return
      val mapped = when (playbackState) {
        Player.STATE_IDLE -> Media3PlaybackState.IDLE
        Player.STATE_BUFFERING -> Media3PlaybackState.BUFFERING
        Player.STATE_READY -> Media3PlaybackState.READY
        Player.STATE_ENDED -> Media3PlaybackState.ENDED
        else -> return
      }
      val player = currentPlayer ?: return
      val event = Media3Event.PlaybackStateChanged(
        state = mapped,
        videoId = videoIdProvider(),
        positionMs = player.currentPosition,
        durationMs = player.duration.takeIf { it > 0 } ?: 0L,
      )
      processEvent(event)
      if (mapped == Media3PlaybackState.READY) onReady()
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      if (!generationToken.isActive(generation)) return
      val player = currentPlayer ?: return
      processEvent(
        Media3Event.IsPlayingChanged(
          isPlaying = isPlaying,
          positionMs = player.currentPosition,
          durationMs = player.duration.takeIf { it > 0 } ?: 0L,
        ),
      )
    }

    override fun onPlayerErrorChanged(error: PlaybackException?) {
      if (!generationToken.isActive(generation)) return
      if (error == null) return
      val player = currentPlayer
      val positionMs = player?.currentPosition ?: 0L
      processEvent(
        Media3Event.PlayerError(
          message = error.message ?: "Unknown playback error",
          nativeCode = error.errorCodeName,
          positionMs = positionMs,
        ),
      )
    }

    override fun onVolumeChanged(volume: Float) {
      if (!generationToken.isActive(generation)) return
      val player = currentPlayer ?: return
      processEvent(
        Media3Event.VolumeChanged(
          volume = volume,
          isMuted = volume == 0f,
        ),
      )
    }

    override fun onPlaybackParametersChanged(playbackParameters: androidx.media3.common.PlaybackParameters) {
      if (!generationToken.isActive(generation)) return
      processEvent(
        Media3Event.PlaybackParametersChanged(rate = playbackParameters.speed),
      )
    }
  }

  private var generation: Long = 0L

  /**
   * Attaches the listener to [DefaultBunnyPlayer.currentPlayer].
   * Captures the current generation token so that callbacks from this attach
   * cycle can be invalidated by a later [generationToken.bump].
   *
   * Call this after every `playVideo` / source change.
   */
  fun attach() {
    detach()
    val player = DefaultBunnyPlayer.getInstance(currentPlayerContext).currentPlayer
    if (player != null) {
      currentPlayer = player
      generation = generationToken.current()
      player.addListener(listener)
    }
  }

  /**
   * Removes the listener from the current player and resets the state machine.
   */
  fun detach() {
    currentPlayer?.removeListener(listener)
    currentPlayer = null
    state = PlaybackState.Idle
  }

  /**
   * Emits a progress event. Called from the SDK's `ProgressListener` tick
   * (every ~250 ms).
   */
  fun onProgress(positionMs: Long, durationMs: Long) {
    if (!generationToken.isActive(generation)) return
    processEvent(Media3Event.Progress(positionMs, durationMs))
  }

  private fun processEvent(event: Media3Event) {
    val (newState, events) = transition(state, event)
    state = newState
    events.forEach(emitter::dispatch)
  }

  // Context is needed to access DefaultBunnyPlayer.getInstance().
  // Stored lazily on first attach; set externally before attach() is called.
  var currentPlayerContext: android.content.Context
    get() = _context ?: throw IllegalStateException("Context not set")
    set(value) {
      _context = value
    }

  private var _context: android.content.Context? = null
}

/**
 * Convenience: emits a single ad-hoc event outside the state machine
 * (e.g. for progress from the SDK's ProgressListener).
 */
@Suppress("unused")
fun FabricEventEmitter.dispatchRnEvent(eventName: String, payload: Map<String, Any?>) {
  dispatch(RnEvent(eventName) { payload })
}
