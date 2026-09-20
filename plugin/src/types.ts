export interface BunnyStreamPluginProps {
  /**
   * NSCameraUsageDescription text (iOS). Pass `false` to skip setting the key.
   */
  cameraPermission?: string | false;
  /**
   * NSMicrophoneUsageDescription text (iOS). Pass `false` to skip setting the key.
   */
  microphonePermission?: string | false;
  /**
   * NSPhotoLibraryUsageDescription text (iOS). Only written when provided —
   * the library itself does not read the photo library, but apps that let
   * users pick upload sources (e.g. via expo-image-picker) need the key for
   * App Store review.
   */
  photoLibraryPermission?: string;
  /**
   * Adds `android:supportsPictureInPicture="true"` and the required
   * `android:configChanges` to the MainActivity (Android). Required for
   * `BunnyStreamPlayerRef.enterPiP()` — without it the call throws and the
   * PiP transition recreates the activity, killing playback.
   * @default true
   */
  enablePictureInPicture?: boolean;
  /**
   * Adds `audio` to `UIBackgroundModes` (iOS). Required by
   * AVPictureInPictureController, which `enterPiP()` uses.
   * @default true
   */
  enableBackgroundAudio?: boolean;
  /**
   * Version of `com.android.tools:desugar_jdk_libs` added to the app module
   * (Android). The Bunny Stream Android SDK requires core library desugaring
   * through transitive media3/interactivemedia dependencies.
   * @default "2.1.5"
   */
  desugarJdkLibsVersion?: string;
}

export interface ResolvedBunnyStreamPluginProps {
  cameraPermission: string | false;
  microphonePermission: string | false;
  photoLibraryPermission?: string;
  enablePictureInPicture: boolean;
  enableBackgroundAudio: boolean;
  desugarJdkLibsVersion: string;
}

export function resolvePluginProps(
  props: BunnyStreamPluginProps = {},
): ResolvedBunnyStreamPluginProps {
  return {
    cameraPermission:
      props.cameraPermission ?? 'Allow $(PRODUCT_NAME) to record and broadcast video.',
    microphonePermission:
      props.microphonePermission ??
      'Allow $(PRODUCT_NAME) to capture audio during recording and broadcasting.',
    photoLibraryPermission: props.photoLibraryPermission,
    enablePictureInPicture: props.enablePictureInPicture ?? true,
    enableBackgroundAudio: props.enableBackgroundAudio ?? true,
    desugarJdkLibsVersion: props.desugarJdkLibsVersion ?? '2.1.5',
  };
}
