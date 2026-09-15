import type { PlaybackPosition, ResumeConfig } from '../BunnyStreamPlayer.types';
import type { BunnyVodPlayerRef } from '../BunnyStreamPlayer.types';
import type { ResumePositionStorage } from './resumeStorage';

import * as React from 'react';
import { Platform } from 'react-native';

import {
  clearAllStoredPositions,
  clearStoredPosition,
  getAllStoredPositions,
  getStoredPosition,
  isExpired,
  storageKey,
} from './resumeStorage';

export type { ResumePositionStorage };

const DEFAULT_CONFIG: Required<ResumeConfig> = {
  retentionDays: 7,
  minimumWatchMs: 30_000,
  resumeThreshold: 0.05,
  nearEndThreshold: 0.95,
  enableAutoSave: true,
  saveIntervalMs: 10_000,
};

/**
 * iOS JavaScript fallback for resume position. The native iOS SDK does not
 * expose a resume-position API, so this hook tracks playback progress in JS
 * and persists positions to a pluggable async storage (typically
 * `@react-native-async-storage/async-storage`).
 *
 * On Android, the native SDK's `PlaybackPositionManager` is used instead
 * (enabled via the `resumeConfig` prop on `BunnyStreamPlayer`). This hook is
 * a no-op on Android.
 *
 * Semantics matching the Android native implementation:
 * - Positions watched for less than `minimumWatchMs` are not saved.
 * - Positions below `resumeThreshold` (fraction of duration) are not saved.
 * - Positions at or beyond `nearEndThreshold` are not saved (video finished).
 * - Positions older than `retentionDays` are ignored on restore.
 * - Auto-save fires at most every `saveIntervalMs` while playing.
 */
export type UseResumePositionOptions = Readonly<{
  /**
   * Player ref from `useBunnyStreamPlayer` or a direct `ref` to
   * `BunnyStreamPlayer`. Used to seek after restoring a position.
   */
  playerRef: React.RefObject<BunnyVodPlayerRef | null>;
  /** Video ID whose position should be tracked. */
  videoId: string;
  /** Optional video title for display in resume UIs. */
  videoTitle?: string;
  /** Resume configuration. Falls back to sensible defaults. */
  config?: ResumeConfig;
  /** Async storage implementation. Required on iOS; ignored on Android. */
  storage?: ResumePositionStorage;
  /**
   * Called when a saved position is available to restore. Return `true` to
   * auto-seek, `false` to skip. Defaults to `true`.
   */
  onPositionAvailable?: (position: PlaybackPosition) => boolean | void;
}>;

export type UseResumePositionResult = Readonly<{
  /** Last restored position, if any. Null until the player is ready. */
  restoredPosition: PlaybackPosition | null;
  /** Manually save the current position. */
  savePosition: (positionMs: number, durationMs: number) => Promise<void>;
  /** Clear the saved position for this video. */
  clearPosition: () => Promise<void>;
  /** Clear all saved positions. */
  clearAllPositions: () => Promise<void>;
  /** Get all saved positions (for resume UIs). */
  getAllPositions: () => Promise<PlaybackPosition[]>;
}>;

function shouldSave(
  positionMs: number,
  durationMs: number,
  config: Required<ResumeConfig>,
): boolean {
  if (durationMs <= 0) return false;
  const fraction = positionMs / durationMs;
  if (positionMs < config.minimumWatchMs) return false;
  if (fraction < config.resumeThreshold) return false;
  if (fraction >= config.nearEndThreshold) return false;
  return true;
}

/**
 * iOS JavaScript fallback for resume position. No-op on Android (the native
 * SDK's `PlaybackPositionManager` handles persistence there).
 */
export function useResumePosition(options: UseResumePositionOptions): UseResumePositionResult {
  const { playerRef, videoId, videoTitle, config, storage, onPositionAvailable } = options;
  const resolvedConfig = React.useMemo<Required<ResumeConfig>>(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config],
  );
  const [restoredPosition, setRestoredPosition] = React.useState<PlaybackPosition | null>(null);
  const lastSaveRef = React.useRef(0);

  // Restore on mount / videoId change (iOS only).
  React.useEffect(() => {
    if (Platform.OS === 'android') return;
    if (!storage) return;
    let cancelled = false;
    void (async () => {
      const position = await getStoredPosition(storage, videoId);
      if (cancelled || !position) return;
      if (isExpired(position, resolvedConfig.retentionDays)) {
        await clearStoredPosition(storage, videoId);
        return;
      }
      setRestoredPosition(position);
      const shouldSeek = onPositionAvailable?.(position);
      if (shouldSeek !== false) {
        playerRef.current?.seekTo(position.positionMs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId, storage, resolvedConfig.retentionDays, onPositionAvailable, playerRef]);

  const savePosition = React.useCallback(
    async (positionMs: number, durationMs: number) => {
      if (Platform.OS === 'android') return;
      if (!storage) return;
      if (!shouldSave(positionMs, durationMs, resolvedConfig)) return;
      const now = Date.now();
      if (
        resolvedConfig.enableAutoSave &&
        now - lastSaveRef.current < resolvedConfig.saveIntervalMs
      ) {
        return;
      }
      lastSaveRef.current = now;
      const position: PlaybackPosition = {
        videoId,
        positionMs,
        durationMs,
        watchPercentage: durationMs > 0 ? positionMs / durationMs : 0,
        timestamp: now,
        videoTitle,
      };
      await storage.setItem(storageKey(videoId), JSON.stringify(position));
    },
    [storage, videoId, videoTitle, resolvedConfig],
  );

  const clearPosition = React.useCallback(async () => {
    if (!storage) return;
    await clearStoredPosition(storage, videoId);
    setRestoredPosition(null);
  }, [storage, videoId]);

  const clearAllPositions = React.useCallback(async () => {
    if (!storage) return;
    await clearAllStoredPositions(storage);
    setRestoredPosition(null);
  }, [storage]);

  const getAllPositions = React.useCallback(async (): Promise<PlaybackPosition[]> => {
    if (!storage) return [];
    return getAllStoredPositions(storage, resolvedConfig.retentionDays);
  }, [storage, resolvedConfig.retentionDays]);

  return { restoredPosition, savePosition, clearPosition, clearAllPositions, getAllPositions };
}
