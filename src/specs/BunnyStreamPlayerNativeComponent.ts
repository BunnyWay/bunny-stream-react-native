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
}

export interface NativeCommands {
  play: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  pause: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  seekTo: (viewRef: React.ElementRef<HostComponent<NativeProps>>, positionMs: Double) => void;
  setVolume: (viewRef: React.ElementRef<HostComponent<NativeProps>>, volume: Double) => void;
  setPlaybackRate: (viewRef: React.ElementRef<HostComponent<NativeProps>>, rate: Double) => void;
  mute: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  unmute: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['play', 'pause', 'seekTo', 'setVolume', 'setPlaybackRate', 'mute', 'unmute'],
});

export default codegenNativeComponent<NativeProps>(
  'BunnyStreamPlayerView',
) as HostComponent<NativeProps>;
