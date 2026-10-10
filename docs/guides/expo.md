# Expo

Use an Expo development build with the New Architecture enabled. Expo Go does not contain the
native Bunny modules, and web is not supported. The package declares Expo SDK 52+; the generated
app must also meet the [native requirements](getting-started.md#requirements).

## Install and configure

```bash
npm install @bunny.net/stream-react-native
```

Add the plugin to your existing app.json configuration:

```json
{
  "expo": {
    "plugins": [
      [
        "@bunny.net/stream-react-native",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to record and broadcast video.",
          "microphonePermission": "Allow $(PRODUCT_NAME) to capture audio."
        }
      ]
    ]
  }
}
```

The short form, `"plugins": ["@bunny.net/stream-react-native"]`, also works: permission messages
have defaults. Merge this entry with any existing plugins rather than replacing them.

Generate and build the native application:

```bash
npx expo prebuild
npx expo run:ios
```

Use `npx expo run:android` for Android, or EAS Build with a development-build profile. Changes to
the plugin or native dependencies require a new native build; a Metro reload or JS-only update
cannot apply them. Do not run `prebuild --clean` over manually maintained native changes without
backing them up.

## What the plugin configures

- Android camera/microphone declarations, minimum API 26 and Kotlin build settings, app-module
  desugaring, and host activity PiP support with configuration-change handling.
- iOS camera/microphone usage descriptions, optional photo-library usage description, audio
  background mode, and embedding the IMA framework from SwiftPM.

Check `compileSdk` 36+ and the remaining native requirements in your Expo-generated project.
The plugin does not replace the entire native toolchain configuration.

## Plugin options

| Option                   | Default                                | Purpose                                                                   |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------- |
| `cameraPermission`       | Default recording/broadcasting message | iOS `NSCameraUsageDescription`; `false` skips writing it.                 |
| `microphonePermission`   | Default audio-capture message          | iOS `NSMicrophoneUsageDescription`; `false` skips writing it.             |
| `photoLibraryPermission` | Not set                                | iOS photo-library usage text, if your app uses a picker that requires it. |
| `enablePictureInPicture` | `true`                                 | Adds Android host activity PiP support.                                   |
| `enableBackgroundAudio`  | `true`                                 | Adds iOS `audio` to `UIBackgroundModes`, needed for PiP.                  |
| `desugarJdkLibsVersion`  | `"2.1.5"`                              | Android core library desugaring dependency.                               |

`cameraPermission: false` and `microphonePermission: false` are not runtime permission denials
and do not disable Android permission declarations. If camera capture is used, the required iOS
usage descriptions must still be supplied by your app. See the [option types](../../plugin/src/types.ts).

## Runtime permissions and initialization

The plugin declares permissions; it does not request runtime access. Use your app's permission
library to grant camera and microphone access before mounting `BunnyStreamBroadcaster`.
If using `expo-camera` or an image picker, install and configure those packages separately.

Call `initialize(accessKey, libraryId)` before rendering SDK content, as shown in
[Getting started](getting-started.md#4-initialize). Keep real library credentials out of
app.json and source control; `EXPO_PUBLIC_*` values are bundled into the client, not kept secret.

The [Expo example](../../example-expo/README.md) contains a minimal startup and player integration.
