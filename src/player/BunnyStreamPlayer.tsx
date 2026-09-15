import type { BunnyStreamPlayerProps, BunnyVodPlayerRef } from './BunnyStreamPlayer.types';
import type { HostComponent } from 'react-native';

import * as React from 'react';
import { Platform } from 'react-native';

import { normalizeLiveStateEvent } from '../internal/liveStateEvent';
import BunnyLiveStreamPlayerNativeComponent, {
  type NativeProps as LiveNativeProps,
} from '../specs/BunnyLiveStreamPlayerNativeComponent';
import BunnyStreamPlayerNativeComponent, {
  Commands as NativeCommands,
  type NativeProps as VodNativeProps,
} from '../specs/BunnyStreamPlayerNativeComponent';
import { sourceIdentityKey } from './sourceIdentity';

const NativeVodView = BunnyStreamPlayerNativeComponent as unknown as HostComponent<VodNativeProps>;
const NativeLiveView =
  BunnyLiveStreamPlayerNativeComponent as unknown as HostComponent<LiveNativeProps>;

/**
 * `BunnyStreamPlayer` renders the native Bunny Stream player for VOD or live
 * sources. It selects the internal native host automatically and remounts it
 * when the source identity changes, so the SDK ViewModel and player engine are
 * cleanly torn down and recreated.
 *
 * The player fills its parent. Only one active VOD instance is supported at a
 * time because of the native SDK singleton design. Live uses a separate native
 * host but shares the same public component.
 *
 * @example
 * ```tsx
 * <BunnyStreamPlayer source={{ type: 'vod', videoId }} autoPlay />
 * <BunnyStreamPlayer source={{ type: 'live', streamId, libraryId }} />
 * ```
 */
type VodView = React.ElementRef<HostComponent<VodNativeProps>> | null;

export const BunnyStreamPlayer = React.forwardRef<BunnyVodPlayerRef, BunnyStreamPlayerProps>(
  (props, ref) => {
    const { source, ...rest } = props;
    // The SDK does not expose a public live controller, so VOD commands are
    // guarded here instead of being sent to the commandless live native host.
    const sourceTypeRef = React.useRef(source.type);
    sourceTypeRef.current = source.type;
    // The ref holds either native host and is cast to the relevant Codegen type
    // only when a command or host-specific prop is used.
    const nativeRef = React.useRef<unknown>(null);

    // Guards a VOD-only command: no-op for live sources, then resolves the
    // native view and invokes the Codegen command on it.
    const runVodCommand = (fn: (view: NonNullable<VodView>) => void) => {
      if (sourceTypeRef.current !== 'vod') return;
      const view = nativeRef.current as VodView;
      if (view) fn(view);
    };

    React.useImperativeHandle(ref, () => ({
      play: () => runVodCommand((view) => NativeCommands.play(view)),
      pause: () => runVodCommand((view) => NativeCommands.pause(view)),
      seekTo: (positionMs: number) =>
        runVodCommand((view) => NativeCommands.seekTo(view, positionMs)),
      setVolume: (volume: number) =>
        runVodCommand((view) => NativeCommands.setVolume(view, volume)),
      setPlaybackRate: (rate: number) =>
        runVodCommand((view) => NativeCommands.setPlaybackRate(view, rate)),
      mute: () => runVodCommand((view) => NativeCommands.mute(view)),
      unmute: () => runVodCommand((view) => NativeCommands.unmute(view)),
    }));

    // A source identity change remounts the native host so the previous player
    // and SDK-owned state are fully released.
    const hostKey = sourceIdentityKey(source);

    // Keep generic ViewProps separate from host-specific props and events.
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
      const nativeOnLiveStateChange: LiveNativeProps['onLiveStateChange'] = onLiveStateChange
        ? (event) => {
            // TODO(iOS SDK): Preserve `dvrEnabled` on iOS after the public live callback
            // exposes it. Codegen serialises a missing boolean as false on the iOS bridge.
            const nativeEvent = normalizeLiveStateEvent(event.nativeEvent, Platform.OS);
            onLiveStateChange({ nativeEvent });
          }
        : undefined;

      // The live SDK reports terminal failures through `onLiveError`; its
      // native recovery flow owns lower-level playback errors.
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
          onLiveStateChange={nativeOnLiveStateChange}
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
