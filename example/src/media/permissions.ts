import { Platform } from 'react-native';

// Minimal shape of PermissionsAndroid we use. Avoids `import()` type
// annotations (forbidden by lint) and keeps PermissionsAndroid out of the
// iOS bundle via a lazy runtime import.
interface PermissionResult {
  [key: string]: string;
}
interface PermissionsAndroidLike {
  PERMISSIONS: { CAMERA: string; RECORD_AUDIO: string };
  RESULTS: { GRANTED: string };
  requestMultiple(permissions: string[]): Promise<PermissionResult>;
  check(permission: string): Promise<boolean>;
}

// Lazy import to avoid pulling PermissionsAndroid into the iOS bundle.
async function getPermissionsAndroid(): Promise<PermissionsAndroidLike | undefined> {
  if (Platform.OS !== 'android') {
    return undefined;
  }
  const RN = await import('react-native');
  return RN.PermissionsAndroid as unknown as PermissionsAndroidLike;
}

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

  const PermissionsAndroid = await getPermissionsAndroid();
  if (!PermissionsAndroid) {
    return false;
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

/**
 * Checks whether camera and microphone permissions are already granted
 * without prompting the user.
 *
 * On Android, checks both permissions via `PermissionsAndroid.check`.
 * On iOS, returns `true` (the native SDK handles the permission prompt).
 */
export async function checkBroadcastPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const PermissionsAndroid = await getPermissionsAndroid();
  if (!PermissionsAndroid) {
    return false;
  }

  try {
    const cameraGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    const audioGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    return cameraGranted && audioGranted;
  } catch {
    return false;
  }
}
