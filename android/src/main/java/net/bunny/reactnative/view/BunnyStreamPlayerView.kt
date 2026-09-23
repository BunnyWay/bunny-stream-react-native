package net.bunny.reactnative.view

import android.annotation.SuppressLint
import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Rect
import android.os.Build
import android.util.Log
import android.util.Rational
import android.view.ContextThemeWrapper
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.ui.PlayerControlView
import androidx.media3.ui.PlayerView
import net.bunny.bunnystreamplayer.DefaultBunnyPlayer
import net.bunny.bunnystreamplayer.PlayerType
import net.bunny.bunnystreamplayer.ui.BunnyPlayer
import net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer
import net.bunny.bunnystreamplayer.ui.widget.BunnyPlayerView
import net.bunny.api.playback.PlaybackPosition
import net.bunny.api.playback.ResumeConfig
import net.bunny.api.playback.ResumePositionListener
import net.bunny.bunnystreamplayer.model.Chapter
import net.bunny.bunnystreamplayer.model.Moment
import net.bunny.bunnystreamplayer.model.RetentionGraphEntry
import net.bunny.reactnative.R
import net.bunny.reactnative.adapter.PlayerEventListener
import net.bunny.reactnative.commands.CommandQueue
import net.bunny.reactnative.commands.GenerationToken
import net.bunny.reactnative.commands.PlayerCommand
import net.bunny.reactnative.events.FabricEventEmitter
import net.bunny.reactnative.ownership.BunnyPlayerLease
import net.bunny.reactnative.state.BunnyStreamPlayerProps
import net.bunny.reactnative.state.toJsonString
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.ceil

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
   *
   * We use a custom [BunnyReactNativePlayerTheme] that extends
   * [Theme_AppCompat_NoActionBar] because the SDK's
   * `androidx.appcompat.widget.PopupMenu` (opened by the settings gear) only
   * reliably renders a dark popup from an AppCompat parent theme. Platform
   * `Theme.Material` was leaving the popup background white while the text
   * stayed white, producing white-on-white menu items.
   */
  private val playerContext: Context = ContextThemeWrapper(
    context,
    R.style.BunnyReactNativePlayerTheme,
  )

  /** The native SDK player, sized to fill this wrapper. */
  val player: BunnyStreamPlayer = BunnyStreamPlayer(playerContext).also { child ->
    // White progress/duration text with a dark drop shadow — the SDK draws a
    // black shadow behind the readout, giving the "double text" effect (white
    // text with a dark halo) like YouTube's player controls. The popup menu
    // still follows the system DayNight theme; this color choice is for the
    // progress bar readout only.
    child.autoProgressTextColor = false
    child.progressTextColor = Color.WHITE
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

    // Phase 6 — chapters, moments, retention graph (Android-only events).
    // Codegen does not support arrays in event payloads, so the lists are
    // serialized as JSON strings and deserialized on the JS side.
    player.onChaptersUpdated = { chapters ->
      if (generationToken.isActive(playbackGeneration)) {
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onChaptersUpdated") {
            mapOf("chapters" to chapters.chaptersToJson())
          },
        )
      }
    }
    player.onMomentsUpdated = { moments ->
      if (generationToken.isActive(playbackGeneration)) {
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onMomentsUpdated") {
            mapOf("moments" to moments.momentsToJson())
          },
        )
      }
    }
    player.onRetentionGraphUpdated = { points ->
      if (generationToken.isActive(playbackGeneration)) {
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onRetentionGraphUpdated") {
            mapOf("points" to points.retentionToJson())
          },
        )
      }
    }

    // Phase 7 — cast handover. The SDK fires this when playback moves between
    // the local engine and a Chromecast CastPlayer (Android-only; iOS never
    // surfaces AirPlay/external-playback state).
    player.onPlayerTypeChanged = { playerType ->
      if (generationToken.isActive(playbackGeneration)) {
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onPlayerTypeChange") {
            mapOf(
              "playerType" to when (playerType) {
                PlayerType.CAST_PLAYER -> "cast"
                else -> "default"
              },
            )
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
  private var pendingResumeConfig: String? = null
  private var resumeConfigEnabled: Boolean = false
  private var pendingUseNativeTvPlayer: Boolean = false

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

  fun setResumeConfig(value: String?) {
    pendingResumeConfig = value
  }

  fun setUseNativeTvPlayer(value: Boolean) {
    pendingUseNativeTvPlayer = value
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
      useNativeTvPlayer = pendingUseNativeTvPlayer,
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

    // Phase 6 — resume position: enable/disable the native SDK's
    // PlaybackPositionManager based on the resumeConfig prop.
    applyResumeConfig()
  }

  /**
   * Starts loading a new video source. Bumps the generation token so that any
   * in-flight callbacks from the previous source are invalidated, resets
   * the command queue so stale commands from the previous source are dropped,
   * and re-attaches the [PlayerEventListener] to the new `currentPlayer`.
   */
  private fun reloadVideo(props: BunnyStreamPlayerProps) {
    playbackGeneration = generationToken.bump()
    controllerShownForGeneration = -1L
    commandQueue.reset()
    applyControls(props.controls)
    val previousPlayer = DefaultBunnyPlayer.getInstance(context).currentPlayer
    if (props.useNativeTvPlayer) {
      // Phase 7 — Android TV: `playVideoWithTVDetection` launches the
      // `net.bunny:tv` activity via reflection on leanback devices when the
      // artifact is on the classpath; falls back to `playVideo` otherwise.
      player.playVideoWithTVDetection(
        videoId = props.videoId,
        libraryId = props.libraryId,
        token = props.token,
        expires = props.expires,
      )
    } else {
      player.playVideo(
        videoId = props.videoId,
        libraryId = props.libraryId,
        videoTitle = "",
        token = props.token,
        expires = props.expires,
      )
    }
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
            restoreNativeControllerLayout()
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
   * Enables or disables the native SDK resume position manager based on the
   * `resumeConfig` prop. When the prop is a JSON string, parses it into a
   * [ResumeConfig] and calls [BunnyStreamPlayer.enableResumePosition]. When
   * null/empty, disables resume position if it was previously enabled.
   */
  private fun applyResumeConfig() {
    val json = pendingResumeConfig
    if (json.isNullOrBlank()) {
      if (resumeConfigEnabled) {
        player.disableResumePosition()
        resumeConfigEnabled = false
      }
      return
    }
    if (resumeConfigEnabled) {
      // Already enabled — SDK does not support updating config on the fly.
      return
    }
    val config = parseResumeConfig(json) ?: ResumeConfig()
    val em = emitter
    player.enableResumePosition(config) { position, confirmResume ->
      if (em != null && generationToken.isActive(playbackGeneration)) {
        em.dispatch(
          net.bunny.reactnative.state.RnEvent("onResumePositionAvailable") {
            mapOf("position" to position.toJsonString())
          },
        )
      }
      // Auto-confirm: the JS side decides whether to seek via seekTo.
      confirmResume(false)
    }
    resumeConfigEnabled = true
  }

  private fun parseResumeConfig(json: String): ResumeConfig? {
    return try {
      val obj = JSONObject(json)
      ResumeConfig(
        retentionDays = obj.optInt("retentionDays", 7),
        minimumWatchTime = obj.optLong("minimumWatchMs", 30_000L),
        resumeThreshold = obj.optDouble("resumeThreshold", 0.05).toFloat(),
        nearEndThreshold = obj.optDouble("nearEndThreshold", 0.95).toFloat(),
        enableAutoSave = obj.optBoolean("enableAutoSave", true),
        saveInterval = obj.optLong("saveIntervalMs", 10_000L),
      )
    } catch (_: Exception) {
      null
    }
  }

  /**
   * Compatibility adapter for SDK 4.0.0: setting `controlsEnabled = true`
   * currently only changes Media3's `useController` flag. Under Fabric the
   * controller can therefore remain hidden or retain a zero-width position
   * label after the playback engine is replaced.
   *
   * This method only repairs the controller **layout** (measure/layout the
   * controller view so it has non-zero dimensions). It deliberately does NOT
   * call `showController()` — that is deferred to [showControllerAfterReady],
   * which runs after STATE_READY. Calling `showController()` during BUFFERING
   * causes Media3 to hide `exo_bottom_bar` (while keeping `exo_center_controls`
   * visible), producing the "bottom bar flickers then disappears, center play
   * button stays for 5s" symptom. Showing the controller only after STATE_READY
   * ensures the full controller (bottom bar + center) is visible and the 5 s
   * auto-hide timer starts at the right moment.
   *
   * Workaround for a Media3 layout quirk (still present in SDK 4.0.0): after
   * the engine is replaced, `useController = true` does not re-measure the
   * controller view, leaving it at zero size until the next touch.
   */
  private fun restoreNativeControllerLayout() {
    postDelayed({
      val playerView = findPlayerView() ?: return@postDelayed
      val showControls = committedProps.controls
      playerView.useController = showControls
      if (!showControls) {
        playerView.hideController()
        return@postDelayed
      }

      // Only repair layout here — do NOT call showController() during BUFFERING.
      // showController() is deferred to showControllerAfterReady() (called from
      // onPlayerReady after STATE_READY) to avoid Media3 hiding exo_bottom_bar
      // during the buffering state.
      val controller = playerView.findViewById<View>(androidx.media3.ui.R.id.exo_controller)
      if (controller != null && playerView.width > 0 && playerView.height > 0) {
        val widthSpec = MeasureSpec.makeMeasureSpec(playerView.width, MeasureSpec.EXACTLY)
        val heightSpec = MeasureSpec.makeMeasureSpec(playerView.height, MeasureSpec.EXACTLY)
        controller.measure(widthSpec, heightSpec)
        controller.layout(0, 0, playerView.width, playerView.height)
        controller.requestLayout()
      }
      playerView.requestLayout()
      repairInlinePositionWidth(playerView)
      postDelayed({ repairInlinePositionWidth(playerView) }, 300)
      postDelayed({ repairInlinePositionWidth(playerView) }, 700)

      // Hide the controller during BUFFERING. The SDK shows it automatically
      // when the player attaches, but Media3 hides exo_bottom_bar during
      // BUFFERING (while keeping exo_center_controls visible), producing a
      // split visibility state (center play button only). Hiding the whole
      // controller here prevents that flicker; showControllerAfterReady()
      // will show it with full controls after STATE_READY.
      playerView.hideController()
    }, 500)
  }

  /**
   * Shows the controller after the player reaches STATE_READY. Called from
   * [onPlayerReady]. This is split from [restoreNativeControllerLayout] because
   * calling `showController()` during BUFFERING causes Media3 to hide the
   * bottom bar (`exo_bottom_bar`) while keeping the center play/pause button
   * (`exo_center_controls`) visible — producing a split controls visibility
   * state and a flicker when the auto-hide timer fires.
   *
   * Guarded by [controllerShownForGeneration] so we only show once per source
   * load (a single load may fire onPlayerReady + multiple onIsPlayingChanged).
   */
  private var controllerShownForGeneration: Long = -1L

  private fun showControllerAfterReady() {
    if (controllerShownForGeneration == playbackGeneration) return
    if (!committedProps.controls) return
    controllerShownForGeneration = playbackGeneration
    val playerView = findPlayerView() ?: return
    playerView.controllerShowTimeoutMs = PlayerControlView.DEFAULT_SHOW_TIMEOUT_MS
    // Force-hide then show to reset Media3's internal controller visibility
    // state. During BUFFERING, Media3 hides exo_bottom_bar while keeping
    // exo_center_controls visible. After STATE_READY, showController() alone
    // does not restore the bottom bar because the controller was already
    // "visible" (just with a split sub-view state). hideController() →
    // showController() forces a full visibility cycle that restores all
    // sub-views.
    playerView.hideController()
    playerView.showController()

    // Explicitly restore exo_bottom_bar visibility — Media3 may have left it
    // INVISIBLE from the BUFFERING state and showController() doesn't always
    // reset sub-view visibility.
    val bottomBar = playerView.findViewById<View>(androidx.media3.ui.R.id.exo_bottom_bar)
    if (bottomBar != null && bottomBar.visibility != View.VISIBLE) {
      bottomBar.visibility = View.VISIBLE
    }
    val centerControls = playerView.findViewById<View>(androidx.media3.ui.R.id.exo_center_controls)
    if (centerControls != null && centerControls.visibility != View.VISIBLE) {
      centerControls.visibility = View.VISIBLE
    }
  }

  private fun findPlayerView(): PlayerView? =
    player.findViewById<BunnyPlayerView>(net.bunny.player.R.id.player_view)

  /** Repairs the SDK controller's position label when Fabric leaves it at 0 px. */
  private fun repairInlinePositionWidth(playerView: PlayerView) {
    val position = playerView.findViewById<TextView>(androidx.media3.ui.R.id.exo_position)
      ?: return
    if (position.visibility != View.VISIBLE || position.width > 0) return

    val text = position.text?.toString().orEmpty()
    if (text.isEmpty()) return
    val textWidth = ceil(position.paint.measureText(text)).toInt() +
      position.compoundPaddingLeft + position.compoundPaddingRight
    if (textWidth <= 0) return

    position.layoutParams = position.layoutParams.also { it.width = textWidth }
    playerView.findViewById<View>(androidx.media3.ui.R.id.exo_controller)?.requestLayout()
    playerView.requestLayout()
    position.layout(position.left, position.top, position.left + textWidth, position.bottom)
  }

  /**
   * Extracts only the props that determine the video source (identity).
   * `autoPlay` is excluded — it controls playback state, not source.
   */
  private fun sourceRelevantProps(props: BunnyStreamPlayerProps) =
    SourceKey(props.videoId, props.libraryId, props.token, props.expires, props.useNativeTvPlayer)

  private data class SourceKey(
    val videoId: String,
    val libraryId: Long?,
    val token: String?,
    val expires: Long?,
    // Toggling TV detection must reload so the routing takes effect for the
    // current source.
    val useNativeTvPlayer: Boolean,
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
   * Enters picture-in-picture on the host activity (Phase 7 — Android-only).
   *
   * The SDK view keeps its own PiP button private, but entering PiP is an
   * `Activity` API — the SDK's lifecycle observer keeps playback alive in PiP
   * regardless of who triggered the transition. Requires API 26+ and the host
   * activity to declare `android:supportsPictureInPicture="true"`. No-op when
   * unsupported or no host activity is reachable.
   */
  fun enterPiP() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val activity = findHostActivity() ?: run {
      Log.w(TAG, "Cannot enter PiP — no host Activity")
      return
    }
    if (!activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return
    try {
      val params = PictureInPictureParams.Builder()
        .setAspectRatio(Rational(16, 9))
        // The system animates the shrink from this rect instead of the whole
        // activity (same hint the SDK's private enterPip uses).
        .setSourceRectHint(Rect().also(::getGlobalVisibleRect))
        .build()
      activity.enterPictureInPictureMode(params)
    } catch (e: Exception) {
      Log.w(TAG, "Failed to enter PiP: ${e.message}")
    }
  }

  /**
   * Applies a video-quality constraint on the engine (Phase 8 — Android-only).
   *
   * The SDK exposes the media3 engine through the public
   * `BunnyPlayer.currentPlayer`, documented as the escape hatch for "direct
   * control over tracks, quality, volume or speed". We set
   * [TrackSelectionParameters] on it: a max size/bitrate caps the adaptive
   * track selection, "auto" clears the constraint.
   *
   * The JSON payload mirrors the JS `VideoQualityPreference` union:
   * `{"mode":"auto"}` | `{"mode":"height","height":720}` |
   * `{"mode":"bitrate","bitrate":N}` | `{"mode":"size","width":W,"height":H}`.
   * While casting, [currentPlayer] is the cast player — the constraint is a
   * no-op there and reapplies when playback returns to the local engine.
   */
  fun setVideoQuality(qualityJson: String) {
    val engine = DefaultBunnyPlayer.getInstance(context).currentPlayer ?: return
    val params = try {
      val obj = JSONObject(qualityJson)
      when (obj.optString("mode")) {
        "auto" -> engine.trackSelectionParameters.buildUpon()
          .setMaxVideoSize(Int.MAX_VALUE, Int.MAX_VALUE)
          .setMaxVideoBitrate(Int.MAX_VALUE)
          .build()
        "height" -> engine.trackSelectionParameters.buildUpon()
          .setMaxVideoSize(Int.MAX_VALUE, obj.getInt("height"))
          .build()
        "bitrate" -> engine.trackSelectionParameters.buildUpon()
          .setMaxVideoBitrate(obj.getInt("bitrate"))
          .build()
        "size" -> engine.trackSelectionParameters.buildUpon()
          .setMaxVideoSize(obj.getInt("width"), obj.getInt("height"))
          .build()
        else -> {
          Log.w(TAG, "setVideoQuality: unknown mode in $qualityJson")
          return
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "setVideoQuality: invalid payload $qualityJson: ${e.message}")
      return
    }
    engine.trackSelectionParameters = params
  }

  /** Walks the context chain to find the hosting [Activity], or null. */
  private fun findHostActivity(): Activity? {
    var ctx: Context? = context
    while (ctx is ContextWrapper) {
      if (ctx is Activity) return ctx
      ctx = ctx.baseContext
    }
    return null
  }

  /**
   * Called from the event adapter when the player reaches `STATE_READY`.
   * Drains all pending commands in FIFO order.
   */
  fun onPlayerReady() {
    commandQueue.setReady(true)
    showControllerAfterReady()
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
    player.autoProgressTextColor = false
    player.pause()
    // Detach SDK callbacks so a reused view (shouldn't happen, but defensively)
    // doesn't dispatch into a released emitter.
    player.onPlayingChanged = null
    player.onMutedChanged = null
    player.onPlaybackSpeedChanged = null
    player.onVideoSizeChanged = null
    player.onPlaybackError = null
    // Phase 6 — detach chapters/moments/retention/resume callbacks.
    player.onChaptersUpdated = null
    player.onMomentsUpdated = null
    player.onRetentionGraphUpdated = null
    // Phase 7 — detach the cast handover callback.
    player.onPlayerTypeChanged = null
    if (resumeConfigEnabled) {
      player.disableResumePosition()
      resumeConfigEnabled = false
    }
  }

  companion object {
    private const val TAG = "BunnyStreamPlayerView"
    private val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
  }
}

// --- Phase 6: model → JSON serializers for Fabric events ---
// Codegen does not support arrays in event payloads, so lists are serialized
// as JSON strings and deserialized on the JS side.

private fun List<Chapter>.chaptersToJson(): String {
  val arr = JSONArray()
  for (chapter in this) {
    arr.put(JSONObject().apply {
      put("startTimeMs", chapter.startTimeMs)
      put("endTimeMs", chapter.endTimeMs)
      put("title", chapter.title)
    })
  }
  return arr.toString()
}

private fun List<Moment>.momentsToJson(): String {
  val arr = JSONArray()
  for (moment in this) {
    arr.put(JSONObject().apply {
      put("label", moment.label)
      put("timestampMs", moment.timestamp)
    })
  }
  return arr.toString()
}

private fun List<RetentionGraphEntry>.retentionToJson(): String {
  val arr = JSONArray()
  for (entry in this) {
    arr.put(JSONObject().apply {
      put("x", entry.x)
      put("y", entry.y)
    })
  }
  return arr.toString()
}
