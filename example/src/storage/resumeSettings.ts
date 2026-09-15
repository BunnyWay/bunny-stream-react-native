import type { ResumeConfig } from 'bunny-stream-react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

const RESUME_SETTINGS_KEY = '@bunny_demo/resume_settings';

/**
 * Persisted resume-position settings for the demo app. Mirrors the Android
 * demo's ResumePositionPreferences, but actually persisted and applied.
 */
export type ResumeSettings = {
  /** Master switch — when false the player never saves or offers resume. */
  enabled: boolean;
  /** Days a saved position stays valid. */
  retentionDays: number;
  /** Minimum watched time (seconds) before a position is saved. */
  minimumWatchSec: number;
  /** Don't offer resume below this watched fraction (percent, 0–100). */
  resumeThresholdPct: number;
  /** Don't offer resume at/above this watched fraction (percent, 0–100). */
  nearEndThresholdPct: number;
};

/** Same defaults as the native SDK's `ResumeConfig`. */
export const DEFAULT_RESUME_SETTINGS: ResumeSettings = {
  enabled: true,
  retentionDays: 7,
  minimumWatchSec: 30,
  resumeThresholdPct: 5,
  nearEndThresholdPct: 95,
};

export async function loadResumeSettings(): Promise<ResumeSettings> {
  try {
    const json = await AsyncStorage.getItem(RESUME_SETTINGS_KEY);
    if (!json) return DEFAULT_RESUME_SETTINGS;
    const parsed = JSON.parse(json) as Partial<ResumeSettings>;
    return { ...DEFAULT_RESUME_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_RESUME_SETTINGS;
  }
}

export async function saveResumeSettings(settings: ResumeSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(RESUME_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}

/** Maps demo settings to the library's public `ResumeConfig`. */
export function toResumeConfig(settings: ResumeSettings): ResumeConfig {
  return {
    retentionDays: settings.retentionDays,
    minimumWatchMs: settings.minimumWatchSec * 1000,
    resumeThreshold: settings.resumeThresholdPct / 100,
    nearEndThreshold: settings.nearEndThresholdPct / 100,
    enableAutoSave: true,
    saveIntervalMs: 10_000,
  };
}
