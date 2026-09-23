import type { TurboModule } from 'react-native';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';

import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // SDK 4.0.0 requires a non-null access key (BunnyStreamApi.initialize no
  // longer accepts null). The public `initialize` wrapper validates and rejects
  // empty strings before calling native, so the bridge never receives null.
  initialize(accessKey: string, libraryId: Double): void;
  // Phase 7 — Android TV detection (leanback system feature). Always returns
  // false on iOS — the iOS SDK does not support tvOS.
  isRunningOnTV(): boolean;
  // Phase 7 — allowed playback speeds. Android queries the native engine
  // (allowedSpeeds → playerSettings → SDK defaults). iOS returns the SDK's
  // hardcoded speed list.
  getPlaybackSpeeds(): Promise<ReadonlyArray<Double>>;
  // Phase 7+ — resume position management. Android delegates to the native
  // PlaybackPositionManager (SharedPreferences "bunny_resume_positions").
  // iOS stubs return empty results — the JS AsyncStorage fallback owns iOS
  // persistence, and the public wrapper never calls these on iOS.
  getAllSavedPositions(): Promise<string>; // JSON array of PlaybackPosition
  clearSavedPosition(videoId: string): Promise<void>;
  clearAllSavedPositions(): Promise<void>;
  exportPositions(): Promise<string>; // JSON payload
  importPositions(jsonData: string): Promise<boolean>;
  cleanupExpiredPositions(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BunnyStreamPlayer');
