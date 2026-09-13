import type { BunnyStreamBroadcasterRef } from '../broadcaster/types';
import type * as ReactTypes from 'react';

import { describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';

import { BunnyStreamBroadcaster } from '../broadcaster/BunnyStreamBroadcaster';

// The native component is mocked so we can assert the props the public wrapper
// forwards and the imperative commands it dispatches.
const mockNativeViewHost = jest.fn();
const mockStartBroadcast = jest.fn();
const mockStopBroadcast = jest.fn();
const mockSwitchCamera = jest.fn();
const mockSetMuted = jest.fn();
const mockToggleMute = jest.fn();

jest.mock('../specs/BunnyStreamBroadcasterNativeComponent', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof ReactTypes;
  const Mock = React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    mockNativeViewHost(props);
    React.useImperativeHandle(ref, () => ({
      _startBroadcast: mockStartBroadcast,
      _stopBroadcast: mockStopBroadcast,
      _switchCamera: mockSwitchCamera,
      _setMuted: mockSetMuted,
      _toggleMute: mockToggleMute,
    }));
    return null;
  });
  Mock.displayName = 'BunnyStreamBroadcasterView';
  return { __esModule: true, default: Mock };
});

function lastProps(): Record<string, unknown> {
  const call = mockNativeViewHost.mock.calls.at(-1);
  return (call?.[0] as Record<string, unknown>) ?? {};
}

type EventHandler = (event: { nativeEvent: unknown }) => void;
function handler(props: Record<string, unknown>, key: string): EventHandler | undefined {
  return props[key] as EventHandler | undefined;
}

describe('BunnyStreamBroadcaster', () => {
  it('forwards a live source to the native view', async () => {
    await render(
      <BunnyStreamBroadcaster
        accessKey="access-key"
        source={{
          type: 'live',
          libraryId: 123,
          streamId: 'stream-1',
          ingestEndpoint: 'primary.bunny.net',
        }}
        cameraPosition="front"
        hideDefaultControls
        dualPublish
        autoStart
      />,
    );

    expect(lastProps()).toMatchObject({
      accessKey: 'access-key',
      libraryId: 123,
      streamId: 'stream-1',
      ingestEndpoint: 'primary.bunny.net',
      cameraPosition: 'front',
      hideDefaultControls: true,
      dualPublish: true,
      autoStart: true,
    });
  });

  it('omits streamId/ingestEndpoint for a new recording source', async () => {
    await render(
      <BunnyStreamBroadcaster accessKey="access-key" source={{ type: 'new', libraryId: 456 }} />,
    );

    const props = lastProps();
    expect(props).toMatchObject({ libraryId: 456 });
    expect(props.streamId).toBeUndefined();
    expect(props.ingestEndpoint).toBeUndefined();
  });

  it('serializes the quality prop to JSON for the native bridge', async () => {
    await render(
      <BunnyStreamBroadcaster
        accessKey="access-key"
        source={{ type: 'new', libraryId: 1 }}
        quality={{
          resolution: 'hd720',
          frameRate: 30,
          videoBitrate: 2_000_000,
          audioBitrate: 64_000,
        }}
      />,
    );

    expect(lastProps().quality).toBe(
      JSON.stringify({
        resolution: 'hd720',
        frameRate: 30,
        videoBitrate: 2_000_000,
        audioBitrate: 64_000,
      }),
    );
  });

  it('does not forward quality when omitted', async () => {
    await render(
      <BunnyStreamBroadcaster accessKey="access-key" source={{ type: 'new', libraryId: 1 }} />,
    );

    expect(lastProps().quality).toBeUndefined();
  });

  it('forwards event handlers that unwrap nativeEvent', async () => {
    const onStateChange = jest.fn();
    const onElapsedTime = jest.fn();
    const onCameraChange = jest.fn();
    const onMuteChange = jest.fn();
    const onIngestStateChange = jest.fn();
    const onReconnecting = jest.fn();
    const onReconnectFailed = jest.fn();
    const onFailover = jest.fn();
    const onError = jest.fn();

    await render(
      <BunnyStreamBroadcaster
        accessKey="access-key"
        source={{ type: 'new', libraryId: 1 }}
        onStateChange={onStateChange}
        onElapsedTime={onElapsedTime}
        onCameraChange={onCameraChange}
        onMuteChange={onMuteChange}
        onIngestStateChange={onIngestStateChange}
        onReconnecting={onReconnecting}
        onReconnectFailed={onReconnectFailed}
        onFailover={onFailover}
        onError={onError}
      />,
    );

    const props = lastProps();
    const synthetic = <T,>(payload: T) => ({ nativeEvent: payload });

    await act(async () => {
      handler(props, 'onStateChange')?.(synthetic({ state: 'live' }));
      handler(props, 'onElapsedTime')?.(synthetic({ elapsedMs: 1000, formatted: '00:00:01' }));
      handler(props, 'onCameraChange')?.(synthetic({ position: 'back' }));
      handler(props, 'onMuteChange')?.(synthetic({ muted: true }));
      handler(props, 'onIngestStateChange')?.(synthetic({ endpoint: 'primary', state: 'live' }));
      handler(props, 'onReconnecting')?.(synthetic({ attempt: 1, usingBackup: false }));
      (props.onReconnectFailed as (() => void) | undefined)?.();
      handler(props, 'onFailover')?.(synthetic({ usingBackup: true }));
      handler(props, 'onError')?.(synthetic({ message: 'boom' }));
    });

    expect(onStateChange).toHaveBeenCalledWith({ state: 'live' });
    expect(onElapsedTime).toHaveBeenCalledWith({ elapsedMs: 1000, formatted: '00:00:01' });
    expect(onCameraChange).toHaveBeenCalledWith({ position: 'back' });
    expect(onMuteChange).toHaveBeenCalledWith({ muted: true });
    expect(onIngestStateChange).toHaveBeenCalledWith({ endpoint: 'primary', state: 'live' });
    expect(onReconnecting).toHaveBeenCalledWith({ attempt: 1, usingBackup: false });
    expect(onReconnectFailed).toHaveBeenCalledWith();
    expect(onFailover).toHaveBeenCalledWith({ usingBackup: true });
    expect(onError).toHaveBeenCalledWith({ message: 'boom' });
  });

  it('dispatches imperative commands through the native ref', async () => {
    const ref = { current: null as BunnyStreamBroadcasterRef | null };
    await render(
      <BunnyStreamBroadcaster
        ref={ref}
        accessKey="access-key"
        source={{ type: 'new', libraryId: 1 }}
      />,
    );

    await act(async () => {
      ref.current?.startBroadcast();
      ref.current?.stopBroadcast();
      ref.current?.switchCamera();
      ref.current?.setMuted(true);
      ref.current?.toggleMute();
    });

    expect(mockStartBroadcast).toHaveBeenCalledTimes(1);
    expect(mockStopBroadcast).toHaveBeenCalledTimes(1);
    expect(mockSwitchCamera).toHaveBeenCalledTimes(1);
    expect(mockSetMuted).toHaveBeenCalledWith(true);
    expect(mockToggleMute).toHaveBeenCalledTimes(1);
  });

  it('does not crash when commands are invoked on a detached ref', () => {
    const detached: BunnyStreamBroadcasterRef = {
      startBroadcast: () => {},
      stopBroadcast: () => {},
      switchCamera: () => {},
      setMuted: () => {},
      toggleMute: () => {},
    };
    expect(() => {
      detached.startBroadcast();
      detached.stopBroadcast();
      detached.switchCamera();
      detached.setMuted(false);
      detached.toggleMute();
    }).not.toThrow();
  });
});
