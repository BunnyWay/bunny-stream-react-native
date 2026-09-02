/**
 * Bunny Stream React Native — public TypeScript API.
 *
 * This module re-exports the Codegen-generated native component and TurboModule
 * spec, wraps them in an idiomatic React API (typed props, ref commands,
 * event handlers), and provides the `initialize` entry point.
 *
 * The public surface is a single {@link BunnyStreamPlayer} component that
 * accepts a {@link BunnyStreamSource} discriminated union (`vod` | `live`).
 * Internally it selects between two native hosts:
 *  - VOD → `BunnyStreamPlayerView` (classic Android View, Media3/ExoPlayer)
 *  - live → `BunnyLiveStreamPlayerView` (Compose host wrapping the SDK's
 *    `BunnyLiveStreamPlayer` composable — owns polling, countdown, trailer,
 *    DVR, recovery and the live → VOD hand-off)
 * A change of `source.type` or the source identity id triggers a controlled
 * remount of the native host (PLAN.md §5).
 */

import type { BunnyStreamPlayerRef, BunnyStreamSource } from './types';
import type { HostComponent, ViewProps } from 'react-native';

import * as React from 'react';

import BunnyLiveStreamPlayerNativeComponent, {
  type NativeProps as LiveNativeProps,
} from './specs/BunnyLiveStreamPlayerNativeComponent';
import BunnyStreamPlayerNativeComponent, {
  Commands as NativeCommands,
  type NativeProps as VodNativeProps,
} from './specs/BunnyStreamPlayerNativeComponent';
import NativeBunnyStreamPlayer from './specs/NativeBunnyStreamPlayer';

export { NativeBunnyStreamPlayer };

// --- Re-exported types from the Codegen contract ---

export type {
  PlayerPlaybackState,
  PlayerReadyEvent,
  PlayerStateChangeEvent,
  PlayerProgressEvent,
  PlayerErrorEvent,
  PlayerBufferingEvent,
  PlayerPositionEvent,
  PlayerVolumeChangeEvent,
  PlayerPlaybackRateChangeEvent,
  PlayerVideoSizeChangeEvent,
  PlayerPlaybackErrorEvent,
} from './specs/BunnyStreamPlayerNativeComponent';

export type {
  LiveVideoSizeChangeEvent,
  LiveStateChangeEvent,
  LiveErrorEvent,
} from './specs/BunnyLiveStreamPlayerNativeComponent';

// --- Public source + props ---

export type { BunnyStreamSource } from './types';

/**
 * Props for the {@link BunnyStreamPlayer} React component.
 *
 * `source` is a {@link BunnyStreamSource} discriminated union that selects
 * between VOD (`{ type: 'vod', videoId }`) and live
 * (`{ type: 'live', streamId, libraryId }`) playback.
 *
 * Event handlers are direct events dispatched from the native side — they do
 * not bubble. VOD-specific events (`onReady`, `onProgress`, `onPlay`, etc.)
 * are only emitted for `vod` sources. `onVideoSizeChange` is emitted for both.
 */
export interface BunnyStreamPlayerProps extends ViewProps {
  /** Playback source — VOD or live. See {@link BunnyStreamSource}. */
  source: BunnyStreamSource;
  /** Whether to start playback automatically when the video is ready. VOD only. Default: `true`. */
  autoPlay?: boolean;
  /**
   * Whether to show the native player controls (play/pause/seek bar).
   * Set to `false` when building fully custom controls in JS. VOD only —
   * live always shows native controls until the SDK exposes a public
   * controller (PLAN.md §6 Faza 5). Default: `true`.
   */
  controls?: boolean;
  /** Fired once when the player reaches `STATE_READY` (first frame rendered). VOD only. */
  onReady?: (event: { nativeEvent: { videoId: string; durationMs: number } }) => void;
  /** Fired on every playback state transition. VOD only. */
  onPlaybackStateChange?: (event: { nativeEvent: { state: string; positionMs: number } }) => void;
  /** Fired ~4×/s with the current position, duration, and normalised progress (0–1). VOD only. */
  onProgress?: (event: {
    nativeEvent: { positionMs: number; durationMs: number; progress: number };
  }) => void;
  /** Fired when a playback error occurs. VOD only. */
  onError?: (event: {
    nativeEvent: { code: string; message: string; nativeCode?: string };
  }) => void;
  /** Fired when buffering starts or stops. VOD only. */
  onBuffering?: (event: { nativeEvent: { isBuffering: boolean } }) => void;
  /** Fired when playback starts (transition to `playing`). VOD only. */
  onPlay?: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  /** Fired when playback pauses (transition to `paused`). VOD only. */
  onPause?: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  /** Fired when playback reaches the end of the stream. VOD only. */
  onEnd?: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  /** Fired when the volume or mute state changes. VOD only. */
  onVolumeChange?: (event: { nativeEvent: { volume: number; isMuted: boolean } }) => void;
  /** Fired when the playback rate changes. VOD only. */
  onPlaybackRateChange?: (event: { nativeEvent: { rate: number } }) => void;
  /** Fired with the video's pixel dimensions on the first frame and on change. VOD + live. */
  onVideoSizeChange?: (event: { nativeEvent: { width: number; height: number } }) => void;
  /** Fired when the SDK reports a playback error (human-readable message). VOD + live. */
  onPlaybackError?: (event: { nativeEvent: { message: string } }) => void;
  /**
   * Fired when the live player's state changes (loading / offline / countdown
   * / trailer / live / vod). Carries `isLive: boolean` and context-specific
   * fields (e.g. `targetEpochMs` for countdown, `dvrEnabled` for live).
   * Live only.
   */
  onLiveStateChange?: (event: {
    nativeEvent: {
      state: 'loading' | 'offline' | 'countdown' | 'trailer' | 'live' | 'vod';
      isLive: boolean;
      reason?: string;
      targetEpochMs?: number;
      title?: string;
      dvrEnabled?: boolean;
    };
  }) => void;
  /**
   * Fired when the live player encounters a terminal error (e.g. 404, 401).
   * The SDK also renders a native error overlay — this event lets JS drive
   * additional UI or navigation. Live only.
   */
  onLiveError?: (event: { nativeEvent: { message: string } }) => void;
}

// --- Ref / commands ---

export type { BunnyStreamPlayerRef } from './types';

// --- initialize ---

function validateAccessKey(accessKey: string): void {
  if (!accessKey || accessKey.trim().length === 0) {
    throw new Error('initialize: accessKey must be a non-empty string (SDK 4.0.0 requirement)');
  }
}

function validateLibraryId(libraryId: number): void {
  if (!Number.isFinite(libraryId) || libraryId <= 0 || libraryId % 1 !== 0) {
    throw new Error('initialize: libraryId must be a positive integer');
  }
}

/**
 * Initialises the Bunny Stream SDK with an API access key and library ID.
 *
 * Must be called once, early in app startup, before any
 * {@link BunnyStreamPlayer} is mounted. On Android this delegates to
 * `BunnyStreamApi.initialize(context, accessKey, libraryId)`.
 *
 * SDK 4.0.0 requires a non-empty access key; passing an empty string throws.
 *
 * @param accessKey  Bunny Stream API access key. Required — must be a non-empty
 *                   string. (3.x allowed `null` for public-only libraries; 4.0.0
 *                   no longer does.)
 * @param libraryId  The library ID to use for playback and API calls.
 * @throws {Error} if `accessKey` is empty or `libraryId` is not a positive integer.
 */
export function initialize(accessKey: string, libraryId: number): void {
  validateAccessKey(accessKey);
  validateLibraryId(libraryId);
  NativeBunnyStreamPlayer.initialize(accessKey, libraryId);
}

// --- Component ---

const NativeVodView = BunnyStreamPlayerNativeComponent as unknown as HostComponent<VodNativeProps>;
const NativeLiveView =
  BunnyLiveStreamPlayerNativeComponent as unknown as HostComponent<LiveNativeProps>;

/**
 * `BunnyStreamPlayer` — a React Native component that renders the native
 * Bunny Stream player for VOD or live sources.
 *
 * Pass a {@link BunnyStreamSource} via the `source` prop to select between
 * VOD (`{ type: 'vod', videoId }`) and live
 * (`{ type: 'live', streamId, libraryId }`) playback. The component selects
 * the internal native host automatically and remounts it when the source
 * identity changes, so the SDK ViewModel / player engine is cleanly torn down
 * and recreated.
 *
 * The player fills its parent — set `style` width/height or use flex.
 * Only one active VOD instance is supported at a time due to the SDK's
 * singleton design; mounting a second VOD player will pause and clean up
 * the first. Live uses a separate Compose-backed host.
 *
 * @example
 * ```tsx
 * import { BunnyStreamPlayer, initialize } from 'bunny-stream-react-native';
 *
 * initialize(ACCESS_KEY, LIBRARY_ID);
 *
 * // VOD
 * <BunnyStreamPlayer
 *   source={{ type: 'vod', videoId }}
 *   autoPlay
 *   onReady={(e) => console.log('duration', e.nativeEvent.durationMs)}
 *   onProgress={(e) => console.log('progress', e.nativeEvent.progress)}
 * />
 *
 * // Live
 * <BunnyStreamPlayer
 *   source={{ type: 'live', streamId, libraryId: LIBRARY_ID }}
 *   onVideoSizeChange={(e) => console.log(e.nativeEvent.width, e.nativeEvent.height)}
 * />
 * ```
 */
export const BunnyStreamPlayer = React.forwardRef<BunnyStreamPlayerRef, BunnyStreamPlayerProps>(
  (props, ref) => {
    const { source, ...rest } = props;
    // Track the current source type so ref commands can no-op for live.
    // The SDK does not yet expose a public live controller (PLAN.md §6 Faza 5),
    // so play/pause/seek/setVolume/setPlaybackRate/mute/unmute are no-ops on
    // live sources. We guard here (not in the native ViewManager) because the
    // live host has no Codegen commands at all — sending one would be an
    // unhandled command, not a guaranteed no-op.
    const sourceTypeRef = React.useRef(source.type);
    sourceTypeRef.current = source.type;

    // Ref holds either a VOD or live native host; cast per-use to the right
    // NativeProps type.
    const nativeRef = React.useRef<unknown>(null);

    React.useImperativeHandle(ref, () => ({
      play: () => {
        if (sourceTypeRef.current !== 'vod') return;
        const v = nativeRef.current as React.ElementRef<HostComponent<VodNativeProps>> | null;
        if (v) NativeCommands.play(v);
      },
      pause: () => {
        if (sourceTypeRef.current !== 'vod') return;
        const v = nativeRef.current as React.ElementRef<HostComponent<VodNativeProps>> | null;
        if (v) NativeCommands.pause(v);
      },
      seekTo: (positionMs: number) => {
        if (sourceTypeRef.current !== 'vod') return;
        const v = nativeRef.current as React.ElementRef<HostComponent<VodNativeProps>> | null;
        if (v) NativeCommands.seekTo(v, positionMs);
      },
      setVolume: (volume: number) => {
        if (sourceTypeRef.current !== 'vod') return;
        const v = nativeRef.current as React.ElementRef<HostComponent<VodNativeProps>> | null;
        if (v) NativeCommands.setVolume(v, volume);
      },
      setPlaybackRate: (rate: number) => {
        if (sourceTypeRef.current !== 'vod') return;
        const v = nativeRef.current as React.ElementRef<HostComponent<VodNativeProps>> | null;
        if (v) NativeCommands.setPlaybackRate(v, rate);
      },
      mute: () => {
        if (sourceTypeRef.current !== 'vod') return;
        const v = nativeRef.current as React.ElementRef<HostComponent<VodNativeProps>> | null;
        if (v) NativeCommands.mute(v);
      },
      unmute: () => {
        if (sourceTypeRef.current !== 'vod') return;
        const v = nativeRef.current as React.ElementRef<HostComponent<VodNativeProps>> | null;
        if (v) NativeCommands.unmute(v);
      },
    }));

    // Identity key for the native host: type + id + libraryId + token + expires.
    // A change here remounts the native host so the SDK ViewModel / player
    // engine is cleanly torn down and recreated (PLAN.md §5 Faza 6).
    const hostKey = sourceIdentityKey(source);

    // Extract event handlers + autoPlay/controls (VOD-only) from rest so we
    // can spread the remaining ViewProps (testID, accessibilityLabel,
    // nativeID, onLayout, pointerEvents, etc.) to both hosts.
    const {
      autoPlay,
      controls,
      onReady,
      onPlaybackStateChange,
      onProgress,
      onError,
      onBuffering,
      onPlay,
      onPause,
      onEnd,
      onVolumeChange,
      onPlaybackRateChange,
      onVideoSizeChange,
      onPlaybackError,
      onLiveStateChange,
      onLiveError,
      style,
      ...viewProps
    } = rest;

    if (source.type === 'live') {
      // onPlaybackError is NOT forwarded to the live host — the SDK's
      // BunnyLiveStreamPlayer composable handles playback errors internally
      // via its own overlay (terminalError state). JS consumers should use
      // onLiveError for terminal errors and onLiveStateChange for state
      // transitions, and dismiss loading on onVideoSizeChange (first frame).
      void onPlaybackError;
      return (
        <NativeLiveView
          key={hostKey}
          ref={
            nativeRef as React.RefObject<React.ElementRef<HostComponent<LiveNativeProps>> | null>
          }
          libraryId={source.libraryId}
          streamId={source.streamId}
          token={source.token}
          expires={source.expires}
          onVideoSizeChange={onVideoSizeChange}
          onLiveStateChange={onLiveStateChange}
          onLiveError={onLiveError}
          style={style}
          {...viewProps}
        />
      );
    }

    return (
      <NativeVodView
        key={hostKey}
        ref={nativeRef as React.RefObject<React.ElementRef<HostComponent<VodNativeProps>> | null>}
        videoId={source.videoId}
        libraryId={source.libraryId}
        token={source.token}
        expires={source.expires}
        autoPlay={autoPlay}
        controls={controls}
        onReady={onReady}
        onPlaybackStateChange={onPlaybackStateChange}
        onProgress={onProgress}
        onError={onError}
        onBuffering={onBuffering}
        onPlay={onPlay}
        onPause={onPause}
        onEnd={onEnd}
        onVolumeChange={onVolumeChange}
        onPlaybackRateChange={onPlaybackRateChange}
        onVideoSizeChange={onVideoSizeChange}
        onPlaybackError={onPlaybackError}
        style={style}
        {...viewProps}
      />
    );
  },
);

BunnyStreamPlayer.displayName = 'BunnyStreamPlayer';

function defaultTo<T, U>(value: T | undefined, fallback: U): T | U {
  return value ?? fallback;
}

/**
 * Builds a stable identity key for a source so React remounts the native host
 * when the source identity changes. Includes `type` so VOD ↔ live transitions
 * remount, and the id + library + token + expires so a source change within
 * the same type also remounts (the SDK ViewModel ignores a second `start()`
 * with a different stream — PLAN.md §5 Faza 6).
 *
 * Exported so consumers can pass it to `useBunnyStreamPlayer` as the
 * `sourceKey` parameter, which resets the hook's state on source change.
 */
export function sourceIdentityKey(source: BunnyStreamSource): string {
  const libraryId = defaultTo(source.libraryId, 0);
  const token = defaultTo(source.token, '');
  const expires = defaultTo(source.expires, '');
  if (source.type === 'live') {
    return `live:${libraryId}:${source.streamId}:${token}:${expires}`;
  }
  return `vod:${libraryId}:${source.videoId}:${token}:${expires}`;
}

// --- useBunnyStreamPlayer hook ---

export { useBunnyStreamPlayer } from './hooks/useBunnyStreamPlayer';
export type {
  PlayerEventHandlers,
  PlayerProgress,
  PlayerState,
  UseBunnyStreamPlayerOptions,
  UseBunnyStreamPlayerResult,
} from './hooks/useBunnyStreamPlayer';

// --- REST API module (BunnyStreamApi) ---
//
// Re-exports the public API surface, the typed BunnyResult envelope + BunnyError
// taxonomy, and the domain models. The TurboModule itself is also exported for
// consumers that need the raw Codegen spec (e.g. for mocking in tests).
export {
  BunnyStreamApi,
  errorOrNull,
  fold,
  getOrNull,
  liveStreamStatusLabel,
  map,
  videoStatusLabel,
} from './api/BunnyStreamApi';
export type {
  BunnyError,
  BunnyErrorKind,
  BunnyResult,
  Caption,
  Chapter,
  CreateVideoRequestInput,
  ListOptions,
  LiveStream,
  LiveStreamCreateRequestInput,
  LiveStreamList,
  LiveStreamPlayData,
  LiveStreamStatus,
  MetaTag,
  PlayerSettings,
  Moment,
  RtmpOutput,
  UpdateVideoRequestInput,
  Video,
  VideoList,
  VideoPlayData,
  VideoStatus,
} from './api/BunnyStreamApi';
export {
  LiveStreamStatusEnum,
  TRANSITIONAL_VIDEO_STATUSES,
  VideoStatusEnum,
} from './api/BunnyStreamApi';
export { default as NativeBunnyStreamApi } from './specs/NativeBunnyStreamApi';

// — useBunnyImage — resolves Bunny CDN image URLs (with Referer header) to
// data: URIs so any image component (Image, expo-image, FastImage) can render
// them despite the CDN's hotlink protection.
export { useBunnyImage } from './hooks/useBunnyImage';
export type { UseBunnyImageResult } from './hooks/useBunnyImage';
