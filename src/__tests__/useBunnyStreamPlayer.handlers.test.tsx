import { describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

import { useBunnyStreamPlayer } from '../player/hooks/useBunnyStreamPlayer';
import { fire, renderPlayerHook } from './helpers';

// --- User handlers ---

describe('useBunnyStreamPlayer user handlers', () => {
  it.each(['structured-first', 'message-first'] as const)(
    'preserves classification and stops buffering with %s callbacks, then resets on source change',
    async (order) => {
      const onError = jest.fn();
      const { result, rerender, unmount } = await renderHook(
        (key: string) => useBunnyStreamPlayer({ onError }, key),
        { initialProps: 'video-1' },
      );
      await fire(result.current.eventHandlers.onBuffering, { isBuffering: true });
      const error = {
        code: 'PLAYBACK_ERROR',
        message: 'Source error',
        nativeCode: 'ERROR_CODE_IO_BAD_HTTP_STATUS',
        category: 'unavailable' as const,
        httpStatus: 403,
      };
      const message = { message: 'Video is not available' };
      if (order === 'message-first') {
        await fire(result.current.eventHandlers.onPlaybackError, message);
        expect(result.current.state.isBuffering).toBe(false);
      }
      await fire(result.current.eventHandlers.onError, error);
      await fire(result.current.eventHandlers.onPlaybackError, message);

      expect(result.current.state.error).toStrictEqual(error);
      expect(result.current.state.isBuffering).toBe(false);
      expect(result.current.state.isLoading).toBe(false);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(error);

      await rerender('video-2');
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.isLoading).toBe(true);
      await unmount();
    },
  );

  it('invokes user handlers with the unwrapped nativeEvent payload', async () => {
    const onReady = jest.fn();
    const onProgress = jest.fn();
    const onError = jest.fn();
    const onPlay = jest.fn();
    const { result, unmount } = await renderPlayerHook({
      onReady,
      onProgress,
      onError,
      onPlay,
    });

    await fire(result.current.eventHandlers.onReady, { videoId: 'vid-1', durationMs: 60_000 });
    expect(onReady).toHaveBeenCalledWith({ videoId: 'vid-1', durationMs: 60_000 });

    await fire(result.current.eventHandlers.onProgress, {
      positionMs: 1000,
      durationMs: 60_000,
      progress: 0.1,
    });
    expect(onProgress).toHaveBeenCalledWith({
      positionMs: 1000,
      durationMs: 60_000,
      progress: 0.1,
    });

    await fire(result.current.eventHandlers.onError, { code: 'C', message: 'm' });
    expect(onError).toHaveBeenCalledWith({ code: 'C', message: 'm' });

    await fire(result.current.eventHandlers.onPlay, { positionMs: 1000, durationMs: 60_000 });
    expect(onPlay).toHaveBeenCalledWith({ positionMs: 1000, durationMs: 60_000 });
    await unmount();
  });

  it('stores and forwards complete live state metadata', async () => {
    const onLiveStateChange = jest.fn();
    const { result, unmount } = await renderPlayerHook({ onLiveStateChange });
    const liveState = {
      state: 'trailer' as const,
      isLive: false,
      targetEpochMs: 1_700_000_000_000,
      title: 'Launch',
      videoId: 'video-id',
      message: 'Waiting for the stream',
    };

    await fire(result.current.eventHandlers.onLiveStateChange, liveState);

    expect(result.current.state.liveState).toEqual(liveState);
    expect(onLiveStateChange).toHaveBeenCalledWith(liveState);
    await unmount();
  });

  it('user handlers receive updated options on rerender (via ref)', async () => {
    const onReady1 = jest.fn();
    const onReady2 = jest.fn();
    const { result, rerender, unmount } = await renderPlayerHook({ onReady: onReady1 });

    await fire(result.current.eventHandlers.onReady, { videoId: 'vid-1', durationMs: 1000 });
    expect(onReady1).toHaveBeenCalledTimes(1);
    expect(onReady2).toHaveBeenCalledTimes(0);

    await rerender({ onReady: onReady2 });
    // eventHandlers identity is stable, but the ref now points at onReady2.
    await fire(result.current.eventHandlers.onReady, { videoId: 'vid-1', durationMs: 2000 });
    expect(onReady1).toHaveBeenCalledTimes(1);
    expect(onReady2).toHaveBeenCalledTimes(1);
    await unmount();
  });
});
