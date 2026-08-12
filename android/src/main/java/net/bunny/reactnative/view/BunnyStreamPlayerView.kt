package net.bunny.reactnative.view

import android.content.Context
import android.view.ViewGroup
import android.widget.FrameLayout
import net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer
import net.bunny.reactnative.commands.GenerationToken
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
 *
 * Event listener registration, command dispatch, and cleanup are wired in
 * later plan sections (5, 6, 8).
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
   * in-flight callbacks from the previous source are invalidated.
   */
  private fun reloadVideo(props: BunnyStreamPlayerProps) {
    generationToken.bump()
    player.playVideo(
      videoId = props.videoId,
      libraryId = props.libraryId,
      videoTitle = "",
      token = props.token,
      expires = props.expires,
    )
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

  // --- Cleanup (wired fully in plan section 8) ---

  /**
   * Idempotent cleanup. Called from `ViewManager.onDropViewInstance`.
   * Removes listeners and stops progress reporting.
   */
  fun cleanup() {
    generationToken.bump()
  }

  companion object {
    private val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
  }
}
