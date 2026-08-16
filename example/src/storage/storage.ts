import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = '@bunny_demo/access_key';
const LIBRARY_KEY = '@bunny_demo/library_id';
const VIDEO_IDS_KEY = '@bunny_demo/video_ids';

export type Settings = {
  accessKey: string | null;
  libraryId: string;
};

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
    await Promise.all([
      AsyncStorage.removeItem(ACCESS_KEY),
      AsyncStorage.removeItem(LIBRARY_KEY),
    ]);
  } catch {
    // ignore
  }
}

// --- Video IDs ---

export async function loadVideoIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(VIDEO_IDS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveVideoIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(VIDEO_IDS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export async function addVideoId(id: string): Promise<string[]> {
  const trimmed = id.trim();
  const current = await loadVideoIds();
  if (current.includes(trimmed)) {
    return current;
  }
  const next = [trimmed, ...current];
  await saveVideoIds(next);
  return next;
}

export async function removeVideoId(id: string): Promise<string[]> {
  const current = await loadVideoIds();
  const next = current.filter((v) => v !== id);
  await saveVideoIds(next);
  return next;
}
