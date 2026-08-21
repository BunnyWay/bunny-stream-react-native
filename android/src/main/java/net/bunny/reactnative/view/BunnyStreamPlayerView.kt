package net.bunny.reactnative.view

import android.annotation.SuppressLint
import android.content.Context
import android.view.ContextThemeWrapper
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import net.bunny.bunnystreamplayer.DefaultBunnyPlayer
import net.bunny.bunnystreamplayer.ui.BunnyPlayer
import net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer
import net.bunny.reactnative.adapter.PlayerEventListener
import net.bunny.reactnative.commands.CommandQueue
import net.bunny.reactnative.commands.GenerationToken
import net.bunny.reactnative.commands.PlayerCommand
import net.bunny.reactnative.events.FabricEventEmitter
import net.bunny.reactnative.ownership.BunnyPlayerLease
import net.bunny.reactnative.state.BunnyStreamPlayerProps

/**
 * React Native wrapper around the native [BunnyStreamPlayer] (SDK 4.0.0).
 *
 * Holds exactly one SDK player instance as a child with `MATCH_PARENT` in both
 * dimensions. Separates prop accumulation (individual setters called by the
 * Fabric delegate) from prop application ([commitProps], called from the
 * ViewManager's `onAfterUpdateTransaction`).
 *
 * SDK 4.0.0 migration (PLAN.md §7 Faza 2):
 * - Native controls toggle via the public `BunnyStreamPlayer.controlsEnabled`
 *   instead of reaching into the internal Media3 `PlayerView`.
 * - Progress comes from the SDK's `BunnyPlayer.ProgressListener` (the SDK polls
 *   Media3 itself every 250 ms while playing); the bridge no longer runs its
 *   own progress polling Runnable.
 * - Playback rate is set through the public `BunnyStreamPlayer.playbackSpeed`
 *   property; mute/unmute through `mute()`/`unmute()`. Volume stays on the
 *   `DefaultBunnyPlayer` singleton because the view does not expose a volume
 *   setter (PLAN.md §5 Faza 2 — isolated adapter).
 * - Public SDK callbacks (`onPlayingChanged`, `onMutedChanged`,
 *   `onPlaybackSpeedChanged`, `onVideoSizeChanged`, `onPlaybackError`) are
 *   forwarded to JS. The Media3 `Player.Listener` adapter is retained only for
 *   the state-machine semantics the SDK view does not surface directly
 *   (ready/end/buffering), per PLAN.md §5 Faza 2.
 * - The `exo_position` width repair and the 100 ms `currentPlayer` polling are
 *   kept as the minimal adapter for ready/end/buffering; the SDK view exposes
 *   no callback for `currentPlayer` recreation, so the bridge still has to
 *   discover the new ExoPlayer to attach the state-machine listener.
 *
 * Key behaviours preserved from 3.3.0:
 * - Video reload only when the committed props snapshot actually changes.
 * - [GenerationToken] invalidates stale callbacks from previous loads.
 * - `autoPlay=false` pauses after `STATE_READY`; toggling `autoPlay` for an
 *   already-loaded video calls `play`/`pause` without reloading.
 * - `play`/`pause`/`seekTo` are routed through a [CommandQueue] with a
 *   ready-gate. `setVolume`/`setPlaybackRate`/`mute`/`unmute` bypass the queue
 *   and target the [DefaultBunnyPlayer] singleton directly (available after
 *   `initialize`).
 * - A [BunnyPlayerLease] enforces single-active-instance ownership of the
 *   `DefaultBunnyPlayer` singleton.
 */
class BunnyStreamPlayerView(
  context: Context,
) : FrameLayout(context) {

  /**
   * Dark-theme wrapper so controller TextViews inflate with white text.
   * RN's DayNight theme would otherwise override `android:textColor` to dark.
   */
  private val playerContext: Context = ContextThemeWrapper(
    context,
    android.R.style.Theme_Black_NoTitleBar,
  )

  /** The native SDK player, sized to fill this wrapper. */
  val player: BunnyStreamPlayer = BunnyStreamPlayer(playerContext).also { child ->
    addView(
      child,
      LayoutParams(MATCH_PARENT, MATCH_PARENT),
    )
  }

  /** Monotonic token for cancelling stale async callbacks. */
  val generationToken = GenerationToken()

  /**
   * Last volume set via [setVolume], tracked so [onMutedChanged] can emit the
   * real volume when unmuting instead of defaulting to 1.0. Defaults to 1.0
   * (the SDK's initial volume) when [setVolume] was never called.
   */
  private var lastKnownVolume: Float = 1f

  /**
   * Ownership lease for the `DefaultBunnyPlayer` singleton.
   * Acquired on mount; revoked (via callback) when a newer view takes over;
   * released on cleanup. Centralises the single-active-instance constraint.
   */
  private val lease: BunnyPlayerLease = BunnyPlayerLease {
    // Called when a newer view acquires the lease — perform cleanup
    // but do NOT release the lease (the new owner already holds it).
    performCleanup()
  }

  /** Event emitter for Fabric direct events. Null if context is not a ReactContext. */
  private val emitter: FabricEventEmitter? = FabricEventEmitter.forView(this)

  /** Translates Media3 Player.Listener callbacks into RN events (ready/end/buffering). */
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

  /** Progress listener registered on the SDK view (tick ~250 ms while playing). */
  private val progressListener = object : BunnyPlayer.ProgressListener {
    override fun onProgressChanged(position: Long, duration: Long, progress: Float) {
      eventListener?.onProgress(position, duration)
    }
  }

  /** Idempotent cleanup guard — prevents double-cleanup from lease revoke + onDropViewInstance. */
  private var cleanedUp = false

  init {
    // Propagate LifecycleOwner from the Activity (context) to this wrapper
    // and its children BEFORE any child's onViewAttachedToWindow fires.
    // The native BunnyStreamPlayer calls findViewTreeLifecycleOwner() in its
    // onViewAttachedToWindow to register its lifecycleObserver (which drives
    // resume/pause/stop and controller visibility). Android calls children's
    // onViewAttachedToWindow before the parent's onAttachedToWindow, so we must
    // set this in init — ReactActivity implements LifecycleOwner.
    (context as? LifecycleOwner)?.let { setViewTreeLifecycleOwner(it) }
    player.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(view: View) {
        player.setProgressListener(progressListener)
      }

      override fun onViewDetachedFromWindow(view: View) = Unit
    })
    installSdkCallbacks()
    lease.acquire()
  }

  /**
   * Wires the public SDK 4.0.0 callbacks on [player] to the Fabric event
   * emitter. These complement the Media3 state-machine adapter
   * ([PlayerEventListener]), which still owns ready/end/buffering because the
   * SDK view does not surface those transitions as public callbacks.
   */
  private fun installSdkCallbacks() {
    val em = emitter ?: return
    player.onPlayingChanged = { _ ->
      // The state machine in PlayerEventListener already derives play/pause
      // from Media3's onIsPlayingChanged; forwarding here would double-emit.
      // Kept as a no-op hook for future SDK-only state sourcing (PLAN.md §5
      // Faza 2: keep event names stable while the adapter owns semantics).
    }
    player.onMutedChanged = { isMuted ->
      if (generationToken.isActive(playbackGeneration)) {
        // Emit the real volume when unmuting (tracked via [lastKnownVolume]),
        // not a hardcoded 1.0 — the user may have set volume to 0.3 before
        // muting, and unmuting should restore that value, not jump to max.
        val effectiveVolume = if (isMuted) 0f else lastKnownVolume
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onVolumeChange") {
            mapOf("volume" to effectiveVolume, "isMuted" to isMuted)
          },
        )
      }
    }
    player.onPlaybackSpeedChanged = { speed ->
      if (generationToken.isActive(playbackGeneration)) {
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onPlaybackRateChange") {
            mapOf("rate" to speed)
          },
        )
      }
    }
    player.onVideoSizeChanged = { width, height ->
      if (generationToken.isActive(playbackGeneration)) {
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onVideoSizeChange") {
            mapOf("width" to width, "height" to height)
          },
        )
      }
    }
    player.onPlaybackError = { message ->
      if (generationToken.isActive(playbackGeneration)) {
        // The Media3 adapter already emits the structured onError/onPlaybackStateChange
        // pair from onPlayerErrorChanged; this hook surfaces the SDK's human-readable
        // message for the live recovery path and future custom-error UI.
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onPlaybackError") {
            mapOf("message" to message)
          },
        )
      }
    }
  }

  /** Generation captured when the current source started loading. */
  private var playbackGeneration: Long = 0L

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // Fallback: if context was not a LifecycleOwner (e.g. wrapper context),
    // walk up the parent chain to find it.
    if (findViewTreeLifecycleOwner() == null) {
      parent?.let { (it as? View)?.findViewTreeLifecycleOwner() }?.let {
        setViewTreeLifecycleOwner(it)
      }
    }
  }

  // --- Prop accumulation fields (set by ViewManager delegate) ---

  private var pendingVideoId: String = ""
  private var pendingLibraryId: Long? = null
  private var pendingToken: String? = null
  private var pendingExpires: Long? = null
  private var pendingAutoPlay: Boolean = true
  private var pendingControls: Boolean = true

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

  fun setControls(value: Boolean) {
    pendingControls = value
  }

  // --- Prop application (called from ViewManager.onAfterUpdatedTransaction) ---

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
      controls = pendingControls,
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

    if (!sourceChanged && oldProps.controls != newProps.controls) {
      applyControls(newProps.controls)
    }
  }

  /**
   * Starts loading a new video source. Bumps the generation token so that any
   * in-flight callbacks from the previous source are invalidated, resets
   * the command queue so stale commands from the previous source are dropped,
   * and re-attaches the [PlayerEventListener] to the new `currentPlayer`.
   */
  private fun reloadVideo(props: BunnyStreamPlayerProps) {
    playbackGeneration = generationToken.bump()
    commandQueue.reset()
    applyControls(props.controls)
    val previousPlayer = DefaultBunnyPlayer.getInstance(context).currentPlayer
    player.playVideo(
      videoId = props.videoId,
      libraryId = props.libraryId,
      videoTitle = "",
      token = props.token,
      expires = props.expires,
    )
    if (!props.autoPlay) {
      commandQueue.enqueue(PlayerCommand.Pause)
    }
    attachWhenPlayerReady(previousPlayer)
  }

  /**
   * Polls [DefaultBunnyPlayer.currentPlayer] every 100ms until it becomes
   * non-null (the SDK has created the ExoPlayer), then attaches the event
   * listener.
   *
   * Retained from 3.3.0: the SDK view exposes no public callback for
   * `currentPlayer` recreation, so the bridge must discover the new ExoPlayer
   * to attach the ready/end/buffering state-machine listener. This is the
   * minimal Media3 adapter allowed by PLAN.md §5 Faza 2.
   */
  @SuppressLint("UnsafeOptInUsageError")
  private fun attachWhenPlayerReady(previousPlayer: androidx.media3.common.Player?) {
    val gen = playbackGeneration
    var attempts = 0
    post {
      val poll = object : Runnable {
        override fun run() {
          if (!generationToken.isActive(gen)) return
          val cp = DefaultBunnyPlayer.getInstance(context).currentPlayer
          if (cp != null && cp !== previousPlayer) {
            eventListener?.attach()
          } else if (attempts++ < 50) {
            postDelayed(this, 100)
          }
        }
      }
      post(poll)
    }
  }

  /** Applies controller visibility through the public SDK 4.0.0 property. */
  private fun applyControls(showControls: Boolean) {
    player.controlsEnabled = showControls
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
   * and does not depend on `STATE_READY`. The SDK view does not expose a
   * volume setter (only `mute()`/`unmute()`), so volume stays on the
   * singleton as an isolated adapter (PLAN.md §5 Faza 2).
   */
  fun setVolume(volume: Double) {
    val clamped = volume.coerceIn(0.0, 1.0).toFloat()
    lastKnownVolume = clamped
    DefaultBunnyPlayer.getInstance(context).setVolume(clamped)
  }

  /**
   * Sets playback speed through the public SDK 4.0.0 `playbackSpeed` property
   * on the view. Bypasses the command queue for the same reason as
   * [setVolume] — the view is available immediately and the SDK forwards the
   * call to the engine.
   */
  fun setPlaybackRate(rate: Double) {
    if (rate.isFinite() && rate > 0) {
      player.playbackSpeed = rate.toFloat()
    }
  }

  /** Mutes the engine via the public SDK view API. */
  fun mute() {
    player.mute()
  }

  /** Unmutes the engine via the public SDK view API. */
  fun unmute() {
    player.unmute()
  }

  /**
   * Called from the event adapter when the player reaches `STATE_READY`.
   * Drains all pending commands in FIFO order.
   */
  fun onPlayerReady() {
    commandQueue.setReady(true)
  }

  // --- Sizing / layout ---

  /**
   * Fabric calls `measure(EXACTLY, EXACTLY)` before `layout`, so the measured
   * width/height are already the exact pixel dimensions assigned by Yoga.
   * We forward them unchanged to `setMeasuredDimension`.
   */
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val width = MeasureSpec.getSize(widthMeasureSpec)
    val height = MeasureSpec.getSize(heightMeasureSpec)
    setMeasuredDimension(width, height)
    measureChildWithMargins(
      player,
      widthMeasureSpec,
      0,
      heightMeasureSpec,
      0,
    )
  }

  /**
   * Lays out the single child ([player]) to fill the wrapper exactly.
   */
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    if (childCount == 0) return
    val child = getChildAt(0)
    val width = right - left
    val height = bottom - top
    child.layout(0, 0, width, height)
  }

  // --- Cleanup ---

  /**
   * Idempotent cleanup. Called from `ViewManager.onDropViewInstance` or from
   * the lease's [onRevoke] callback when a newer view takes over.
   */
  fun cleanup() {
    lease.release()
    performCleanup()
  }

  /**
   * Internal cleanup without releasing the lease. Called from [cleanup] and
   * from the lease's [onRevoke] callback. Guarded by [cleanedUp].
   */
  private fun performCleanup() {
    if (cleanedUp) return
    cleanedUp = true
    generationToken.bump()
    commandQueue.reset()
    eventListener?.detach()
    player.setProgressListener(null)
    player.pause()
    // Detach SDK callbacks so a reused view (shouldn't happen, but defensively)
    // doesn't dispatch into a released emitter.
    player.onPlayingChanged = null
    player.onMutedChanged = null
    player.onPlaybackSpeedChanged = null
    player.onVideoSizeChanged = null
    player.onPlaybackError = null
  }

  companion object {
    private val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
  }
}
