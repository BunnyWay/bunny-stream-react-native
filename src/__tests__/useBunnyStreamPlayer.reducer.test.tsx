import { describe, expect, it } from '@jest/globals';

import { fire, renderPlayerHook } from './helpers';

// --- Reducer transitions via event handlers ---

describe('useBunnyStreamPlayer reducer transitions', () => {
  it('READY sets playbackState=ready, durationMs, videoId, clears error', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onReady, {
      videoId: 'vid-1',
      durationMs: 60_000,
    });
    expect(result.current.state.playbackState).toBe('ready');
    expect(result.current.state.durationMs).toBe(60_000);
    expect(result.current.state.videoId).toBe('vid-1');
    expect(result.current.state.error).toBeNull();
    await unmount();
  });

  it('PLAY sets isPlaying=true and playbackState=playing', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onPlay, { positionMs: 0, durationMs: 60_000 });
    expect(result.current.state.isPlaying).toBe(true);
    expect(result.current.state.playbackState).toBe('playing');
    await unmount();
  });

  it('PAUSE sets isPlaying=false and playbackState=paused', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onPlay, { positionMs: 0, durationMs: 60_000 });
    await fire(result.current.eventHandlers.onPause, { positionMs: 1000, durationMs: 60_000 });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.playbackState).toBe('paused');
    await unmount();
  });

  it('END sets isPlaying=false and playbackState=ended', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onPlay, { positionMs: 0, durationMs: 60_000 });
    await fire(result.current.eventHandlers.onEnd, { positionMs: 60_000, durationMs: 60_000 });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.playbackState).toBe('ended');
    await unmount();
  });

  it('BUFFERING toggles isBuffering', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onBuffering, { isBuffering: true });
    expect(result.current.state.isBuffering).toBe(true);
    await fire(result.current.eventHandlers.onBuffering, { isBuffering: false });
    expect(result.current.state.isBuffering).toBe(false);
    await unmount();
  });

  it('ERROR sets error, playbackState=error, isPlaying=false', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onPlay, { positionMs: 0, durationMs: 60_000 });
    await fire(result.current.eventHandlers.onError, {
      code: 'PLAYBACK_FAILED',
      message: 'boom',
      nativeCode: '5001',
    });
    expect(result.current.state.error).toEqual({
      code: 'PLAYBACK_FAILED',
      message: 'boom',
      nativeCode: '5001',
    });
    expect(result.current.state.playbackState).toBe('error');
    expect(result.current.state.isPlaying).toBe(false);
    await unmount();
  });

  it('VOLUME updates volume and isMuted', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onVolumeChange, { volume: 0.5, isMuted: false });
    expect(result.current.state.volume).toBe(0.5);
    expect(result.current.state.isMuted).toBe(false);
    await fire(result.current.eventHandlers.onVolumeChange, { volume: 0, isMuted: true });
    expect(result.current.state.volume).toBe(0);
    expect(result.current.state.isMuted).toBe(true);
    await unmount();
  });

  it('PLAYBACK_RATE updates playbackRate', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onPlaybackRateChange, { rate: 2 });
    expect(result.current.state.playbackRate).toBe(2);
    await unmount();
  });

  it('STATE_CHANGE updates playbackState', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onPlaybackStateChange, {
      state: 'loading',
      positionMs: 0,
    });
    expect(result.current.state.playbackState).toBe('loading');
    await unmount();
  });

  it('onProgress updates progress (high-frequency) but NOT state', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onProgress, {
      positionMs: 15_000,
      durationMs: 60_000,
      progress: 0.25,
    });
    expect(result.current.progress).toEqual({
      positionMs: 15_000,
      durationMs: 60_000,
      progress: 0.25,
    });
    // state.durationMs is only set by onReady, not onProgress.
    expect(result.current.state.durationMs).toBe(0);
    await unmount();
  });

  it('exposes default state and progress before any event', async () => {
    const { result, unmount } = await renderPlayerHook();
    expect(result.current.state.playbackState).toBe('idle');
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.isBuffering).toBe(false);
    expect(result.current.state.durationMs).toBe(0);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.volume).toBe(1);
    expect(result.current.state.isMuted).toBe(false);
    expect(result.current.state.playbackRate).toBe(1);
    expect(result.current.state.videoId).toBeNull();
    expect(result.current.progress).toEqual({ positionMs: 0, durationMs: 0, progress: 0 });
    await unmount();
  });

  // --- isLoading ---

  it('isLoading is true by default', async () => {
    const { result, unmount } = await renderPlayerHook();
    expect(result.current.state.isLoading).toBe(true);
    await unmount();
  });

  it('READY clears isLoading (VOD first frame)', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onReady, {
      videoId: 'vid-1',
      durationMs: 60_000,
    });
    expect(result.current.state.isLoading).toBe(false);
    await unmount();
  });

  it('VIDEO_SIZE clears isLoading (first frame decoded)', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onVideoSizeChange, { width: 1920, height: 1080 });
    expect(result.current.state.isLoading).toBe(false);
    await unmount();
  });

  it('LIVE_STATE with non-loading state clears isLoading', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onLiveStateChange, {
      state: 'live',
      isLive: true,
    });
    expect(result.current.state.isLoading).toBe(false);
    await unmount();
  });

  it('LIVE_STATE with loading state preserves isLoading', async () => {
    const { result, unmount } = await renderPlayerHook();
    // First, clear isLoading via a non-loading state
    await fire(result.current.eventHandlers.onLiveStateChange, {
      state: 'live',
      isLive: true,
    });
    expect(result.current.state.isLoading).toBe(false);
    // Now simulate a reload — LIVE_STATE with 'loading' should NOT re-set isLoading
    // (the RESET action handles source changes; LIVE_STATE just reports current state)
    await fire(result.current.eventHandlers.onLiveStateChange, {
      state: 'loading',
      isLive: false,
    });
    expect(result.current.state.isLoading).toBe(false);
    await unmount();
  });

  it('LIVE_ERROR clears isLoading', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onLiveError, { message: 'Stream failed' });
    expect(result.current.state.isLoading).toBe(false);
    await unmount();
  });

  it('ERROR clears isLoading', async () => {
    const { result, unmount } = await renderPlayerHook();
    await fire(result.current.eventHandlers.onError, {
      code: 'ERR',
      message: 'Playback failed',
    });
    expect(result.current.state.isLoading).toBe(false);
    await unmount();
  });
});
