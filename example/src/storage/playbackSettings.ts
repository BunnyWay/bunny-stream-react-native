import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYBACK_SETTINGS_KEY = '@bunny_demo/playback_settings';

/** Persisted playback preferences for the demo app. */
export type PlaybackSettings = {
  /** Whether VOD playback starts automatically when the player screen opens. */
  autoPlay: boolean;
};

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  autoPlay: true,
};

export async function loadPlaybackSettings(): Promise<PlaybackSettings> {
  try {
    const json = await AsyncStorage.getItem(PLAYBACK_SETTINGS_KEY);
    if (!json) return DEFAULT_PLAYBACK_SETTINGS;
    const parsed = JSON.parse(json) as Partial<PlaybackSettings>;
    return { ...DEFAULT_PLAYBACK_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_PLAYBACK_SETTINGS;
  }
}

export async function savePlaybackSettings(settings: PlaybackSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(PLAYBACK_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}
