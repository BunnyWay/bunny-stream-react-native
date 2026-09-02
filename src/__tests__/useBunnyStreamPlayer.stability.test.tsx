import type { PlayerEventHandlers } from '../useBunnyStreamPlayer';

import { describe, expect, it, jest } from '@jest/globals';

import { renderPlayerHook } from './helpers';

// --- Stable identities ---

describe('useBunnyStreamPlayer stable identities', () => {
  it('controls has a stable identity across renders', async () => {
    const { result, rerender, unmount } = await renderPlayerHook();
    const controlsBefore = result.current.controls;
    await rerender(undefined);
    expect(result.current.controls).toBe(controlsBefore);
    await unmount();
  });

  it('eventHandlers has a stable identity across renders', async () => {
    const { result, rerender, unmount } = await renderPlayerHook();
    const handlersBefore: PlayerEventHandlers = result.current.eventHandlers;
    await rerender(undefined);
    expect(result.current.eventHandlers).toBe(handlersBefore);
    await unmount();
  });

  it('controls proxies through to the ref', async () => {
    const { result, unmount } = await renderPlayerHook();
    // Attach a fake ref so we can assert the controls call through.
    const fakeRef = {
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      setVolume: jest.fn(),
      setPlaybackRate: jest.fn(),
    };
    result.current.ref.current = fakeRef;
    result.current.controls.play();
    result.current.controls.pause();
    result.current.controls.seekTo(5000);
    result.current.controls.setVolume(0.3);
    result.current.controls.setPlaybackRate(1.5);
    expect(fakeRef.play).toHaveBeenCalledTimes(1);
    expect(fakeRef.pause).toHaveBeenCalledTimes(1);
    expect(fakeRef.seekTo).toHaveBeenCalledWith(5000);
    expect(fakeRef.setVolume).toHaveBeenCalledWith(0.3);
    expect(fakeRef.setPlaybackRate).toHaveBeenCalledWith(1.5);
    await unmount();
  });
});
