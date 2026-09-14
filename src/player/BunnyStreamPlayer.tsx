import type {
  BunnyStreamPlayerProps,
  BunnyVodPlayerRef,
  Chapter,
  Moment,
  PlaybackPosition,
  RetentionGraphEntry,
} from './BunnyStreamPlayer.types';
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

    // Tracks the last known VOD position so skipForward/skipBackward can seek
    // relative to it without a round-trip to the native side.
    const lastPositionRef = React.useRef(0);

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
      skipForward: (offsetMs = 10_000) =>
        runVodCommand((view) => NativeCommands.seekTo(view, lastPositionRef.current + offsetMs)),
      skipBackward: (offsetMs = 10_000) =>
        runVodCommand((view) =>
          NativeCommands.seekTo(view, Math.max(0, lastPositionRef.current - offsetMs)),
        ),
      setVolume: (volume: number) =>
        runVodCommand((view) => NativeCommands.setVolume(view, volume)),
      setPlaybackRate: (rate: number) =>
        runVodCommand((view) => NativeCommands.setPlaybackRate(view, rate)),
      mute: () => runVodCommand((view) => NativeCommands.mute(view)),
      unmute: () => runVodCommand((view) => NativeCommands.unmute(view)),
      enterPiP: () => runVodCommand((view) => NativeCommands.enterPiP(view)),
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
      onChaptersUpdated,
      onMomentsUpdated,
      onRetentionGraphUpdated,
      onResumePositionAvailable,
      resumeConfig,
      useNativeTvPlayer,
      onPlayerTypeChange,
      style,
      ...viewProps
    } = rest;

    // Track the last known VOD position for skipForward/skipBackward.
    const trackedOnProgress = onProgress
      ? (event: { nativeEvent: { positionMs: number; durationMs: number; progress: number } }) => {
          lastPositionRef.current = event.nativeEvent.positionMs;
          onProgress(event);
        }
      : undefined;

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
        onProgress={trackedOnProgress}
        onError={onError}
        onBuffering={onBuffering}
        onPlay={onPlay}
        onPause={onPause}
        onEnd={onEnd}
        onVolumeChange={onVolumeChange}
        onPlaybackRateChange={onPlaybackRateChange}
        onVideoSizeChange={onVideoSizeChange}
        onPlaybackError={onPlaybackError}
        resumeConfig={resumeConfig ? JSON.stringify(resumeConfig) : undefined}
        onChaptersUpdated={
          onChaptersUpdated
            ? (e) => {
                try {
                  const chapters = JSON.parse(e.nativeEvent.chapters) as Chapter[];
                  onChaptersUpdated({ nativeEvent: { chapters } });
                } catch {
                  /* ignore malformed payload */
                }
              }
            : undefined
        }
        onMomentsUpdated={
          onMomentsUpdated
            ? (e) => {
                try {
                  const moments = JSON.parse(e.nativeEvent.moments) as Moment[];
                  onMomentsUpdated({ nativeEvent: { moments } });
                } catch {
                  /* ignore malformed payload */
                }
              }
            : undefined
        }
        onRetentionGraphUpdated={
          onRetentionGraphUpdated
            ? (e) => {
                try {
                  const points = JSON.parse(e.nativeEvent.points) as RetentionGraphEntry[];
                  onRetentionGraphUpdated({ nativeEvent: { points } });
                } catch {
                  /* ignore malformed payload */
                }
              }
            : undefined
        }
        onResumePositionAvailable={
          onResumePositionAvailable
            ? (e) => {
                try {
                  const position = JSON.parse(e.nativeEvent.position) as PlaybackPosition;
                  onResumePositionAvailable({ nativeEvent: { position } });
                } catch {
                  /* ignore malformed payload */
                }
              }
            : undefined
        }
        useNativeTvPlayer={useNativeTvPlayer}
        onPlayerTypeChange={
          onPlayerTypeChange
            ? (e) => {
                const playerType = e.nativeEvent.playerType === 'cast' ? 'cast' : 'default';
                onPlayerTypeChange({ nativeEvent: { playerType } });
              }
            : undefined
        }
        style={style}
        {...viewProps}
      />
    );
  },
);

BunnyStreamPlayer.displayName = 'BunnyStreamPlayer';
