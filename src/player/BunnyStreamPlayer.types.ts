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

// --- Phase 6: chapters, moments, retention graph ---

export type Chapter = Readonly<{
  startTimeMs: number;
  endTimeMs: number;
  title: string;
}>;

export type Moment = Readonly<{
  label: string;
  timestampMs: number;
}>;

export type RetentionGraphEntry = Readonly<{
  x: number;
  y: number;
}>;

export type ChaptersUpdatedEvent = Readonly<{
  chapters: Chapter[];
}>;

export type MomentsUpdatedEvent = Readonly<{
  moments: Moment[];
}>;

export type RetentionGraphUpdatedEvent = Readonly<{
  points: RetentionGraphEntry[];
}>;

// --- Phase 6: resume position ---

export type PlaybackPosition = Readonly<{
  videoId: string;
  positionMs: number;
  durationMs: number;
  watchPercentage: number;
  timestamp: number;
  videoTitle?: string;
}>;

export type ResumeConfig = Readonly<{
  retentionDays?: number;
  minimumWatchMs?: number;
  resumeThreshold?: number;
  nearEndThreshold?: number;
  enableAutoSave?: boolean;
  saveIntervalMs?: number;
}>;

export type ResumePositionAvailableEvent = Readonly<{
  position: PlaybackPosition;
}>;

// --- Phase 7: cast handover ---

/** Which engine is in charge of playback. Reported by `onPlayerTypeChange`. */
export type PlayerType = 'default' | 'cast';

export type PlayerTypeChangeEvent = Readonly<{
  playerType: PlayerType;
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
 * Quality constraint applied to VOD playback.
 *
 * - `'auto'` — adaptive bitrate (clears all constraints).
 * - `{ maxHeight }` — cap the selected rendition height (e.g. `720` → 720p max).
 * - `{ maxBitrate }` — cap the selected rendition bitrate in bps.
 * - `{ maxWidth, maxHeight }` — cap both dimensions.
 *
 * Android-only: applied via Media3 `trackSelectionParameters` on the engine
 * exposed by the SDK's public `BunnyPlayer.currentPlayer`. No-op on iOS
 * (programmatic quality control is not bridged there yet). List a video's
 * available renditions with `BunnyStreamApi.fetchVideoResolutions`.
 */
export type VideoQualityPreference =
  'auto' | { maxHeight: number } | { maxBitrate: number } | { maxWidth: number; maxHeight: number };

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
  /** Skip forward by [offsetMs] milliseconds (default 10000). */
  skipForward: (offsetMs?: number) => void;
  /** Skip backward by [offsetMs] milliseconds (default 10000). */
  skipBackward: (offsetMs?: number) => void;
  /** Set volume (0.0–1.0). */
  setVolume: (volume: number) => void;
  /** Set playback rate (must be > 0). */
  setPlaybackRate: (rate: number) => void;
  /** Mute audio. */
  mute: () => void;
  /** Unmute audio. */
  unmute: () => void;
  /**
   * Enter picture-in-picture. Android-only — calls
   * `Activity.enterPictureInPictureMode` on the host activity. No-op on iOS
   * (the SDK exposes no public PiP API) and when the activity does not support
   * PiP. The activity must declare `android:supportsPictureInPicture="true"`.
   */
  enterPiP: () => void;
  /**
   * Constrain video quality for the current VOD playback. Android-only —
   * applies Media3 track-selection parameters on the engine; no-op on iOS.
   * While casting to Chromecast the constraint is applied to the local
   * engine and takes effect when playback returns to the device.
   */
  setVideoQuality: (quality: VideoQualityPreference) => void;
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
  // Phase 6 — Android-only player events (iOS does not expose these).
  onChaptersUpdated?: (event: NativeEvent<ChaptersUpdatedEvent>) => void;
  onMomentsUpdated?: (event: NativeEvent<MomentsUpdatedEvent>) => void;
  onRetentionGraphUpdated?: (event: NativeEvent<RetentionGraphUpdatedEvent>) => void;
  onResumePositionAvailable?: (event: NativeEvent<ResumePositionAvailableEvent>) => void;
  /**
   * Resume position configuration. Android-only — enables the native SDK's
   * `PlaybackPositionManager` with auto-save. iOS uses a JS-side fallback
   * (`useResumePosition` hook) backed by AsyncStorage.
   */
  resumeConfig?: ResumeConfig;
  // Phase 7 — Android TV + cast.
  /**
   * Android-only. When `true`, the player routes through the SDK's
   * `playVideoWithTVDetection`, which launches the dedicated TV player
   * activity on Android TV devices when the `net.bunny:tv` artifact is on
   * the consumer app's classpath, and falls back to the embedded player
   * otherwise. Ignored on iOS (the iOS SDK does not support tvOS).
   * Default: `false`.
   */
  useNativeTvPlayer?: boolean;
  /**
   * Android-only. Fires when playback moves between this device and a
   * connected Chromecast receiver. iOS never emits this event (AirPlay state
   * is internal to the SDK).
   */
  onPlayerTypeChange?: (event: NativeEvent<PlayerTypeChangeEvent>) => void;
}
