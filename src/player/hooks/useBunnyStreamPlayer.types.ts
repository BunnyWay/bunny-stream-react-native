import type { BunnyVodPlayerRef, PlayerPlaybackState } from '../BunnyStreamPlayer.types';
import type { RefObject } from 'react';

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
   * `true` while the player is loading/buffering before the first frame.
   * Cleared when:
   * - VOD: `onReady` or `onVideoSizeChange` fires (first frame decoded).
   * - Live: `onLiveStateChange` fires with a non-`loading` state
   *   (e.g. `live`, `vod`, `offline`, `countdown`, `trailer`).
   * - Any error fires (terminal or live).
   * Re-set to `true` on source change (RESET).
   */
  isLoading: boolean;
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
    videoId?: string;
    message?: string;
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
    videoId?: string;
    message?: string;
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
      videoId?: string;
      message?: string;
      dvrEnabled?: boolean;
    };
  }) => void;
  onLiveError: (event: { nativeEvent: { message: string } }) => void;
};

export interface UseBunnyStreamPlayerResult {
  /** Attach to `<BunnyStreamPlayer ref={player.ref} />`. */
  ref: RefObject<BunnyVodPlayerRef | null>;
  /** Low-frequency aggregated state. */
  state: PlayerState;
  /** High-frequency progress (4×/s). */
  progress: PlayerProgress;
  /** Stable imperative API (proxies the ref). Safe to pass to memoised children. */
  controls: BunnyVodPlayerRef;
  /** Spread onto `<BunnyStreamPlayer {...player.eventHandlers} />`. */
  eventHandlers: PlayerEventHandlers;
}
