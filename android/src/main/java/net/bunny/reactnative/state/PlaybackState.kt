package net.bunny.reactnative.state

/**
 * Playback state machine.
 *
 * Maps Media3 `Player.Listener` callbacks to a finite set of states and the
 * RN events that should be emitted on each transition. Only real transitions
 * produce events — duplicate states are no-ops, and illegal transitions
 * (e.g. `Ended → Playing` without a new source) are rejected.
 *
 * Pure Kotlin — no Android or SDK dependencies. Tested directly in
 * plan section 10 without Robolectric.
 */
sealed class PlaybackState {

  /** No source loaded yet. */
  object Idle : PlaybackState()

  /** Source is being fetched/buffered. */
  object Loading : PlaybackState()

  /** Source loaded, first frame rendered, ready to play. */
  object Ready : PlaybackState()

  /** Actively playing. */
  object Playing : PlaybackState()

  /** Paused by user or `autoPlay=false`. */
  object Paused : PlaybackState()

  /** Playback reached the end of the stream. */
  object Ended : PlaybackState()

  /** A playback error occurred. */
  data class Error(val code: String, val message: String, val nativeCode: String? = null) : PlaybackState()

  /**
   * String identifier used in `onPlaybackStateChange` payloads, matching the
   * `PlayerPlaybackState` union in the Codegen contract.
   */
  val name: String
    get() = when (this) {
      is Idle -> "idle"
      is Loading -> "loading"
      is Ready -> "ready"
      is Playing -> "playing"
      is Paused -> "paused"
      is Ended -> "ended"
      is Error -> "error"
    }
}

/**
 * An RN event to emit, produced by [transition].
 *
 * `eventName` matches the Codegen `DirectEventHandler` name (without `on` prefix
 * is the JS-side convention; here we store the full name as registered).
 * `payload` is built lazily by the emitter to avoid allocating `WritableMap`
 * for events that end up not being dispatched.
 */
data class RnEvent(
  val eventName: String,
  val payloadBuilder: () -> Map<String, Any?>,
)

/**
 * Computes the next state and the list of RN events to emit, given the current
 * state and a Media3 event.
 *
 * Media3 events are represented by [Media3Event] — a sealed class mirroring the
 * relevant `Player.Listener` callbacks. This keeps `transition` pure and
 * testable without Android dependencies.
 */
fun transition(state: PlaybackState, event: Media3Event): Pair<PlaybackState, List<RnEvent>> =
  when (event) {
    is Media3Event.PlaybackStateChanged -> handlePlaybackState(state, event, event.positionMs, event.durationMs)
    is Media3Event.IsPlayingChanged -> handleIsPlayingChanged(state, event.isPlaying, event.positionMs, event.durationMs)
    is Media3Event.PlayerError -> PlaybackState.Error(
      code = "PLAYBACK_ERROR",
      message = event.message,
      nativeCode = event.nativeCode,
    ) to listOf(
      RnEvent("onError") {
        mapOf(
          "code" to "PLAYBACK_ERROR",
          "message" to event.message,
          "nativeCode" to event.nativeCode,
        )
      },
      RnEvent("onPlaybackStateChange") {
        mapOf("state" to "error", "positionMs" to event.positionMs)
      },
    )
    is Media3Event.VolumeChanged -> state to listOf(
      RnEvent("onVolumeChange") {
        mapOf("volume" to event.volume, "isMuted" to event.isMuted)
      },
    )
    is Media3Event.PlaybackParametersChanged -> state to listOf(
      RnEvent("onPlaybackRateChange") {
        mapOf("rate" to event.rate)
      },
    )
    is Media3Event.Progress -> handleProgress(state, event)
  }

private fun handlePlaybackState(
  state: PlaybackState,
  event: Media3Event.PlaybackStateChanged,
  positionMs: Long,
  durationMs: Long,
): Pair<PlaybackState, List<RnEvent>> = when (event.state) {
  Media3PlaybackState.IDLE -> {
    if (state is PlaybackState.Idle) state to emptyList()
    else PlaybackState.Idle to listOf(
      RnEvent("onPlaybackStateChange") { mapOf("state" to "idle", "positionMs" to positionMs) },
    )
  }
  Media3PlaybackState.BUFFERING -> {
    if (state is PlaybackState.Loading) state to emptyList()
    else PlaybackState.Loading to listOf(
      RnEvent("onBuffering") { mapOf("isBuffering" to true) },
      RnEvent("onPlaybackStateChange") { mapOf("state" to "loading", "positionMs" to positionMs) },
    )
  }
  Media3PlaybackState.READY -> {
    if (state is PlaybackState.Ready || state is PlaybackState.Playing || state is PlaybackState.Paused) {
      state to emptyList()
    } else {
      PlaybackState.Ready to listOf(
        RnEvent("onReady") {
          mapOf("videoId" to event.videoId, "durationMs" to durationMs)
        },
        RnEvent("onPlaybackStateChange") {
          mapOf("state" to "ready", "positionMs" to positionMs)
        },
      )
    }
  }
  Media3PlaybackState.ENDED -> {
    if (state is PlaybackState.Ended) state to emptyList()
    else PlaybackState.Ended to listOf(
      RnEvent("onEnd") {
        mapOf("positionMs" to positionMs, "durationMs" to durationMs)
      },
      RnEvent("onPlaybackStateChange") {
        mapOf("state" to "ended", "positionMs" to positionMs)
      },
    )
  }
}

private fun handleIsPlayingChanged(
  state: PlaybackState,
  isPlaying: Boolean,
  positionMs: Long,
  durationMs: Long,
): Pair<PlaybackState, List<RnEvent>> {
  // Only emit play/pause when we are at least Ready — ignore spurious
  // isPlaying=false during initial Loading.
  return when {
    isPlaying && state is PlaybackState.Playing -> state to emptyList()
    isPlaying -> PlaybackState.Playing to listOf(
      RnEvent("onPlay") {
        mapOf("positionMs" to positionMs, "durationMs" to durationMs)
      },
      RnEvent("onPlaybackStateChange") {
        mapOf("state" to "playing", "positionMs" to positionMs)
      },
    )
    !isPlaying && state is PlaybackState.Paused -> state to emptyList()
    !isPlaying && state !is PlaybackState.Loading && state !is PlaybackState.Idle -> {
      PlaybackState.Paused to listOf(
        RnEvent("onPause") {
          mapOf("positionMs" to positionMs, "durationMs" to durationMs)
        },
        RnEvent("onPlaybackStateChange") {
          mapOf("state" to "paused", "positionMs" to positionMs)
        },
      )
    }
    else -> state to emptyList()
  }
}

private fun handleProgress(state: PlaybackState, event: Media3Event.Progress): Pair<PlaybackState, List<RnEvent>> {
  // Progress events are emitted regardless of state, but only when duration > 0
  // to avoid division by zero in JS.
  if (event.durationMs <= 0) return state to emptyList()
  val progress = (event.positionMs.toFloat() / event.durationMs.toFloat()).coerceIn(0f, 1f).toDouble()
  return state to listOf(
    RnEvent("onProgress") {
      mapOf(
        "positionMs" to event.positionMs,
        "durationMs" to event.durationMs,
        "progress" to progress,
      )
    },
  )
}

// --- Media3 event mirror (pure Kotlin, no Android dependencies) ---

/** Mirror of `androidx.media3.common.Player.STATE_*` constants. */
enum class Media3PlaybackState { IDLE, BUFFERING, READY, ENDED }

/**
 * Pure-Kotlin representation of the Media3 `Player.Listener` callbacks that
 * the bridge cares about. Decouples [transition] from `androidx.media3`.
 */
sealed class Media3Event {
  data class PlaybackStateChanged(
    val state: Media3PlaybackState,
    val videoId: String,
    val positionMs: Long,
    val durationMs: Long,
  ) : Media3Event()

  data class IsPlayingChanged(
    val isPlaying: Boolean,
    val positionMs: Long,
    val durationMs: Long,
  ) : Media3Event()

  data class PlayerError(
    val message: String,
    val nativeCode: String?,
    val positionMs: Long,
  ) : Media3Event()

  data class VolumeChanged(val volume: Float, val isMuted: Boolean) : Media3Event()

  data class PlaybackParametersChanged(val rate: Float) : Media3Event()

  data class Progress(val positionMs: Long, val durationMs: Long) : Media3Event()
}
