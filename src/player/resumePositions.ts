import type { PlaybackPosition } from './BunnyStreamPlayer.types';
import type { ResumePositionStorage } from './hooks/resumeStorage';

import { Platform } from 'react-native';

import NativeBunnyStreamPlayer from '../specs/NativeBunnyStreamPlayer';
import {
  clearAllStoredPositions,
  clearStoredPosition,
  cleanupExpiredStoredPositions,
  getAllStoredPositions,
  importStoredPositions,
} from './hooks/resumeStorage';

/**
 * Platform-agnostic resume-position management.
 *
 * On Android these delegate to the native SDK's `PlaybackPositionManager`
 * (SharedPreferences `"bunny_resume_positions"`). On iOS the SDK exposes no
 * resume API, so the same operations run against the pluggable async storage
 * used by `useResumePosition` (typically
 * `@react-native-async-storage/async-storage`) — pass it via `storage`.
 */

/** Lists all saved positions, newest first. */
export async function getAllResumePositions(
  storage?: ResumePositionStorage,
): Promise<PlaybackPosition[]> {
  if (Platform.OS === 'android') {
    const json = await NativeBunnyStreamPlayer.getAllSavedPositions();
    try {
      const parsed = JSON.parse(json) as PlaybackPosition[];
      return parsed.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }
  if (!storage) return [];
  return getAllStoredPositions(storage);
}

/** Deletes the saved position for a single video. */
export async function clearResumePosition(
  videoId: string,
  storage?: ResumePositionStorage,
): Promise<void> {
  if (Platform.OS === 'android') {
    return NativeBunnyStreamPlayer.clearSavedPosition(videoId);
  }
  if (!storage) return;
  return clearStoredPosition(storage, videoId);
}

/** Deletes every saved position. */
export async function clearAllResumePositions(
  storage?: ResumePositionStorage,
): Promise<void> {
  if (Platform.OS === 'android') {
    return NativeBunnyStreamPlayer.clearAllSavedPositions();
  }
  if (!storage) return;
  return clearAllStoredPositions(storage);
}

/**
 * Exports all positions as a JSON array of `PlaybackPosition` (the public,
 * normalized shape — portable across platforms).
 */
export async function exportResumePositions(
  storage?: ResumePositionStorage,
): Promise<string> {
  const positions = await getAllResumePositions(storage);
  return JSON.stringify(positions);
}

/**
 * Imports positions (merge by `videoId`). Accepts the normalized
 * `PlaybackPosition[]` shape produced by {@link exportResumePositions}; on
 * Android it is translated to the SDK's field names before delegating.
 * Returns `false` when the payload is malformed.
 */
export async function importResumePositions(
  jsonData: string,
  storage?: ResumePositionStorage,
): Promise<boolean> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed)) return false;

  if (Platform.OS === 'android') {
    // Translate the public shape to the SDK model (position/duration names).
    const sdkPositions = (parsed as PlaybackPosition[])
      .filter(
        (p) =>
          p &&
          typeof p.videoId === 'string' &&
          typeof p.positionMs === 'number' &&
          typeof p.durationMs === 'number' &&
          typeof p.timestamp === 'number',
      )
      .map((p) => ({
        videoId: p.videoId,
        position: p.positionMs,
        duration: p.durationMs,
        timestamp: p.timestamp,
        watchPercentage: p.watchPercentage ?? 0,
        videoTitle: p.videoTitle ?? '',
      }));
    return NativeBunnyStreamPlayer.importPositions(JSON.stringify(sdkPositions));
  }

  if (!storage) return false;
  return importStoredPositions(storage, jsonData);
}

/**
 * Deletes positions older than `retentionDays` (default 7 — the SDK default).
 */
export async function cleanupExpiredResumePositions(
  storage?: ResumePositionStorage,
  retentionDays = 7,
): Promise<void> {
  if (Platform.OS === 'android') {
    return NativeBunnyStreamPlayer.cleanupExpiredPositions();
  }
  if (!storage) return;
  await cleanupExpiredStoredPositions(storage, retentionDays);
}
