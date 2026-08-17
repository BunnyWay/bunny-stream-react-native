/**
 * Bunny Stream React Native — public TypeScript API.
 *
 * This module re-exports the Codegen-generated native component and TurboModule
 * spec, wraps them in an idiomatic React API (typed props, ref commands,
 * event handlers), and provides the `initialize` entry point.
 *
 * The native component is a thin bridge over:
 *  - Android: `net.bunny.bunnystreamplayer.ui.BunnyStreamPlayer` (Media3/ExoPlayer)
 *  - iOS: (planned)
 */

import type { HostComponent, ViewProps } from 'react-native';

import * as React from 'react';

import BunnyStreamPlayerNativeComponent, {
  Commands as NativeCommands,
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
} from './specs/BunnyStreamPlayerNativeComponent';

// --- Public props (without internal Codegen types) ---

/**
 * Props for the {@link BunnyStreamPlayer} React component.
 *
 * `videoId` is required. All other props are optional.
 * Event handlers (`onReady`, `onProgress`, etc.) are direct events
 * dispatched from the native side — they do not bubble.
 */
export interface BunnyStreamPlayerProps extends ViewProps {
  /** Bunny Stream video GUID to play. */
  videoId: string;
  /** Library ID. Falls back to the library passed to {@link initialize}. */
  libraryId?: number;
  /** Embed view token for token-secured pull zones. */
  token?: string;
  /** Token expiration timestamp (Unix seconds). */
  expires?: number;
  /** Whether to start playback automatically when the video is ready. Default: `true`. */
  autoPlay?: boolean;
  /**
   * Whether to show the native player controls (play/pause/seek bar).
   * Set to `false` when building fully custom controls in JS. Default: `true`.
   */
  controls?: boolean;
  /** Fired once when the player reaches `STATE_READY` (first frame rendered). */
  onReady?: (event: { nativeEvent: { videoId: string; durationMs: number } }) => void;
  /** Fired on every playback state transition (`loading`, `ready`, `playing`, `paused`, `ended`, `error`). */
  onPlaybackStateChange?: (event: { nativeEvent: { state: string; positionMs: number } }) => void;
  /** Fired ~4×/s with the current position, duration, and normalised progress (0–1). */
  onProgress?: (event: {
    nativeEvent: { positionMs: number; durationMs: number; progress: number };
  }) => void;
  /** Fired when a playback error occurs. */
  onError?: (event: {
    nativeEvent: { code: string; message: string; nativeCode?: string };
  }) => void;
  /** Fired when buffering starts or stops. */
  onBuffering?: (event: { nativeEvent: { isBuffering: boolean } }) => void;
  /** Fired when playback starts (transition to `playing`). */
  onPlay?: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  /** Fired when playback pauses (transition to `paused`). */
  onPause?: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  /** Fired when playback reaches the end of the stream. */
  onEnd?: (event: { nativeEvent: { positionMs: number; durationMs: number } }) => void;
  /** Fired when the volume or mute state changes. */
  onVolumeChange?: (event: { nativeEvent: { volume: number; isMuted: boolean } }) => void;
  /** Fired when the playback rate changes. */
  onPlaybackRateChange?: (event: { nativeEvent: { rate: number } }) => void;
}

// --- Ref / commands ---

/**
 * Imperative commands available via a ref to {@link BunnyStreamPlayer}.
 *
 * These map 1:1 to the Codegen `NativeCommands`. Commands issued before
 * `STATE_READY` are queued on the native side and drained when the player
 * becomes ready.
 */
export type BunnyStreamPlayerRef = {
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
};

// --- initialize ---

/**
 * Initialises the Bunny Stream SDK with an API access key and library ID.
 *
 * Must be called once, early in app startup, before any
 * {@link BunnyStreamPlayer} is mounted. On Android this delegates to
 * `BunnyStreamApi.initialize(context, accessKey, libraryId)`.
 *
 * @param accessKey  Bunny Stream API access key. Required for token-secured
 *                   playback and for the TUS uploader. May be `null` for
 *                   public videos, but functionality will be limited.
 * @param libraryId  The library ID to use for playback and API calls.
 */
export function initialize(accessKey: string | null, libraryId: number): void {
  NativeBunnyStreamPlayer.initialize(accessKey, libraryId);
}

// --- Component ---

const NativeBunnyStreamPlayerView =
  BunnyStreamPlayerNativeComponent as unknown as HostComponent<BunnyStreamPlayerProps>;

/**
 * `BunnyStreamPlayer` — a React Native component that renders the native
 * Bunny Stream player (Media3/ExoPlayer on Android, AVKit on iOS).
 *
 * The player fills its parent — set `style` width/height or use flex.
 * Only one active instance is supported at a time due to the SDK's
 * singleton design; mounting a second player will pause and clean up
 * the first.
 *
 * @example
 * ```tsx
 * import { BunnyStreamPlayer, initialize } from 'bunny-stream-react-native';
 *
 * initialize(ACCESS_KEY, LIBRARY_ID);
 *
 * <BunnyStreamPlayer
 *   videoId="abc-123"
 *   autoPlay
 *   onReady={(e) => console.log('duration', e.nativeEvent.durationMs)}
 *   onProgress={(e) => console.log('progress', e.nativeEvent.progress)}
 * />
 * ```
 */
export const BunnyStreamPlayer = React.forwardRef<BunnyStreamPlayerRef, BunnyStreamPlayerProps>(
  (props, ref) => {
    const nativeRef = React.useRef<React.ElementRef<HostComponent<BunnyStreamPlayerProps>> | null>(
      null,
    );

    React.useImperativeHandle(ref, () => ({
      play: () => {
        if (nativeRef.current) NativeCommands.play(nativeRef.current);
      },
      pause: () => {
        if (nativeRef.current) NativeCommands.pause(nativeRef.current);
      },
      seekTo: (positionMs: number) => {
        if (nativeRef.current) NativeCommands.seekTo(nativeRef.current, positionMs);
      },
      setVolume: (volume: number) => {
        if (nativeRef.current) NativeCommands.setVolume(nativeRef.current, volume);
      },
      setPlaybackRate: (rate: number) => {
        if (nativeRef.current) NativeCommands.setPlaybackRate(nativeRef.current, rate);
      },
    }));

    return <NativeBunnyStreamPlayerView ref={nativeRef} {...props} />;
  },
);

BunnyStreamPlayer.displayName = 'BunnyStreamPlayer';

// Keep the version export for backwards compatibility.
export const BUNNY_STREAM_REACT_NATIVE_VERSION = '0.1.0';
