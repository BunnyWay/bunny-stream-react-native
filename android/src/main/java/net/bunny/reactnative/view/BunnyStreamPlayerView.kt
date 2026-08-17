package net.bunny.reactnative.view

import android.annotation.SuppressLint
import android.content.Context
import android.view.ContextThemeWrapper
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import kotlin.math.ceil
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
 * - A [BunnyPlayerLease] enforces single-active-instance ownership of the
 *   `DefaultBunnyPlayer` singleton. When a new view mounts, the previous
 *   owner's lease is revoked, triggering its cleanup.
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
    // Disabled: PixelCopy reads wrong pixels in RN Fabric, causing text to flip dark.
    // child.autoProgressTextColor = true
    addView(
      child,
      LayoutParams(MATCH_PARENT, MATCH_PARENT),
    )
  }

  /** Monotonic token for cancelling stale async callbacks. */
  val generationToken = GenerationToken()

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
    lease.acquire()
  }

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
    generationToken.bump()
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
   */
  @SuppressLint("UnsafeOptInUsageError")
  private fun attachWhenPlayerReady(previousPlayer: androidx.media3.common.Player?) {
    val gen = generationToken.current()
    var attempts = 0
    post {
      val poll = object : Runnable {
        override fun run() {
          if (!generationToken.isActive(gen)) return
          val cp = DefaultBunnyPlayer.getInstance(context).currentPlayer
          if (cp != null && cp !== previousPlayer) {
            eventListener?.attach()
            startProgressPolling(cp, gen)
            // Keep the original controls lifecycle: it lets the SDK finish
            // replacing Media3's initial layout with Bunny's own layout.
            postDelayed({
              applyControls(committedProps.controls)
              repairInlinePositionWidth()
              // Re-check a few times: the parent ConstraintLayout can override
              // the width on the next pass, so re-apply until it sticks.
              postDelayed({ repairInlinePositionWidth() }, 300)
              postDelayed({ repairInlinePositionWidth() }, 700)
            }, 500)
          } else if (attempts++ < 50) {
            postDelayed(this, 100)
          }
        }
      }
      post(poll)
    }
  }

  /**
   * Traverses the view hierarchy to find the [BunnyPlayerView] (Media3
   * `PlayerView`) inside the native SDK's `BunnyStreamPlayer`.
   */
  private fun findPlayerView(): androidx.media3.ui.PlayerView? {
    return player.findViewById(net.bunny.player.R.id.player_view)
      as? androidx.media3.ui.PlayerView
  }

  /** Emits position updates directly from Media3; this does not depend on the SDK UI lifecycle. */
  private fun startProgressPolling(mediaPlayer: androidx.media3.common.Player, gen: Long) {
    val poll = object : Runnable {
      override fun run() {
        if (!generationToken.isActive(gen)) return
        val duration = mediaPlayer.duration
        if (duration > 0) {
          eventListener?.onProgress(mediaPlayer.currentPosition, duration)
        }
        postDelayed(this, 250)
      }
    }
    post(poll)
  }

  /** Applies controller visibility without reloading the current video. */
  private fun applyControls(showControls: Boolean) {
    findPlayerView()?.let { playerView ->
      playerView.useController = showControls
      if (!showControls) {
        playerView.hideController()
        return
      }

      playerView.controllerShowTimeoutMs = androidx.media3.ui.PlayerControlView.DEFAULT_SHOW_TIMEOUT_MS
      playerView.showController()
      val controller = playerView.findViewById<View>(androidx.media3.ui.R.id.exo_controller)
      if (
        controller != null &&
        playerView.width > 0 &&
        playerView.height > 0 &&
        (controller.width == 0 || controller.height == 0)
      ) {
        val widthSpec = View.MeasureSpec.makeMeasureSpec(playerView.width, View.MeasureSpec.EXACTLY)
        val heightSpec = View.MeasureSpec.makeMeasureSpec(playerView.height, View.MeasureSpec.EXACTLY)
        controller.measure(widthSpec, heightSpec)
        controller.layout(0, 0, playerView.width, playerView.height)
        // The direct layout gives Media3 a non-zero controller immediately,
        // then let Android perform a normal hierarchy pass for the custom
        // Bunny ConstraintLayout children (notably exo_position).
        playerView.post {
          controller.requestLayout()
          playerView.requestLayout()
        }
      }
    }
  }

  /**
   * Bunny's custom controller can leave the visible `exo_position` TextView
   * with a zero width when it is first attached under a Fabric-hosted view.
   * The fullscreen Activity gets a fresh normal layout and is unaffected.
   *
   * We set layout params to the text's measured width, force a layout pass on
   * the controller and player view, and also directly lay out the TextView so
   * it is visible immediately even if the parent ConstraintLayout pass happens
   * asynchronously or repeatedly restores 0dp width.
   */
  private fun repairInlinePositionWidth() {
    val playerView = findPlayerView() ?: return
    val position = playerView.findViewById<android.widget.TextView>(androidx.media3.ui.R.id.exo_position)
      ?: return
    if (position.visibility != View.VISIBLE || position.width > 0) return

    val text = position.text?.toString() ?: ""
    if (text.isEmpty()) return

    val textWidth = ceil(position.paint.measureText(text)).toInt() +
      position.compoundPaddingLeft + position.compoundPaddingRight
    if (textWidth <= 0) return

    // Lock the view to its text width so ConstraintLayout can no longer keep
    // it at 0dp.
    val layoutParams = position.layoutParams
    layoutParams.width = textWidth
    position.layoutParams = layoutParams

    // Force the player view / controller to perform a new layout pass.
    val controller = playerView.findViewById<View>(androidx.media3.ui.R.id.exo_controller)
    controller?.requestLayout()
    controller?.invalidate()
    playerView.requestLayout()
    playerView.invalidate()

    // Direct layout as a safety net: the parent may not have laid this child
    // yet, so place it at the current left/top with the correct right edge.
    val top = position.top
    val bottom = position.bottom
    position.layout(position.left, top, position.left + textWidth, bottom)
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

  // --- Sizing / layout (plan section 7) ---

  /**
   * Fabric calls `measure(EXACTLY, EXACTLY)` before `layout`, so the measured
   * width/height are already the exact pixel dimensions assigned by Yoga.
   * We forward them unchanged to `setMeasuredDimension`.
   *
   * Overriding `onMeasure` (rather than relying on the default `FrameLayout`
   * implementation) guarantees that the wrapper never applies its own
   * `WRAP_CONTENT` or `AT_MOST` logic to the child — the child always receives
   * the exact React Native dimensions.
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
   * Fabric calls `layout()` after `measure()`, so the wrapper's position is
   * already set by the framework; we only need to position the child.
   */
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    if (childCount == 0) return
    val child = getChildAt(0)
    val width = right - left
    val height = bottom - top
    child.layout(0, 0, width, height)
  }

  // --- Cleanup (plan section 8) ---

  /**
   * Idempotent cleanup. Called from `ViewManager.onDropViewInstance` or from
   * the lease's [onRevoke] callback when a newer view takes over.
   *
   * - Detaches the event listener from `DefaultBunnyPlayer.currentPlayer`.
   * - Removes the progress listener from the SDK view.
   * - Drops all pending commands from the [CommandQueue].
   * - Invalidates all in-flight callbacks via [GenerationToken.bump].
   * - Releases the [BunnyPlayerLease] (no-op if already revoked by a newer view).
   *
   * The `cleanedUp` guard ensures this runs exactly once even if both
   * `onDropViewInstance` and a lease revoke fire.
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
  }

  companion object {
    private val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
  }
}
