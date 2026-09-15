import type { HostComponent, ViewProps } from 'react-native';
import type {
  DirectEventHandler,
  Double,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

import { codegenNativeCommands, codegenNativeComponent } from 'react-native';

export type PlayerPlaybackState =
  'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export type PlayerReadyEvent = Readonly<{
  videoId: string;
  durationMs: Double;
}>;

export type PlayerStateChangeEvent = Readonly<{
  state: string;
  positionMs: Double;
}>;

export type PlayerProgressEvent = Readonly<{
  positionMs: Double;
  durationMs: Double;
  progress: Double;
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
  positionMs: Double;
  durationMs: Double;
}>;

export type PlayerVolumeChangeEvent = Readonly<{
  volume: Double;
  isMuted: boolean;
}>;

export type PlayerPlaybackRateChangeEvent = Readonly<{
  rate: Double;
}>;

export type PlayerVideoSizeChangeEvent = Readonly<{
  width: Int32;
  height: Int32;
}>;

export type PlayerPlaybackErrorEvent = Readonly<{
  message: string;
}>;

// Phase 6 — chapters, moments, retention graph (Android-only events).
// Codegen does not support arrays in event payloads, so the lists are
// serialized as JSON strings and deserialized on the JS side.
export type ChaptersUpdatedEvent = Readonly<{
  chapters: string;
}>;

export type MomentsUpdatedEvent = Readonly<{
  moments: string;
}>;

export type RetentionGraphUpdatedEvent = Readonly<{
  points: string;
}>;

// Phase 6 — resume position (Android-only event).
export type ResumePositionAvailableEvent = Readonly<{
  position: string;
}>;

// Phase 7 — cast handover (Android-only event). `playerType` is
// 'default' or 'cast'; iOS never emits this event.
export type PlayerTypeChangeEvent = Readonly<{
  playerType: string;
}>;

export interface NativeProps extends ViewProps {
  videoId: string;
  libraryId?: Double;
  token?: string;
  expires?: Double;
  autoPlay?: WithDefault<boolean, true>;
  controls?: WithDefault<boolean, true>;
  onReady?: DirectEventHandler<PlayerReadyEvent> | null;
  onPlaybackStateChange?: DirectEventHandler<PlayerStateChangeEvent> | null;
  onProgress?: DirectEventHandler<PlayerProgressEvent> | null;
  onError?: DirectEventHandler<PlayerErrorEvent> | null;
  onBuffering?: DirectEventHandler<PlayerBufferingEvent> | null;
  onPlay?: DirectEventHandler<PlayerPositionEvent> | null;
  onPause?: DirectEventHandler<PlayerPositionEvent> | null;
  onEnd?: DirectEventHandler<PlayerPositionEvent> | null;
  onVolumeChange?: DirectEventHandler<PlayerVolumeChangeEvent> | null;
  onPlaybackRateChange?: DirectEventHandler<PlayerPlaybackRateChangeEvent> | null;
  onVideoSizeChange?: DirectEventHandler<PlayerVideoSizeChangeEvent> | null;
  onPlaybackError?: DirectEventHandler<PlayerPlaybackErrorEvent> | null;
  // Phase 6 — Android-only player events (iOS does not expose these).
  resumeConfig?: string; // JSON-serialized ResumeConfig (Android-only).
  onChaptersUpdated?: DirectEventHandler<ChaptersUpdatedEvent> | null;
  onMomentsUpdated?: DirectEventHandler<MomentsUpdatedEvent> | null;
  onRetentionGraphUpdated?: DirectEventHandler<RetentionGraphUpdatedEvent> | null;
  onResumePositionAvailable?: DirectEventHandler<ResumePositionAvailableEvent> | null;
  // Phase 7 — Android-only: route video through `playVideoWithTVDetection`,
  // which launches the `net.bunny:tv` activity when the device is a TV and the
  // artifact is on the classpath, otherwise falls back to `playVideo`.
  useNativeTvPlayer?: WithDefault<boolean, false>;
  onPlayerTypeChange?: DirectEventHandler<PlayerTypeChangeEvent> | null;
}

export interface NativeCommands {
  play: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  pause: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  seekTo: (viewRef: React.ElementRef<HostComponent<NativeProps>>, positionMs: Double) => void;
  setVolume: (viewRef: React.ElementRef<HostComponent<NativeProps>>, volume: Double) => void;
  setPlaybackRate: (viewRef: React.ElementRef<HostComponent<NativeProps>>, rate: Double) => void;
  mute: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  unmute: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  // Phase 7 — Android-only: enters picture-in-picture on the host activity.
  // No-op on iOS (the SDK exposes no public PiP API).
  enterPiP: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: [
    'play',
    'pause',
    'seekTo',
    'setVolume',
    'setPlaybackRate',
    'mute',
    'unmute',
    'enterPiP',
  ],
});

export default codegenNativeComponent<NativeProps>(
  'BunnyStreamPlayerView',
) as HostComponent<NativeProps>;
