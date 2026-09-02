import { describe, expect, it } from '@jest/globals';

import { fire, renderPlayerHook } from './helpers';

// --- Idempotent redundant events ---

describe('useBunnyStreamPlayer idempotent redundant events', () => {
  it('STATE_CHANGE with the same state is a no-op (PLAY + STATE_CHANGE playing)', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onPlay, { positionMs: 0, durationMs: 60_000 });
    const before = result.current.state;
    await fire(result.current.eventHandlers.onPlaybackStateChange, {
      state: 'playing',
      positionMs: 0,
    });
    // Same reference — reducer returned the previous state unchanged.
    expect(result.current.state).toBe(before);
    await unmount();
  });

  it('repeated PLAY is a no-op', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onPlay, { positionMs: 0, durationMs: 60_000 });
    const before = result.current.state;
    await fire(result.current.eventHandlers.onPlay, { positionMs: 100, durationMs: 60_000 });
    expect(result.current.state).toBe(before);
    await unmount();
  });
});

// --- Auto-reset on videoId change ---

describe('useBunnyStreamPlayer auto-reset on videoId change', () => {
  it('READY with a new videoId zeroes stale state then applies READY', async () => {
    const { result, unmount } = await renderPlayerHook();
    // First source.
    await fire(result.current.eventHandlers.onReady, { videoId: 'vid-1', durationMs: 60_000 });
    await fire(result.current.eventHandlers.onPlay, { positionMs: 0, durationMs: 60_000 });
    await fire(result.current.eventHandlers.onBuffering, { isBuffering: true });
    await fire(result.current.eventHandlers.onError, { code: 'X', message: 'err' });
    expect(result.current.state.isPlaying).toBe(false); // error cleared isPlaying
    expect(result.current.state.error).not.toBeNull();
    expect(result.current.state.isBuffering).toBe(true);

    // Second source — auto-reset.
    await fire(result.current.eventHandlers.onReady, { videoId: 'vid-2', durationMs: 120_000 });
    expect(result.current.state.videoId).toBe('vid-2');
    expect(result.current.state.durationMs).toBe(120_000);
    expect(result.current.state.playbackState).toBe('ready');
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isBuffering).toBe(false);
    expect(result.current.state.isPlaying).toBe(false);
    await unmount();
  });

  it('READY with the same videoId does NOT reset (just refreshes ready)', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onReady, { videoId: 'vid-1', durationMs: 60_000 });
    await fire(result.current.eventHandlers.onPlay, { positionMs: 0, durationMs: 60_000 });
    await fire(result.current.eventHandlers.onReady, { videoId: 'vid-1', durationMs: 60_000 });
    // isPlaying preserved — no reset occurred.
    expect(result.current.state.isPlaying).toBe(true);
    expect(result.current.state.playbackState).toBe('ready');
    await unmount();
  });
});
