import { Platform } from 'react-native';

import NativeBunnyStreamPlayer from '../specs/NativeBunnyStreamPlayer';

/**
 * The iOS SDK's internal speed list (it exposes no public query).
 */
const IOS_FALLBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;

/**
 * Returns the playback speeds the player offers.
 *
 * Android queries the native engine — the list reflects `allowedSpeeds` from
 * the player config, then dashboard `playerSettings`, then SDK defaults. iOS
 * has no public speed API, so this returns the SDK's hardcoded list
 * `[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]`.
 */
export async function getPlaybackSpeeds(): Promise<number[]> {
  if (Platform.OS !== 'android') return [...IOS_FALLBACK_SPEEDS];
  return [...(await NativeBunnyStreamPlayer.getPlaybackSpeeds())];
}
