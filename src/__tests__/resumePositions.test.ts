import type { PlaybackPosition } from '../player/BunnyStreamPlayer.types';
import type { ResumePositionStorage } from '../player/hooks/resumeStorage';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

import { getPlaybackSpeeds } from '../player/playbackSpeeds';
import {
  cleanupExpiredResumePositions,
  clearAllResumePositions,
  clearResumePosition,
  exportResumePositions,
  getAllResumePositions,
  importResumePositions,
} from '../player/resumePositions';

jest.mock('../specs/NativeBunnyStreamPlayer', () => ({
  __esModule: true,
  default: {
    getAllSavedPositions: jest.fn(async () => '[]'),
    clearSavedPosition: jest.fn(async () => undefined),
    clearAllSavedPositions: jest.fn(async () => undefined),
    exportPositions: jest.fn(async () => '[]'),
    importPositions: jest.fn(async () => true),
    cleanupExpiredPositions: jest.fn(async () => undefined),
    getPlaybackSpeeds: jest.fn(async () => [0.5, 1.0, 2.0]),
  },
}));

const mockNativePlayer = (
  jest.requireMock('../specs/NativeBunnyStreamPlayer') as {
    default: {
      getAllSavedPositions: jest.MockedFunction<() => Promise<string>>;
      clearSavedPosition: jest.MockedFunction<(videoId: string) => Promise<void>>;
      clearAllSavedPositions: jest.MockedFunction<() => Promise<void>>;
      exportPositions: jest.MockedFunction<() => Promise<string>>;
      importPositions: jest.MockedFunction<(jsonData: string) => Promise<boolean>>;
      cleanupExpiredPositions: jest.MockedFunction<() => Promise<void>>;
      getPlaybackSpeeds: jest.MockedFunction<() => Promise<number[]>>;
    };
  }
).default;

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

const samplePosition: PlaybackPosition = {
  videoId: 'v1',
  positionMs: 60_000,
  durationMs: 120_000,
  watchPercentage: 0.5,
  timestamp: Date.now(),
  videoTitle: 'Demo',
};

describe('resume position management', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
    jest.clearAllMocks();
  });

  function setPlatform(os: 'ios' | 'android') {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }

  it('delegates getAllResumePositions to the native module on Android', async () => {
    setPlatform('android');
    mockNativePlayer.getAllSavedPositions.mockResolvedValueOnce(
      JSON.stringify([
        { ...samplePosition, timestamp: 100 },
        { ...samplePosition, videoId: 'v2', timestamp: 200 },
      ]),
    );
    const positions = await getAllResumePositions();
    expect(mockNativePlayer.getAllSavedPositions).toHaveBeenCalledTimes(1);
    // Newest first.
    expect(positions.map((p) => p.videoId)).toEqual(['v2', 'v1']);
  });

  it('returns [] on Android when the payload is malformed', async () => {
    setPlatform('android');
    mockNativePlayer.getAllSavedPositions.mockResolvedValueOnce('not-json');
    expect(await getAllResumePositions()).toEqual([]);
  });

  it('delegates clear/clearAll/cleanup to the native module on Android', async () => {
    setPlatform('android');
    await clearResumePosition('v1');
    await clearAllResumePositions();
    await cleanupExpiredResumePositions();
    expect(mockNativePlayer.clearSavedPosition).toHaveBeenCalledWith('v1');
    expect(mockNativePlayer.clearAllSavedPositions).toHaveBeenCalledTimes(1);
    expect(mockNativePlayer.cleanupExpiredPositions).toHaveBeenCalledTimes(1);
  });

  it('exports normalized positions and imports them translated to SDK fields', async () => {
    setPlatform('android');
    mockNativePlayer.getAllSavedPositions.mockResolvedValueOnce(JSON.stringify([samplePosition]));
    const exported = await exportResumePositions();
    const parsed = JSON.parse(exported) as PlaybackPosition[];
    expect(parsed[0]?.positionMs).toBe(60_000);

    const ok = await importResumePositions(exported);
    expect(ok).toBe(true);
    const sentJson = mockNativePlayer.importPositions.mock.calls[0]?.[0] as string;
    const sent = JSON.parse(sentJson) as Array<Record<string, unknown>>;
    expect(sent[0]).toMatchObject({
      videoId: 'v1',
      position: 60_000,
      duration: 120_000,
      videoTitle: 'Demo',
    });
    expect(sent[0]).not.toHaveProperty('positionMs');
  });

  it('rejects malformed import payloads on Android', async () => {
    setPlatform('android');
    expect(await importResumePositions('not-json')).toBe(false);
    expect(await importResumePositions('{"a":1}')).toBe(false);
    expect(mockNativePlayer.importPositions).not.toHaveBeenCalled();
  });

  it('uses storage on iOS for list/clear/export/import', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    await storage.setItem('@bunny_resume_positions:v1', JSON.stringify(samplePosition));

    const positions = await getAllResumePositions(storage);
    expect(positions).toHaveLength(1);
    expect(positions[0]?.videoId).toBe('v1');
    expect(mockNativePlayer.getAllSavedPositions).not.toHaveBeenCalled();

    const exported = await exportResumePositions(storage);
    expect(JSON.parse(exported)).toHaveLength(1);

    await clearResumePosition('v1', storage);
    expect(await getAllResumePositions(storage)).toEqual([]);

    const ok = await importResumePositions(exported, storage);
    expect(ok).toBe(true);
    expect(await getAllResumePositions(storage)).toHaveLength(1);

    await clearAllResumePositions(storage);
    expect(await getAllResumePositions(storage)).toEqual([]);
  });

  it('iOS cleanup removes expired positions only', async () => {
    setPlatform('ios');
    const storage = makeMemoryStorage();
    const fresh = { ...samplePosition, videoId: 'fresh', timestamp: Date.now() };
    const stale = {
      ...samplePosition,
      videoId: 'stale',
      timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
    };
    await storage.setItem('@bunny_resume_positions:fresh', JSON.stringify(fresh));
    await storage.setItem('@bunny_resume_positions:stale', JSON.stringify(stale));

    await cleanupExpiredResumePositions(storage, 7);
    const remaining = await getAllResumePositions(storage);
    expect(remaining.map((p) => p.videoId)).toEqual(['fresh']);
  });

  it('returns empty results on iOS without storage', async () => {
    setPlatform('ios');
    expect(await getAllResumePositions()).toEqual([]);
    expect(await exportResumePositions()).toBe('[]');
    expect(await importResumePositions('[]')).toBe(false);
  });
});

describe('getPlaybackSpeeds', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
  });

  it('returns the native list on Android', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    expect(await getPlaybackSpeeds()).toEqual([0.5, 1.0, 2.0]);
    expect(mockNativePlayer.getPlaybackSpeeds).toHaveBeenCalledTimes(1);
  });

  it('returns the iOS fallback list without calling native', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    jest.clearAllMocks();
    const speeds = await getPlaybackSpeeds();
    expect(speeds).toEqual([0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]);
    expect(mockNativePlayer.getPlaybackSpeeds).not.toHaveBeenCalled();
  });
});
