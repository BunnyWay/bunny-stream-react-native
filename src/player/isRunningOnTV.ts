import { Platform } from 'react-native';

import NativeBunnyStreamPlayer from '../specs/NativeBunnyStreamPlayer';

/**
 * Whether the app is running on a TV device (Android `FEATURE_LEANBACK`).
 *
 * Android-only capability — always returns `false` on iOS (the iOS SDK does
 * not support tvOS). Combine with `useNativeTvPlayer` and the consumer-side
 * `net.bunny:tv` dependency to launch the dedicated TV player activity.
 */
export function isRunningOnTV(): boolean {
  if (Platform.OS !== 'android') return false;
  return NativeBunnyStreamPlayer.isRunningOnTV();
}
