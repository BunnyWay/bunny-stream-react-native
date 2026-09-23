import type { BunnyStreamBroadcasterProps, BunnyStreamBroadcasterRef } from './types';
import type { HostComponent } from 'react-native';

import * as React from 'react';

import BunnyStreamBroadcasterNativeComponent, {
  Commands as NativeCommands,
  type NativeProps,
} from '../specs/BunnyStreamBroadcasterNativeComponent';

const NativeView = BunnyStreamBroadcasterNativeComponent as unknown as HostComponent<NativeProps>;

type NativeViewRef = React.ElementRef<HostComponent<NativeProps>> | null;

/**
 * `BunnyStreamBroadcaster` renders the native Bunny Stream camera broadcast
 * view for recording a new VOD or broadcasting to an existing live stream.
 *
 * The broadcaster fills its parent. Camera and microphone permissions must
 * be granted by the host app before mounting — the SDK does not request them.
 *
 * **Platform differences:**
 * - **iOS:** Quality is fully configurable via the `quality` prop.
 *   `startBroadcast` is supported natively.
 * - **Android:** Quality is hard-coded by the SDK (1080p30, ~9.3 Mbps) and
 *   the `quality` prop is ignored. `startBroadcast` simulates the built-in
 *   start button when `hideDefaultControls` is `false`; when controls are
 *   hidden, it resolves with an `InvalidState` error (the Android SDK exposes
 *   no public start method — verified in 4.0.0).
 *
 * @example
 * ```tsx
 * <BunnyStreamBroadcaster
 *   accessKey="access-key"
 *   source={{ type: 'live', libraryId: 123, streamId: 'stream-id' }}
 *   cameraPosition="back"
 * />
 * ```
 */
export const BunnyStreamBroadcaster = React.forwardRef<
  BunnyStreamBroadcasterRef,
  BunnyStreamBroadcasterProps
>((props, ref) => {
  const nativeRef = React.useRef<unknown>(null);

  React.useImperativeHandle(ref, () => ({
    startBroadcast: () => {
      const view = nativeRef.current as NativeViewRef;
      if (view) NativeCommands.startBroadcast(view);
    },
    stopBroadcast: () => {
      const view = nativeRef.current as NativeViewRef;
      if (view) NativeCommands.stopBroadcast(view);
    },
    switchCamera: () => {
      const view = nativeRef.current as NativeViewRef;
      if (view) NativeCommands.switchCamera(view);
    },
    setMuted: (muted: boolean) => {
      const view = nativeRef.current as NativeViewRef;
      if (view) NativeCommands.setMuted(view, muted);
    },
    toggleMute: () => {
      const view = nativeRef.current as NativeViewRef;
      if (view) NativeCommands.toggleMute(view);
    },
  }));

  const {
    accessKey,
    source,
    quality,
    cameraPosition = 'back',
    hideDefaultControls = false,
    dualPublish = false,
    autoStart = false,
    onStateChange,
    onElapsedTime,
    onCameraChange,
    onMuteChange,
    onIngestStateChange,
    onReconnecting,
    onReconnectFailed,
    onFailover,
    onError,
    style,
  } = props;

  const streamId = source.type === 'live' ? source.streamId : undefined;
  const ingestEndpoint = source.type === 'live' ? source.ingestEndpoint : undefined;

  const qualityJson = quality ? JSON.stringify(quality) : undefined;

  return (
    <NativeView
      ref={nativeRef as React.RefObject<NativeViewRef | null>}
      accessKey={accessKey}
      libraryId={source.libraryId}
      streamId={streamId}
      ingestEndpoint={ingestEndpoint}
      quality={qualityJson}
      cameraPosition={cameraPosition}
      hideDefaultControls={hideDefaultControls}
      dualPublish={dualPublish}
      autoStart={autoStart}
      onStateChange={onStateChange ? (e) => onStateChange(e.nativeEvent) : undefined}
      onElapsedTime={onElapsedTime ? (e) => onElapsedTime(e.nativeEvent) : undefined}
      onCameraChange={onCameraChange ? (e) => onCameraChange(e.nativeEvent) : undefined}
      onMuteChange={onMuteChange ? (e) => onMuteChange(e.nativeEvent) : undefined}
      onIngestStateChange={
        onIngestStateChange ? (e) => onIngestStateChange(e.nativeEvent) : undefined
      }
      onReconnecting={onReconnecting ? (e) => onReconnecting(e.nativeEvent) : undefined}
      onReconnectFailed={onReconnectFailed ? () => onReconnectFailed() : undefined}
      onFailover={onFailover ? (e) => onFailover(e.nativeEvent) : undefined}
      onError={onError ? (e) => onError(e.nativeEvent) : undefined}
      style={style}
    />
  );
});

BunnyStreamBroadcaster.displayName = 'BunnyStreamBroadcaster';
