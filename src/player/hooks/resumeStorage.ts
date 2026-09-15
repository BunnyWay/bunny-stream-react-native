import type { PlaybackPosition } from '../BunnyStreamPlayer.types';

/**
 * Minimal async key-value storage interface. Matches the subset of
 * `@react-native-async-storage/async-storage` used by the resume fallback.
 */
export interface ResumePositionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet?(keys: readonly string[]): Promise<readonly [string, string | null][]>;
}

export const STORAGE_PREFIX = '@bunny_resume_positions:';

export const storageKey = (videoId: string) => `${STORAGE_PREFIX}${videoId}`;

export function isExpired(position: PlaybackPosition, retentionDays: number): boolean {
  if (retentionDays <= 0) return false;
  const ageMs = Date.now() - position.timestamp;
  return ageMs > retentionDays * 24 * 60 * 60 * 1000;
}

export async function getStoredPosition(
  storage: ResumePositionStorage,
  videoId: string,
): Promise<PlaybackPosition | null> {
  const json = await storage.getItem(storageKey(videoId));
  if (!json) return null;
  try {
    return JSON.parse(json) as PlaybackPosition;
  } catch {
    return null;
  }
}

export async function getAllStoredPositions(
  storage: ResumePositionStorage,
  retentionDays = 7,
): Promise<PlaybackPosition[]> {
  const keys = await storage.getAllKeys();
  const resumeKeys = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
  if (resumeKeys.length === 0) return [];
  const entries = storage.multiGet
    ? await storage.multiGet(resumeKeys)
    : await Promise.all(
        resumeKeys.map(async (k) => [k, await storage.getItem(k)] as [string, string | null]),
      );
  const positions: PlaybackPosition[] = [];
  for (const [, json] of entries) {
    if (!json) continue;
    try {
      const pos = JSON.parse(json) as PlaybackPosition;
      if (!isExpired(pos, retentionDays)) positions.push(pos);
    } catch {
      /* ignore malformed payload */
    }
  }
  return positions.sort((a, b) => b.timestamp - a.timestamp);
}

export async function clearStoredPosition(
  storage: ResumePositionStorage,
  videoId: string,
): Promise<void> {
  await storage.removeItem(storageKey(videoId));
}

export async function clearAllStoredPositions(storage: ResumePositionStorage): Promise<void> {
  const keys = await storage.getAllKeys();
  await Promise.all(
    keys.filter((k) => k.startsWith(STORAGE_PREFIX)).map((k) => storage.removeItem(k)),
  );
}

/**
 * Deletes positions older than `retentionDays`. Returns the number removed.
 */
export async function cleanupExpiredStoredPositions(
  storage: ResumePositionStorage,
  retentionDays: number,
): Promise<number> {
  const keys = await storage.getAllKeys();
  const resumeKeys = keys.filter((k) => k.startsWith(STORAGE_PREFIX));
  const entries = storage.multiGet
    ? await storage.multiGet(resumeKeys)
    : await Promise.all(
        resumeKeys.map(async (k) => [k, await storage.getItem(k)] as [string, string | null]),
      );
  const removals: Promise<void>[] = [];
  for (const [key, json] of entries) {
    if (!json) continue;
    let expired = true; // malformed payload → remove
    try {
      expired = isExpired(JSON.parse(json) as PlaybackPosition, retentionDays);
    } catch {
      /* keep expired=true */
    }
    if (expired) {
      removals.push(storage.removeItem(key));
    }
  }
  await Promise.all(removals);
  return removals.length;
}

/**
 * Imports positions (merge by `videoId`) into storage. Returns `false` when the
 * payload is not a JSON array of positions.
 */
export async function importStoredPositions(
  storage: ResumePositionStorage,
  jsonData: string,
): Promise<boolean> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed)) return false;
  const writes: Promise<void>[] = [];
  for (const item of parsed as PlaybackPosition[]) {
    if (!item || typeof item.videoId !== 'string' || !item.videoId) continue;
    if (typeof item.positionMs !== 'number' || item.positionMs < 0) continue;
    if (typeof item.timestamp !== 'number' || item.timestamp <= 0) continue;
    writes.push(storage.setItem(storageKey(item.videoId), JSON.stringify(item)));
  }
  await Promise.all(writes);
  return true;
}
