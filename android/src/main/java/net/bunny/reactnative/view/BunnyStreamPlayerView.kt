package net.bunny.reactnative.view

import android.content.Context
import android.view.ViewGroup
import android.widget.FrameLayout
import net.bunny.bunnystreamplayer.DefaultBunnyPlayer
import net.bunny.bunnystreamplayer.ui.BunnyPlayer
import net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer
import net.bunny.reactnative.adapter.PlayerEventListener
import net.bunny.reactnative.commands.CommandQueue
import net.bunny.reactnative.commands.GenerationToken
import net.bunny.reactnative.commands.PlayerCommand
import net.bunny.reactnative.events.FabricEventEmitter
import net.bunny.reactnative.state.BunnyStreamPlayerProps

/**
 * React Native wrapper around the native [BunnyStreamPlayer].
 *
 * Holds exactly one SDK player instance as a child with `MATCH_PARENT` in both
 * dimensions. Separates prop accumulation (individual setters called by the
 * Fabric delegate) from prop application ([commitProps], called from the
 * ViewManager's `onAfterUpdateTransaction`).
 *
 * Key behaviours:
 * - Video reload only when the committed props snapshot actually changes.
 * - [GenerationToken] invalidates stale callbacks from previous loads.
 * - `autoPlay=false` pauses after `STATE_READY`; toggling `autoPlay` for an
 *   already-loaded video calls `play`/`pause` without reloading.
 * - `play`/`pause`/`seekTo` are routed through a [CommandQueue] with a
 *   ready-gate: before `STATE_READY` they are held and drained once the
 *   player becomes ready. `setVolume`/`setPlaybackRate` bypass the queue
 *   and target the [DefaultBunnyPlayer] singleton directly.
 * - A [PlayerEventListener] registers `Player.Listener` on
 *   `DefaultBunnyPlayer.currentPlayer` (not the SDK's `playerStateListener`
 *   slot, which is occupied by the native UI) and translates Media3 callbacks
 *   into RN direct events via the state machine.
 *
 * Full singleton ownership / lease is wired in plan section 8.
 */
class BunnyStreamPlayerView(
  context: Context,
) : FrameLayout(context) {

  /** The native SDK player, sized to fill this wrapper. */
  val player: BunnyStreamPlayer = BunnyStreamPlayer(context).also { child ->
    addView(
      child,
      LayoutParams(MATCH_PARENT, MATCH_PARENT),
    )
  }

  /** Monotonic token for cancelling stale async callbacks. */
  val generationToken = GenerationToken()

  /** Event emitter for Fabric direct events. Null if context is not a ReactContext. */
  private val emitter: FabricEventEmitter? = FabricEventEmitter.forView(this)

  /** Translates Media3 Player.Listener callbacks into RN events. */
  private val eventListener: PlayerEventListener? = emitter?.let { em ->
    PlayerEventListener(
      emitter = em,
      generationToken = generationToken,
      videoIdProvider = { committedProps.videoId },
      onReady = { onPlayerReady() },
    ).also { it.currentPlayerContext = context }
  }

  /** Queue for player commands that depend on `STATE_READY`. */
  private val commandQueue = CommandQueue { cmd ->
    when (cmd) {
      is PlayerCommand.Play -> player.play()
      is PlayerCommand.Pause -> player.pause()
      is PlayerCommand.SeekTo -> player.seekTo(cmd.positionMs)
    }
  }

  /** Progress listener registered on the SDK view (tick ~250 ms). */
  private val progressListener = object : BunnyPlayer.ProgressListener {
    override fun onProgressChanged(position: Long, duration: Long, progress: Float) {
      eventListener?.onProgress(position, duration)
    }
  }

  init {
    player.setProgressListener(progressListener)
  }

  // --- Prop accumulation fields (set by ViewManager delegate) ---

  private var pendingVideoId: String = ""
  private var pendingLibraryId: Long? = null
  private var pendingToken: String? = null
  private var pendingExpires: Long? = null
  private var pendingAutoPlay: Boolean = true

  /** Last committed props snapshot. */
  private var committedProps: BunnyStreamPlayerProps = BunnyStreamPlayerProps.EMPTY

  // --- Setters called by the ViewManager delegate ---

  fun setVideoId(value: String?) {
    pendingVideoId = value.orEmpty()
  }

  fun setLibraryId(value: Double) {
    pendingLibraryId = if (value.isFinite() && value > 0 && value % 1.0 == 0.0) {
      value.toLong()
    } else {
      null
    }
  }

  fun setToken(value: String?) {
    pendingToken = value
  }

  fun setExpires(value: Double) {
    pendingExpires = if (value.isFinite() && value >= 0 && value % 1.0 == 0.0) {
      value.toLong()
    } else {
      null
    }
  }

  fun setAutoPlay(value: Boolean) {
    pendingAutoPlay = value
  }

  // --- Prop application (called from ViewManager.onAfterUpdateTransaction) ---

  /**
   * Snapshots the accumulated prop fields into an immutable [BunnyStreamPlayerProps],
   * compares with the last committed snapshot, and reloads the video only when
   * the source-relevant fields have changed.
   *
   * `autoPlay`-only changes do NOT trigger a reload: if the video is already
   * loaded, a `false → true` transition calls `play()` and `true → false`
   * calls `pause()`, without re-fetching.
   */
  fun commitProps() {
    val newProps = BunnyStreamPlayerProps(
      videoId = pendingVideoId,
      libraryId = pendingLibraryId,
      token = pendingToken,
      expires = pendingExpires,
      autoPlay = pendingAutoPlay,
    )

    val oldProps = committedProps
    committedProps = newProps

    if (newProps.videoId.isBlank()) {
      return
    }

    val sourceChanged = sourceRelevantProps(oldProps) != sourceRelevantProps(newProps)

    if (sourceChanged) {
      reloadVideo(newProps)
    } else if (oldProps.autoPlay != newProps.autoPlay) {
      // autoPlay toggled for the same loaded video — no reload
      if (newProps.autoPlay) player.play() else player.pause()
    }
  }

  /**
   * Starts loading a new video source. Bumps the generation token so that any
   * in-flight callbacks from the previous source are invalidated, resets
   * the command queue so stale commands from the previous source are dropped,
   * and re-attaches the [PlayerEventListener] to the new `currentPlayer`.
   */
  private fun reloadVideo(props: BunnyStreamPlayerProps) {
    generationToken.bump()
    commandQueue.reset()
    player.playVideo(
      videoId = props.videoId,
      libraryId = props.libraryId,
      videoTitle = "",
      token = props.token,
      expires = props.expires,
    )
    // currentPlayer is recreated by the SDK on playVideo — re-attach.
    eventListener?.attach()
  }

  /**
   * Extracts only the props that determine the video source (identity).
   * `autoPlay` is excluded — it controls playback state, not source.
   */
  private fun sourceRelevantProps(props: BunnyStreamPlayerProps) =
    SourceKey(props.videoId, props.libraryId, props.token, props.expires)

  private data class SourceKey(
    val videoId: String,
    val libraryId: Long?,
    val token: String?,
    val expires: Long?,
  )

  // --- Commands (called by ViewManager, dispatched to player) ---

  /**
   * Enqueues `Play` on the command queue. If the player is ready, executes
   * immediately; otherwise holds until [setReady]`true`.
   */
  fun play() {
    commandQueue.enqueue(PlayerCommand.Play)
  }

  /**
   * Enqueues `Pause` on the command queue. If the player is ready, executes
   * immediately; otherwise holds until [setReady]`true`.
   */
  fun pause() {
    commandQueue.enqueue(PlayerCommand.Pause)
  }

  /**
   * Enqueues `SeekTo` on the command queue after validating the position.
   * If the player is ready, executes immediately; otherwise holds until
   * [setReady]`true`.
   */
  fun seekTo(positionMs: Double) {
    if (positionMs.isFinite() && positionMs >= 0) {
      commandQueue.enqueue(PlayerCommand.SeekTo(positionMs.toLong()))
    }
  }

  /**
   * Sets volume on the [DefaultBunnyPlayer] singleton directly — bypasses
   * the command queue because the singleton is available after `initialize`
   * and does not depend on `STATE_READY`.
   */
  fun setVolume(volume: Double) {
    val clamped = volume.coerceIn(0.0, 1.0).toFloat()
    DefaultBunnyPlayer.getInstance(context).setVolume(clamped)
  }

  /**
   * Sets playback speed on the [DefaultBunnyPlayer] singleton directly —
   * bypasses the command queue for the same reason as [setVolume].
   */
  fun setPlaybackRate(rate: Double) {
    if (rate.isFinite() && rate > 0) {
      DefaultBunnyPlayer.getInstance(context).setSpeed(rate.toFloat())
    }
  }

  /**
   * Called from the event adapter (plan section 6) when the player reaches
   * `STATE_READY`. Drains all pending commands in FIFO order.
   */
  fun onPlayerReady() {
    commandQueue.setReady(true)
  }

  // --- Cleanup (wired fully in plan section 8) ---

  /**
   * Idempotent cleanup. Called from `ViewManager.onDropViewInstance`.
   * Detaches the event listener, removes the progress listener, drops
   * pending commands, and invalidates all in-flight callbacks.
   */
  fun cleanup() {
    generationToken.bump()
    commandQueue.reset()
    eventListener?.detach()
    player.setProgressListener(null)
  }

  companion object {
    private val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
  }
}
