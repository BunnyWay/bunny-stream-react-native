import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = '@bunny_demo/access_key';
const LIBRARY_KEY = '@bunny_demo/library_id';
const DIRECT_PLAY_VIDEO_ID_KEY = '@bunny_demo/direct_play_video_id';
const DIRECT_PLAY_LIBRARY_ID_KEY = '@bunny_demo/direct_play_library_id';

export type Settings = {
  accessKey: string | null;
  libraryId: string;
};

// --- Env helpers ---

/**
 * Parse video IDs from env variables into a string array.
 *
 * Priority:
 *  1. `BUNNY_VIDEO_IDS` — comma-separated list (e.g. "id1,id2,id3")
 *  2. `BUNNY_VIDEO_ID` — legacy single string, wrapped into a one-element array
 *
 * Empty/undefined values produce an empty array. Whitespace is trimmed and
 * duplicates are removed while preserving order.
 *
 * @example
 * parseVideoIdsFromEnv({ BUNNY_VIDEO_IDS: 'a,b,c' }) // => ['a','b','c']
 * parseVideoIdsFromEnv({ BUNNY_VIDEO_ID: 'a' })      // => ['a']
 * parseVideoIdsFromEnv({})                            // => []
 */
export function parseVideoIdsFromEnv(env: {
  BUNNY_VIDEO_IDS?: string;
  BUNNY_VIDEO_ID?: string;
}): string[] {
  const raw = env.BUNNY_VIDEO_IDS ?? env.BUNNY_VIDEO_ID ?? '';
  if (!raw) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

// --- Settings ---

export async function loadSettings(): Promise<Settings | null> {
  try {
    const [accessKey, libraryId] = await Promise.all([
      AsyncStorage.getItem(ACCESS_KEY),
      AsyncStorage.getItem(LIBRARY_KEY),
    ]);
    if (accessKey === null && libraryId === null) {
      return null;
    }
    return { accessKey, libraryId: libraryId ?? '' };
  } catch {
    return null;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(ACCESS_KEY, settings.accessKey ?? ''),
      AsyncStorage.setItem(LIBRARY_KEY, settings.libraryId),
    ]);
  } catch {
    // ignore — settings are best-effort
  }
}

export async function clearSettings(): Promise<void> {
  try {
    await Promise.all([AsyncStorage.removeItem(ACCESS_KEY), AsyncStorage.removeItem(LIBRARY_KEY)]);
  } catch {
    // ignore
  }
}

// --- Direct play last-used values ---

export type DirectPlayValues = {
  videoId: string;
  libraryId: string;
};

export async function loadDirectPlayValues(): Promise<DirectPlayValues | null> {
  try {
    const [videoId, libraryId] = await Promise.all([
      AsyncStorage.getItem(DIRECT_PLAY_VIDEO_ID_KEY),
      AsyncStorage.getItem(DIRECT_PLAY_LIBRARY_ID_KEY),
    ]);
    if (videoId === null && libraryId === null) {
      return null;
    }
    return { videoId: videoId ?? '', libraryId: libraryId ?? '' };
  } catch {
    return null;
  }
}

export async function saveDirectPlayValues(values: DirectPlayValues): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(DIRECT_PLAY_VIDEO_ID_KEY, values.videoId),
      AsyncStorage.setItem(DIRECT_PLAY_LIBRARY_ID_KEY, values.libraryId),
    ]);
  } catch {
    // ignore — best-effort
  }
}
