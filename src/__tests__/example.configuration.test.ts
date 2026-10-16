import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();

jest.mock('@env', () => ({ BUNNY_ACCESS_KEY: ' environment-key ', BUNNY_LIBRARY_ID: '123' }), {
  virtual: true,
});
jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({ __esModule: true, default: { getItem: mockGetItem, setItem: mockSetItem } }),
  { virtual: true },
);

const { loadLibraryConfig, loadDirectLiveValues, saveDirectLiveValues, parseStreamIdsFromEnv } =
  jest.requireActual<{
    loadLibraryConfig: () => Promise<{ accessKey: string; libraryId: number | null }>;
    loadDirectLiveValues: () => Promise<{ streamId: string; libraryId: string } | null>;
    saveDirectLiveValues: (values: { streamId: string; libraryId: string }) => Promise<void>;
    parseStreamIdsFromEnv: (env: {
      BUNNY_STREAM_IDS?: string;
      BUNNY_STREAM_ID?: string;
    }) => string[];
  }>('../../example/src/storage/settings');

const originalAccessKey = process.env.EXPO_PUBLIC_BUNNY_ACCESS_KEY;
const originalLibraryId = process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID;

beforeEach(() => {
  mockGetItem.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  if (originalAccessKey === undefined) delete process.env.EXPO_PUBLIC_BUNNY_ACCESS_KEY;
  else process.env.EXPO_PUBLIC_BUNNY_ACCESS_KEY = originalAccessKey;
  if (originalLibraryId === undefined) delete process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID;
  else process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID = originalLibraryId;
});

function readExpoConfig(accessKey?: string, libraryId?: string) {
  if (accessKey === undefined) delete process.env.EXPO_PUBLIC_BUNNY_ACCESS_KEY;
  else process.env.EXPO_PUBLIC_BUNNY_ACCESS_KEY = accessKey;
  if (libraryId === undefined) delete process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID;
  else process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID = libraryId;

  let configuration:
    | {
        BUNNY_ACCESS_KEY: string;
        BUNNY_LIBRARY_ID: number;
        isConfigured: boolean;
      }
    | undefined;
  jest.isolateModules(() => {
    configuration = jest.requireActual('../../example-expo/src/config');
  });
  return configuration;
}

describe('React Native example configuration', () => {
  it('uses environment defaults and trims the key', async () => {
    await expect(loadLibraryConfig()).resolves.toEqual({
      accessKey: 'environment-key',
      libraryId: 123,
    });
  });

  it('prefers saved configuration and trims the key', async () => {
    mockGetItem.mockImplementation(async (key) =>
      key === '@bunny_demo/access_key' ? ' saved-key ' : '456',
    );

    await expect(loadLibraryConfig()).resolves.toEqual({
      accessKey: 'saved-key',
      libraryId: 456,
    });
  });

  it.each(['', ' ', '0', '-1', '1.5', 'Infinity', 'NaN', '123abc'])(
    'rejects invalid saved library ID %s',
    async (libraryId) => {
      mockGetItem.mockImplementation(async (key) =>
        key === '@bunny_demo/library_id' ? libraryId : null,
      );

      expect((await loadLibraryConfig()).libraryId).toBeNull();
    },
  );
});

describe('Direct live play values', () => {
  it('parses comma-separated stream IDs, trimming and deduplicating', () => {
    expect(parseStreamIdsFromEnv({ BUNNY_STREAM_IDS: ' a , b,,a ' })).toEqual(['a', 'b']);
    expect(parseStreamIdsFromEnv({ BUNNY_STREAM_ID: 'solo' })).toEqual(['solo']);
    expect(parseStreamIdsFromEnv({})).toEqual([]);
  });

  it('round-trips last-used stream values through storage', async () => {
    await saveDirectLiveValues({ streamId: 'stream-1', libraryId: '123' });
    expect(mockSetItem).toHaveBeenCalledWith('@bunny_demo/direct_live_stream_id', 'stream-1');
    expect(mockSetItem).toHaveBeenCalledWith('@bunny_demo/direct_live_library_id', '123');

    mockGetItem.mockImplementation(async (key) =>
      key === '@bunny_demo/direct_live_stream_id' ? 'stream-1' : '123',
    );
    await expect(loadDirectLiveValues()).resolves.toEqual({
      streamId: 'stream-1',
      libraryId: '123',
    });
  });

  it('returns null when nothing was stored', async () => {
    await expect(loadDirectLiveValues()).resolves.toBeNull();
  });
});

describe('Expo example configuration', () => {
  it('accepts a positive integer and trims the key', () => {
    expect(readExpoConfig(' access-key ', '123')).toEqual({
      BUNNY_ACCESS_KEY: 'access-key',
      BUNNY_LIBRARY_ID: 123,
      isConfigured: true,
    });
  });

  it.each([undefined, '', ' ', '0', '-1', '1.5', 'Infinity', 'NaN', '123abc'])(
    'rejects invalid environment library ID %s',
    (libraryId) => {
      expect(readExpoConfig('access-key', libraryId)?.isConfigured).toBe(false);
    },
  );

  it.each([undefined, '', ' '])('rejects an empty access key %s', (accessKey) => {
    expect(readExpoConfig(accessKey, '123')?.isConfigured).toBe(false);
  });
});
