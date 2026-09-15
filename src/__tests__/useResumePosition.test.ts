import type { BunnyVodPlayerRef, PlaybackPosition } from '../player/BunnyStreamPlayer.types';
import type * as React from 'react';

import { describe, afterEach, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useResumePosition, type ResumePositionStorage } from '../player/hooks/useResumePosition';

function makeMemoryStorage(): ResumePositionStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => {
      store.set(key, value);
    },
    removeItem: async (key) => {
      store.delete(key);
    },
    getAllKeys: async () => Array.from(store.keys()),
  };
}

function makeFakeRef(): React.RefObject<BunnyVodPlayerRef | null> {
  const seekTo = jest.fn();
  const ref = { current: { seekTo } as unknown as BunnyVodPlayerRef };
  return ref as React.RefObject<BunnyVodPlayerRef | null>;
}

describe('useResumePosition', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
  });

  function setPlatform(os: 'ios' | 'android') {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }

  it('is a no-op on Android (native SDK handles resume)', async () => {
    setPlatform('android');
    const storage = makeMemoryStorage();
    const playerRef = makeFakeRef();
    const { result } = await renderHook(() =>
      useResumePosition({
        playerRef,
        videoId: 'v1',
        storage,
      }),
    );
    await act(async () => {
      await result.current.savePosition(60_000, 120_000);
    });
    expect(storage.store.size).toBe(0);
    expect(result.current.restoredPosition).toBeNull();
  });

  it('restores a saved position on iOS and seeks the player', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    const position: PlaybackPosition = {
      videoId: 'v1',
      positionMs: 45_000,
      durationMs: 120_000,
      watchPercentage: 0.375,
      timestamp: Date.now(),
      videoTitle: 'Test',
    };
    await storage.setItem('@bunny_resume_positions:v1', JSON.stringify(position));
    const playerRef = makeFakeRef();
    await renderHook(() =>
      useResumePosition({
        playerRef,
        videoId: 'v1',
        storage,
      }),
    );
    // Wait for the async restore effect to flush.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(playerRef.current?.seekTo).toHaveBeenCalledWith(45_000);
  });

  it('does not save positions below minimumWatchMs', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    const playerRef = makeFakeRef();
    const { result } = await renderHook(() =>
      useResumePosition({
        playerRef,
        videoId: 'v1',
        storage,
        config: { minimumWatchMs: 30_000 },
      }),
    );
    await act(async () => {
      await result.current.savePosition(10_000, 120_000);
    });
    expect(storage.store.size).toBe(0);
  });

  it('does not save positions near the end (nearEndThreshold)', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    const playerRef = makeFakeRef();
    const { result } = await renderHook(() =>
      useResumePosition({
        playerRef,
        videoId: 'v1',
        storage,
        config: { nearEndThreshold: 0.9 },
      }),
    );
    await act(async () => {
      await result.current.savePosition(115_000, 120_000);
    });
    expect(storage.store.size).toBe(0);
  });

  it('saves a valid position and retrieves it via getAllPositions', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    const playerRef = makeFakeRef();
    const { result } = await renderHook(() =>
      useResumePosition({
        playerRef,
        videoId: 'v1',
        videoTitle: 'My Video',
        storage,
      }),
    );
    await act(async () => {
      await result.current.savePosition(60_000, 120_000);
    });
    expect(storage.store.size).toBe(1);
    const positions = await result.current.getAllPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0]?.videoId).toBe('v1');
    expect(positions[0]?.videoTitle).toBe('My Video');
  });

  it('clears a single position', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    const playerRef = makeFakeRef();
    const { result } = await renderHook(() =>
      useResumePosition({
        playerRef,
        videoId: 'v1',
        storage,
      }),
    );
    await act(async () => {
      await result.current.savePosition(60_000, 120_000);
    });
    expect(storage.store.size).toBe(1);
    await act(async () => {
      await result.current.clearPosition();
    });
    expect(storage.store.size).toBe(0);
  });

  it('clears all positions', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    const playerRef = makeFakeRef();
    const { result } = await renderHook(() =>
      useResumePosition({
        playerRef,
        videoId: 'v1',
        storage,
      }),
    );
    await act(async () => {
      await result.current.savePosition(60_000, 120_000);
      await storage.setItem(
        '@bunny_resume_positions:v2',
        JSON.stringify({
          videoId: 'v2',
          positionMs: 30_000,
          durationMs: 90_000,
          watchPercentage: 0.33,
          timestamp: Date.now(),
        }),
      );
    });
    expect(storage.store.size).toBe(2);
    await act(async () => {
      await result.current.clearAllPositions();
    });
    expect(storage.store.size).toBe(0);
  });

  it('ignores expired positions on restore', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    const expiredPosition: PlaybackPosition = {
      videoId: 'v1',
      positionMs: 45_000,
      durationMs: 120_000,
      watchPercentage: 0.375,
      timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    };
    await storage.setItem('@bunny_resume_positions:v1', JSON.stringify(expiredPosition));
    const playerRef = makeFakeRef();
    const { result } = await renderHook(() =>
      useResumePosition({
        playerRef,
        videoId: 'v1',
        storage,
        config: { retentionDays: 7 },
      }),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(playerRef.current?.seekTo).not.toHaveBeenCalled();
    expect(result.current.restoredPosition).toBeNull();
    // Expired position should have been removed.
    expect(storage.store.size).toBe(0);
  });
});
