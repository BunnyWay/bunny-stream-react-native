import type { ViewProps } from 'react-native';

export type PlayerPlaybackState =
  'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export type PlayerReadyEvent = Readonly<{
  videoId: string;
  durationMs: number;
}>;

export type PlayerStateChangeEvent = Readonly<{
  state: string;
  positionMs: number;
}>;

export type PlayerProgressEvent = Readonly<{
  positionMs: number;
  durationMs: number;
  progress: number;
}>;

export type PlayerErrorEvent = Readonly<{
  code: string;
  message: string;
  nativeCode?: string;
}>;

export type PlayerBufferingEvent = Readonly<{
  isBuffering: boolean;
}>;

export type PlayerPositionEvent = Readonly<{
  positionMs: number;
  durationMs: number;
}>;

export type PlayerVolumeChangeEvent = Readonly<{
  volume: number;
  isMuted: boolean;
}>;

export type PlayerPlaybackRateChangeEvent = Readonly<{
  rate: number;
}>;

export type PlayerVideoSizeChangeEvent = Readonly<{
  width: number;
  height: number;
}>;

export type PlayerPlaybackErrorEvent = Readonly<{
  message: string;
}>;

export type LiveVideoSizeChangeEvent = PlayerVideoSizeChangeEvent;

export type LiveStateChangeEvent = Readonly<{
  state: 'loading' | 'offline' | 'countdown' | 'trailer' | 'live' | 'vod';
  isLive: boolean;
  reason?: string;
  targetEpochMs?: number;
  title?: string;
  videoId?: string;
  message?: string;
  dvrEnabled?: boolean;
}>;

export type LiveErrorEvent = Readonly<{
  message: string;
}>;

/**
 * Discriminated playback source. VOD can use the library configured by
 * {@link initialize}; live requires an explicit library ID. Changing any source
 * identity field causes the native host to remount.
 */
export type BunnyStreamSource =
  | {
      type: 'vod';
      /** Bunny Stream video GUID to play. */
      videoId: string;
      /** Library ID. Falls back to the library passed to {@link initialize}. */
      libraryId?: number;
      /** Embed view token for token-secured pull zones. */
      token?: string;
      /** Token expiration timestamp (Unix seconds). */
      expires?: number;
    }
  | {
      type: 'live';
      /** Bunny Stream live stream GUID to play. */
      streamId: string;
      /** Library ID. Required for live because the native player requires it. */
      libraryId: number;
      /** Embed view token for token-secured live streams. */
      token?: string;
      /** Token expiration timestamp (Unix seconds). */
      expires?: number;
    };

/**
 * Imperative commands available for VOD playback through
 * {@link BunnyStreamPlayer}. Commands issued before `STATE_READY` are queued
 * natively and drained when the VOD player becomes ready.
 *
 * Do not call these commands for a `live` source. The native SDKs do not expose
 * public live controllers yet, so the component ignores VOD commands while its
 * active source is live.
 */
export type BunnyVodPlayerRef = {
  /** Resume playback. */
  play: () => void;
  /** Pause playback. */
  pause: () => void;
  /** Seek to [positionMs] (milliseconds, non-negative). */
  seekTo: (positionMs: number) => void;
  /** Set volume (0.0–1.0). */
  setVolume: (volume: number) => void;
  /** Set playback rate (must be > 0). */
  setPlaybackRate: (rate: number) => void;
  /** Mute audio. */
  mute: () => void;
  /** Unmute audio. */
  unmute: () => void;
};

/**
 * Backward-compatible name for the VOD-only imperative player API.
 * Prefer {@link BunnyVodPlayerRef} in new code so live command limitations are
 * visible at the call site.
 */
export type BunnyStreamPlayerRef = BunnyVodPlayerRef;

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
type NativeEvent<T> = { nativeEvent: Mutable<T> };

/** Props for the public VOD/live Bunny Stream player component. */
export interface BunnyStreamPlayerProps extends ViewProps {
  /** Playback source that selects the VOD or live native host. */
  source: BunnyStreamSource;
  /** Whether playback starts automatically. VOD only. Default: `true`. */
  autoPlay?: boolean;
  /** Whether native playback controls are visible. VOD only. Default: `true`. */
  controls?: boolean;
  onReady?: (event: NativeEvent<PlayerReadyEvent>) => void;
  onPlaybackStateChange?: (event: NativeEvent<PlayerStateChangeEvent>) => void;
  onProgress?: (event: NativeEvent<PlayerProgressEvent>) => void;
  onError?: (event: NativeEvent<PlayerErrorEvent>) => void;
  onBuffering?: (event: NativeEvent<PlayerBufferingEvent>) => void;
  onPlay?: (event: NativeEvent<PlayerPositionEvent>) => void;
  onPause?: (event: NativeEvent<PlayerPositionEvent>) => void;
  onEnd?: (event: NativeEvent<PlayerPositionEvent>) => void;
  onVolumeChange?: (event: NativeEvent<PlayerVolumeChangeEvent>) => void;
  onPlaybackRateChange?: (event: NativeEvent<PlayerPlaybackRateChangeEvent>) => void;
  onVideoSizeChange?: (event: NativeEvent<PlayerVideoSizeChangeEvent>) => void;
  onPlaybackError?: (event: NativeEvent<PlayerPlaybackErrorEvent>) => void;
  onLiveStateChange?: (event: NativeEvent<LiveStateChangeEvent>) => void;
  onLiveError?: (event: NativeEvent<LiveErrorEvent>) => void;
}
