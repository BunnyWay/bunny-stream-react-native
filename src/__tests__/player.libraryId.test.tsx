import type { BunnyStreamSource } from '../player/BunnyStreamPlayer.types';
import type * as ReactTypes from 'react';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import * as React from 'react';

import { getConfiguredLibraryId } from '../config/initialize';
import { BunnyStreamPlayer } from '../player/BunnyStreamPlayer';
import { useBunnyStreamPlayer } from '../player/hooks/useBunnyStreamPlayer';

const mockVodHost = jest.fn();
const mockLiveHost = jest.fn();
const mockVodMount = jest.fn();
const mockLiveMount = jest.fn();
const mockVodUnmount = jest.fn();
const mockLiveUnmount = jest.fn();

jest.mock('../config/initialize', () => ({
  getConfiguredLibraryId: jest.fn(),
}));

jest.mock('../specs/BunnyStreamPlayerNativeComponent', () => {
  const React = jest.requireActual<typeof ReactTypes>('react');
  return {
    __esModule: true,
    default: React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      mockVodHost(props);
      React.useImperativeHandle(ref, () => ({}));
      React.useEffect(() => {
        mockVodMount();
        return () => {
          mockVodUnmount();
        };
      }, []);
      return null;
    }),
    Commands: {
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      setVolume: jest.fn(),
      setPlaybackRate: jest.fn(),
      mute: jest.fn(),
      unmute: jest.fn(),
      enterPiP: jest.fn(),
      setVideoQuality: jest.fn(),
    },
  };
});

jest.mock('../specs/BunnyLiveStreamPlayerNativeComponent', () => {
  const React = jest.requireActual<typeof ReactTypes>('react');
  return {
    __esModule: true,
    default: React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      mockLiveHost(props);
      React.useImperativeHandle(ref, () => ({}));
      React.useEffect(() => {
        mockLiveMount();
        return () => {
          mockLiveUnmount();
        };
      }, []);
      return null;
    }),
  };
});

function sourceFor(type: 'vod' | 'live', libraryId?: number): BunnyStreamSource {
  return type === 'vod'
    ? { type, libraryId, videoId: 'video-id' }
    : { type, libraryId, streamId: 'stream-id' };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getConfiguredLibraryId).mockReturnValue(undefined);
});

describe.each(['vod', 'live'] as const)('%s library resolution', (sourceType) => {
  const host = sourceType === 'vod' ? mockVodHost : mockLiveHost;
  const mount = sourceType === 'vod' ? mockVodMount : mockLiveMount;
  const unmount = sourceType === 'vod' ? mockVodUnmount : mockLiveUnmount;

  it('forwards the configured library when the source omits it', async () => {
    jest.mocked(getConfiguredLibraryId).mockReturnValue(123);
    await render(<BunnyStreamPlayer source={sourceFor(sourceType)} />);

    expect(host.mock.calls.at(-1)?.[0]).toMatchObject({ libraryId: 123 });
  });

  it('prefers an explicit library over the configured library', async () => {
    jest.mocked(getConfiguredLibraryId).mockReturnValue(123);
    await render(<BunnyStreamPlayer source={sourceFor(sourceType, 456)} />);

    expect(host.mock.calls.at(-1)?.[0]).toMatchObject({ libraryId: 456 });
  });

  it('forwards an explicit library without a JS configuration', async () => {
    await render(<BunnyStreamPlayer source={sourceFor(sourceType, 456)} />);

    expect(host.mock.calls.at(-1)?.[0]).toMatchObject({ libraryId: 456 });
  });

  it('preserves source authorization and presentation props when using the fallback', async () => {
    jest.mocked(getConfiguredLibraryId).mockReturnValue(123);
    await render(
      <BunnyStreamPlayer
        source={{ ...sourceFor(sourceType), token: 'view-token', expires: 2000000000 }}
        controls={false}
      />,
    );

    expect(host.mock.calls.at(-1)?.[0]).toMatchObject({
      libraryId: 123,
      token: 'view-token',
      expires: 2000000000,
      controls: false,
    });
  });

  it('reports a missing library without mounting either native host', async () => {
    const onError = jest.fn();
    await render(<BunnyStreamPlayer source={sourceFor(sourceType)} onError={onError} />);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({
      nativeEvent: {
        code: 'MISSING_LIBRARY_ID',
        message: expect.stringContaining('initialize()'),
      },
    });
    expect(mockVodHost).not.toHaveBeenCalled();
    expect(mockLiveHost).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity, -Infinity, '123', false])(
    'reports invalid ID %s without silently falling back',
    async (libraryId) => {
      jest.mocked(getConfiguredLibraryId).mockReturnValue(123);
      const onError = jest.fn();
      await render(
        <BunnyStreamPlayer source={sourceFor(sourceType, libraryId as number)} onError={onError} />,
      );

      expect(onError).toHaveBeenCalledWith({
        nativeEvent: {
          code: 'INVALID_LIBRARY_ID',
          message: expect.stringContaining('positive integer'),
        },
      });
      expect(mockVodHost).not.toHaveBeenCalled();
      expect(mockLiveHost).not.toHaveBeenCalled();
    },
  );

  it('throws for a missing library without an error handler', async () => {
    await expect(render(<BunnyStreamPlayer source={sourceFor(sourceType)} />)).rejects.toThrow(
      'MISSING_LIBRARY_ID',
    );
    expect(host).not.toHaveBeenCalled();
  });

  it('throws for an invalid library without an error handler', async () => {
    await expect(render(<BunnyStreamPlayer source={sourceFor(sourceType, 0)} />)).rejects.toThrow(
      'INVALID_LIBRARY_ID',
    );
    expect(host).not.toHaveBeenCalled();
  });

  it('allows an Error Boundary to catch a configuration error', async () => {
    const onCaught = jest.fn();
    class Boundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
      state = { error: null as Error | null };

      static getDerivedStateFromError(error: Error) {
        return { error };
      }

      componentDidCatch(error: Error) {
        onCaught(error.message);
      }

      render() {
        return this.state.error ? null : this.props.children;
      }
    }

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await render(
        <Boundary>
          <BunnyStreamPlayer source={sourceFor(sourceType)} />
        </Boundary>,
      );

      expect(onCaught).toHaveBeenCalledWith(expect.stringContaining('MISSING_LIBRARY_ID'));
      expect(host).not.toHaveBeenCalled();
      for (const [label, error] of consoleError.mock.calls) {
        expect(label).toBe('Caught error:');
        expect(error).toMatchObject({ message: expect.stringContaining('MISSING_LIBRARY_ID') });
      }
    } finally {
      consoleError.mockRestore();
    }
  });

  it('does not duplicate errors on rerender, callback replacement or Strict Mode replay', async () => {
    const onError = jest.fn();
    const nextOnError = jest.fn();
    const view = await render(
      <React.StrictMode>
        <BunnyStreamPlayer source={sourceFor(sourceType)} onError={onError} />
      </React.StrictMode>,
    );
    await view.rerender(
      <React.StrictMode>
        <BunnyStreamPlayer source={sourceFor(sourceType)} onError={nextOnError} />
      </React.StrictMode>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(nextOnError).not.toHaveBeenCalled();
  });

  it('recovers after configuration and reports a new error episode', async () => {
    const onError = jest.fn();
    const view = await render(
      <BunnyStreamPlayer source={sourceFor(sourceType)} onError={onError} />,
    );
    jest.mocked(getConfiguredLibraryId).mockReturnValue(123);
    await view.rerender(<BunnyStreamPlayer source={sourceFor(sourceType)} onError={onError} />);
    expect(host.mock.calls.at(-1)?.[0]).toMatchObject({ libraryId: 123 });

    jest.mocked(getConfiguredLibraryId).mockReturnValue(undefined);
    await view.rerender(<BunnyStreamPlayer source={sourceFor(sourceType)} onError={onError} />);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('remounts when the effective library changes on rerender', async () => {
    jest.mocked(getConfiguredLibraryId).mockReturnValue(123);
    const view = await render(<BunnyStreamPlayer source={sourceFor(sourceType)} />);
    jest.mocked(getConfiguredLibraryId).mockReturnValue(456);
    await view.rerender(<BunnyStreamPlayer source={sourceFor(sourceType)} />);

    expect(host.mock.calls.at(-1)?.[0]).toMatchObject({ libraryId: 456 });
    expect(mount).toHaveBeenCalledTimes(2);
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it('does not remount when a fallback becomes the same explicit library', async () => {
    jest.mocked(getConfiguredLibraryId).mockReturnValue(123);
    const view = await render(<BunnyStreamPlayer source={sourceFor(sourceType)} />);
    await view.rerender(<BunnyStreamPlayer source={sourceFor(sourceType, 123)} />);

    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();
  });
});

describe('configuration error lifecycle', () => {
  it('replaces the native host when switching between VOD and live', async () => {
    jest.mocked(getConfiguredLibraryId).mockReturnValue(123);
    const view = await render(<BunnyStreamPlayer source={sourceFor('vod')} />);
    await view.rerender(<BunnyStreamPlayer source={sourceFor('live')} />);

    expect(mockVodMount).toHaveBeenCalledTimes(1);
    expect(mockVodUnmount).toHaveBeenCalledTimes(1);
    expect(mockLiveMount).toHaveBeenCalledTimes(1);
    expect(mockLiveHost.mock.calls.at(-1)?.[0]).toMatchObject({ libraryId: 123 });
  });

  it('reports changes to the source or invalid value as distinct errors', async () => {
    const onError = jest.fn();
    const view = await render(<BunnyStreamPlayer source={sourceFor('vod', 0)} onError={onError} />);
    await view.rerender(<BunnyStreamPlayer source={sourceFor('vod', -1)} onError={onError} />);
    await view.rerender(<BunnyStreamPlayer source={sourceFor('live', -1)} onError={onError} />);

    expect(onError).toHaveBeenCalledTimes(3);
  });

  it('keeps native live errors on onLiveError', async () => {
    const onError = jest.fn();
    const onLiveError = jest.fn();
    await render(
      <BunnyStreamPlayer
        source={sourceFor('live', 123)}
        onError={onError}
        onLiveError={onLiveError}
      />,
    );

    expect(mockLiveHost.mock.calls.at(-1)?.[0]).toMatchObject({ onLiveError });
    expect(mockLiveHost.mock.calls.at(-1)?.[0]).not.toHaveProperty('onError');
    expect(onError).not.toHaveBeenCalled();
  });

  it('updates the aggregated hook state for a live configuration error', async () => {
    const onError = jest.fn();
    const states: ReturnType<typeof useBunnyStreamPlayer>['state'][] = [];
    function Player() {
      const player = useBunnyStreamPlayer({ onError });
      states.push(player.state);
      return <BunnyStreamPlayer source={sourceFor('live')} {...player.eventHandlers} />;
    }

    await render(<Player />);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'MISSING_LIBRARY_ID' }));
    expect(states.at(-1)).toMatchObject({
      playbackState: 'error',
      isLoading: false,
      error: { code: 'MISSING_LIBRARY_ID' },
    });
  });
});
