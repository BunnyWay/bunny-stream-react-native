import { describe, expect, it, jest } from '@jest/globals';

import { fire, renderPlayerHook } from './helpers';

// --- User handlers ---

describe('useBunnyStreamPlayer user handlers', () => {
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
