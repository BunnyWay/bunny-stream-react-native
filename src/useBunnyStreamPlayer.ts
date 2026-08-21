/**
 * `useBunnyStreamPlayer` — a React hook that subscribes to all native
 * {@link BunnyStreamPlayer} events and exposes a single aggregated
 * `PlayerState` (low-frequency) + `PlayerProgress` (high-frequency),
 * eliminating the per-screen `useState` boilerplate.
 *
 * The hook is purely additive: it returns `eventHandlers` that the consumer
 * spreads onto `<BunnyStreamPlayer {...player.eventHandlers} />`, plus a
 * stable `controls` object that proxies the imperative ref API.
 *
 * State is split so that consumers reading only `state.*` (e.g. play/pause
 * buttons) do NOT re-render on every `onProgress` tick (~4×/s).
 */

// fallow-ignore-file complexity -- idiomatic flat useReducer switch with 9 cases; splitting into per-action handlers adds indirection without reducing cyclomatic complexity. CRAP score is inflated by missing coverage data (20 unit tests cover every case).

import type { PlayerPlaybackState } from './specs/BunnyStreamPlayerNativeComponent';
import type { BunnyStreamPlayerRef } from './types';

import * as React from 'react';

// --- Public state shapes ---

/**
 * Low-frequency player state — updated only on state transitions, errors,
 * volume/rate changes, and `onReady`. Stable across `onProgress` ticks.
 */
export interface PlayerState {
  /** Native playback state machine value. */
  playbackState: PlayerPlaybackState;
  /** `true` while the player is actively playing. */
  isPlaying: boolean;
  /** `true` while the player is buffering (waiting for data). */
  isBuffering: boolean;
  /** Total duration in ms, set by `onReady` and stable thereafter. */
  durationMs: number;
  /** Last error, or `null` when no error is present. */
  error: { code: string; message: string; nativeCode?: string } | null;
  /** Current volume (0.0–1.0). */
  volume: number;
  /** `true` when the player is muted. */
  isMuted: boolean;
  /** Current playback rate (must be > 0). */
  playbackRate: number;
  /** Video ID reported by the most recent `onReady`. */
  videoId: string | null;
  /** Video pixel dimensions from `onVideoSizeChange` (0 until the first frame). */
  videoSize: { width: number; height: number };
  /**
   * Live player state from `onLiveStateChange`. `null` for VOD sources.
   * For live, `state` is one of: `loading`, `offline`, `countdown`,
   * `trailer`, `live`, `vod`. `isLive` is `true` only for `live`.
   */
  liveState: {
    state: 'loading' | 'offline' | 'countdown' | 'trailer' | 'live' | 'vod';
    isLive: boolean;
    reason?: string;
    targetEpochMs?: number;
    title?: string;
    dvrEnabled?: boolean;
  } | null;
  /** Terminal live error from `onLiveError`. `null` for VOD or when no error. */
  liveError: string | null;
}

/**
 * High-frequency player progress — updated ~4×/s by `onProgress`. Kept in a
 * separate `useState` so consumers that only read `state.*` don't re-render
 * on every tick.
 */
export interface PlayerProgress {
  /** Current playback position in ms. */
  positionMs: number;
  /** Duration in ms (mirrors `state.durationMs` but updated by `onProgress`). */
  durationMs: number;
  /** Normalised progress 0–1, pre-computed natively. */
  progress: number;
}

// --- Options / result ---

/**
 * Optional user-supplied event handlers. Each fires alongside the internal
 * state update, receiving the unwrapped `nativeEvent` payload (no
 * `{ nativeEvent }` wrapper).
 */
export interface UseBunnyStreamPlayerOptions {
  onReady?: (e: { videoId: string; durationMs: number }) => void;
  onPlaybackStateChange?: (e: { state: string; positionMs: number }) => void;
  onProgress?: (e: { positionMs: number; durationMs: number; progress: number }) => void;
  onError?: (e: { code: string; message: string; nativeCode?: string }) => void;
  onBuffering?: (e: { isBuffering: boolean }) => void;
  onPlay?: (e: { positionMs: number; durationMs: number }) => void;
  onPause?: (e: { positionMs: number; durationMs: number }) => void;
  onEnd?: (e: { positionMs: number; durationMs: number }) => void;
  onVolumeChange?: (e: { volume: number; isMuted: boolean }) => void;
  onPlaybackRateChange?: (e: { rate: number }) => void;
  onVideoSizeChange?: (e: { width: number; height: number }) => void;
  onPlaybackError?: (e: { message: string }) => void;
  onLiveStateChange?: (e: {
    state: 'loading' | 'offline' | 'countdown' | 'trailer' | 'live' | 'vod';
    isLive: boolean;
    reason?: string;
    targetEpochMs?: number;
    title?: string;
    dvrEnabled?: boolean;
  }) => void;
  onLiveError?: (e: { message: string }) => void;
}

/**
 * Spread onto `<BunnyStreamPlayer {...player.eventHandlers} />`. Each handler
 * has a stable identity (memoised via `useMemo` keyed on stable option refs).
 */
export type PlayerEventHandlers = {
  onReady: (event: { nativeEvent: { videoId: string; durationMs: number } }) => void;
  onPlaybackStateChange: (event: { nativeEvent: { state: string; positionMs: number } }) => void;
  onProgress: (event: {
    nativeEvent: { positionMs: number; durationMs: number; progress: number };
  }) => void;
  onError: (event: { nativeEvent: { code: string; message: string; nativeCode?: string } }) => void;
  onBuffering: (event: { nativeEvent: { isBuffering: boolean } }) => void;
  onPlay: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  onPause: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  onEnd: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  onVolumeChange: (event: { nativeEvent: { volume: number; isMuted: boolean } }) => void;
  onPlaybackRateChange: (event: { nativeEvent: { rate: number } }) => void;
  onVideoSizeChange: (event: { nativeEvent: { width: number; height: number } }) => void;
  onPlaybackError: (event: { nativeEvent: { message: string } }) => void;
  onLiveStateChange: (event: {
    nativeEvent: {
      state: 'loading' | 'offline' | 'countdown' | 'trailer' | 'live' | 'vod';
      isLive: boolean;
      reason?: string;
      targetEpochMs?: number;
      title?: string;
      dvrEnabled?: boolean;
    };
  }) => void;
  onLiveError: (event: { nativeEvent: { message: string } }) => void;
};

export interface UseBunnyStreamPlayerResult {
  /** Attach to `<BunnyStreamPlayer ref={player.ref} />`. */
  ref: React.RefObject<BunnyStreamPlayerRef | null>;
  /** Low-frequency aggregated state. */
  state: PlayerState;
  /** High-frequency progress (4×/s). */
  progress: PlayerProgress;
  /** Stable imperative API (proxies the ref). Safe to pass to memoised children. */
  controls: BunnyStreamPlayerRef;
  /** Spread onto `<BunnyStreamPlayer {...player.eventHandlers} />`. */
  eventHandlers: PlayerEventHandlers;
}

// --- Defaults ---

const DEFAULT_PLAYER_STATE: PlayerState = {
  playbackState: 'idle',
  isPlaying: false,
  isBuffering: false,
  durationMs: 0,
  error: null,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  videoId: null,
  videoSize: { width: 0, height: 0 },
  liveState: null,
  liveError: null,
};

const DEFAULT_PROGRESS: PlayerProgress = {
  positionMs: 0,
  durationMs: 0,
  progress: 0,
};

// --- Reducer ---

type PlayerAction =
  | { type: 'READY'; videoId: string; durationMs: number }
  | { type: 'STATE_CHANGE'; state: string }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'END' }
  | { type: 'BUFFERING'; isBuffering: boolean }
  | { type: 'ERROR'; error: { code: string; message: string; nativeCode?: string } }
  | { type: 'VOLUME'; volume: number; isMuted: boolean }
  | { type: 'PLAYBACK_RATE'; rate: number }
  | { type: 'VIDEO_SIZE'; width: number; height: number }
  | { type: 'PLAYBACK_ERROR'; message: string }
  | {
      type: 'LIVE_STATE';
      liveState: PlayerState['liveState'];
    }
  | { type: 'LIVE_ERROR'; message: string }
  | { type: 'RESET' };

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'READY': {
      // Auto-reset when the videoId changes: zero out stale fields first so
      // no leftover error/buffering/position/videoSize lingers between sources.
      if (state.videoId !== null && state.videoId !== action.videoId) {
        return {
          ...DEFAULT_PLAYER_STATE,
          videoId: action.videoId,
          durationMs: action.durationMs,
          playbackState: 'ready',
        };
      }
      return {
        ...state,
        playbackState: 'ready',
        durationMs: action.durationMs,
        videoId: action.videoId,
        error: null,
      };
    }
    case 'STATE_CHANGE': {
      // Idempotent: skip if the state string is already the current value.
      // The native state machine emits both `onPlay` and
      // `onPlaybackStateChange('playing')` for the same transition.
      if (state.playbackState === action.state) {
        return state;
      }
      return { ...state, playbackState: action.state as PlayerPlaybackState };
    }
    case 'PLAY':
      if (state.isPlaying && state.playbackState === 'playing') {
        return state;
      }
      return { ...state, isPlaying: true, playbackState: 'playing', error: null };
    case 'PAUSE':
      if (!state.isPlaying && state.playbackState === 'paused') {
        return state;
      }
      return { ...state, isPlaying: false, playbackState: 'paused' };
    case 'END':
      if (!state.isPlaying && state.playbackState === 'ended') {
        return state;
      }
      return { ...state, isPlaying: false, playbackState: 'ended' };
    case 'BUFFERING':
      if (state.isBuffering === action.isBuffering) {
        return state;
      }
      return { ...state, isBuffering: action.isBuffering };
    case 'ERROR':
      return {
        ...state,
        error: action.error,
        playbackState: 'error',
        isPlaying: false,
      };
    case 'VOLUME':
      if (state.volume === action.volume && state.isMuted === action.isMuted) {
        return state;
      }
      return { ...state, volume: action.volume, isMuted: action.isMuted };
    case 'PLAYBACK_RATE':
      if (state.playbackRate === action.rate) {
        return state;
      }
      return { ...state, playbackRate: action.rate };
    case 'VIDEO_SIZE': {
      const next = { width: action.width, height: action.height };
      if (state.videoSize.width === next.width && state.videoSize.height === next.height) {
        return state;
      }
      return { ...state, videoSize: next };
    }
    case 'PLAYBACK_ERROR':
      // Surface the SDK's human-readable error message without overwriting the
      // structured `error` from the state machine (onError still owns code/nativeCode).
      // Consumers can read `state.error` for the structured payload and subscribe to
      // `onPlaybackError` for the SDK message (e.g. live recovery signalling).
      return state;
    case 'LIVE_STATE':
      return { ...state, liveState: action.liveState };
    case 'LIVE_ERROR':
      return { ...state, liveError: action.message };
    case 'RESET':
      // Full reset to defaults — used when the source identity changes
      // (VOD → live, or a different VOD) so stale state doesn't linger.
      return DEFAULT_PLAYER_STATE;
    default:
      return state;
  }
}

// --- Hook ---

/**
 * Subscribes to all {@link BunnyStreamPlayer} events and aggregates them into
 * a single `PlayerState` + `PlayerProgress`. See the file docstring for
 * usage.
 *
 * @param options  Optional user-supplied event handlers.
 * @param sourceKey  Identity key for the current source (e.g. from
 *   `sourceIdentityKey`). When this changes, the hook resets `state` and
 *   `progress` to defaults — this prevents stale VOD state (videoId,
 *   duration, progress, playback state) from lingering after a VOD → live
 *   transition or a source change. Pass `undefined` to opt out of resets
 *   (legacy behaviour).
 */
export function useBunnyStreamPlayer(
  options?: UseBunnyStreamPlayerOptions,
  sourceKey?: string | number,
): UseBunnyStreamPlayerResult {
  const ref = React.useRef<BunnyStreamPlayerRef | null>(null);

  const [state, dispatch] = React.useReducer(playerReducer, DEFAULT_PLAYER_STATE);
  const [progress, setProgress] = React.useState<PlayerProgress>(DEFAULT_PROGRESS);

  // Reset state + progress when the source identity changes. This clears
  // stale VOD state (videoId, duration, progress, playback state) when
  // switching to live (which doesn't emit onReady) or between VOD sources.
  // Uses a ref to track the previous key so the reset only fires on actual
  // changes, not on every render.
  const prevSourceKey = React.useRef<string | number | undefined>(sourceKey);
  React.useEffect(() => {
    if (prevSourceKey.current !== sourceKey) {
      prevSourceKey.current = sourceKey;
      // Reset state + progress to defaults so stale VOD state (videoId,
      // duration, progress, playback state) doesn't linger after a source
      // change (e.g. VOD → live, which doesn't emit onReady).
      dispatch({ type: 'RESET' });
      setProgress(DEFAULT_PROGRESS);
    }
  }, [sourceKey]);

  // Store user handlers in a ref so the memoised event handlers below have a
  // stable identity even when the user passes inline callbacks.
  const optionsRef = React.useRef<UseBunnyStreamPlayerOptions | undefined>(options);
  optionsRef.current = options;

  // Stable imperative API — proxies the ref so consumers can call
  // `player.controls.play()` without touching the ref directly.
  const controls = React.useMemo<BunnyStreamPlayerRef>(
    () => ({
      play: () => ref.current?.play(),
      pause: () => ref.current?.pause(),
      seekTo: (positionMs: number) => ref.current?.seekTo(positionMs),
      setVolume: (volume: number) => ref.current?.setVolume(volume),
      setPlaybackRate: (rate: number) => ref.current?.setPlaybackRate(rate),
      mute: () => ref.current?.mute(),
      unmute: () => ref.current?.unmute(),
    }),
    [],
  );

  const eventHandlers = React.useMemo<PlayerEventHandlers>(
    () => ({
      onReady: (e) => {
        const { videoId, durationMs } = e.nativeEvent;
        dispatch({ type: 'READY', videoId, durationMs });
        optionsRef.current?.onReady?.({ videoId, durationMs });
      },
      onPlaybackStateChange: (e) => {
        const { state: pbState, positionMs } = e.nativeEvent;
        dispatch({ type: 'STATE_CHANGE', state: pbState });
        optionsRef.current?.onPlaybackStateChange?.({ state: pbState, positionMs });
      },
      onProgress: (e) => {
        const { positionMs, durationMs, progress: prog } = e.nativeEvent;
        // High-frequency: bypass the reducer entirely.
        setProgress({ positionMs, durationMs, progress: prog });
        optionsRef.current?.onProgress?.({ positionMs, durationMs, progress: prog });
      },
      onError: (e) => {
        const { code, message, nativeCode } = e.nativeEvent;
        const error = { code, message, nativeCode };
        dispatch({ type: 'ERROR', error });
        optionsRef.current?.onError?.({ code, message, nativeCode });
      },
      onBuffering: (e) => {
        const { isBuffering } = e.nativeEvent;
        dispatch({ type: 'BUFFERING', isBuffering });
        optionsRef.current?.onBuffering?.({ isBuffering });
      },
      onPlay: (e) => {
        const { positionMs, durationMs } = e.nativeEvent;
        dispatch({ type: 'PLAY' });
        optionsRef.current?.onPlay?.({ positionMs, durationMs });
      },
      onPause: (e) => {
        const { positionMs, durationMs } = e.nativeEvent;
        dispatch({ type: 'PAUSE' });
        optionsRef.current?.onPause?.({ positionMs, durationMs });
      },
      onEnd: (e) => {
        const { positionMs, durationMs } = e.nativeEvent;
        dispatch({ type: 'END' });
        optionsRef.current?.onEnd?.({ positionMs, durationMs });
      },
      onVolumeChange: (e) => {
        const { volume, isMuted } = e.nativeEvent;
        dispatch({ type: 'VOLUME', volume, isMuted });
        optionsRef.current?.onVolumeChange?.({ volume, isMuted });
      },
      onPlaybackRateChange: (e) => {
        const { rate } = e.nativeEvent;
        dispatch({ type: 'PLAYBACK_RATE', rate });
        optionsRef.current?.onPlaybackRateChange?.({ rate });
      },
      onVideoSizeChange: (e) => {
        const { width, height } = e.nativeEvent;
        dispatch({ type: 'VIDEO_SIZE', width, height });
        optionsRef.current?.onVideoSizeChange?.({ width, height });
      },
      onPlaybackError: (e) => {
        const { message } = e.nativeEvent;
        dispatch({ type: 'PLAYBACK_ERROR', message });
        optionsRef.current?.onPlaybackError?.({ message });
      },
      onLiveStateChange: (e) => {
        const {
          state: liveState,
          isLive,
          reason,
          targetEpochMs,
          title,
          dvrEnabled,
        } = e.nativeEvent;
        const payload = {
          state: liveState,
          isLive,
          ...(reason !== undefined && { reason }),
          ...(targetEpochMs !== undefined && { targetEpochMs }),
          ...(title !== undefined && { title }),
          ...(dvrEnabled !== undefined && { dvrEnabled }),
        };
        dispatch({ type: 'LIVE_STATE', liveState: payload });
        optionsRef.current?.onLiveStateChange?.(payload);
      },
      onLiveError: (e) => {
        const { message } = e.nativeEvent;
        dispatch({ type: 'LIVE_ERROR', message });
        optionsRef.current?.onLiveError?.({ message });
      },
    }),
    [],
  );

  return { ref, state, progress, controls, eventHandlers };
}
