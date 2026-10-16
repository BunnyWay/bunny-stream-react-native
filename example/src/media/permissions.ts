import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Requests camera and microphone permissions required for broadcasting.
 *
 * On Android, requests both `CAMERA` and `RECORD_AUDIO` via
 * `PermissionsAndroid.requestMultiple`. Returns `true` only when both are
 * granted.
 *
 * On iOS, the native SDK (`BunnyStreamCameraUploadView`) prompts for
 * permissions on first use; this function is a no-op and returns `true`.
 * The host app must still declare `NSCameraUsageDescription` and
 * `NSMicrophoneUsageDescription` in `Info.plist`.
 */
export async function requestBroadcastPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}
