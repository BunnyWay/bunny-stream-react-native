# Getting started

Install the package, configure the native app, and initialize before mounting SDK components.
For generated native projects, follow the [Expo guide](expo.md) instead of the manual setup below.

## Requirements

- React Native with the New Architecture enabled: TurboModules and Fabric are required.
- iOS: Xcode, CocoaPods, and a React Native CocoaPods integration with the `spm_dependency` helper.
  Use your React Native version's minimum deployment target; the native Bunny SDK requires iOS 15+.
- Android: API 26+, `compileSdk` 36+, JDK 17, Kotlin 2.2.20+, and core library desugaring.
- Expo, if used: SDK 52+ and a development build, not Expo Go or web.
- A Bunny Stream video library and its library ID and API access key.
- A physical device for validating camera capture, broadcasting, casting, and background behavior.

The repository's React Native example uses React Native 0.86.2. The declared Expo minimum is
not a guarantee that every older template meets the current native toolchain requirements.
Check the generated native project when integrating into an existing app.

## 1. Install

```bash
npm install @bunny.net/stream-react-native
```

Autolinking connects the native modules. The package resolves Android dependencies from Maven
Central and iOS dependencies from the public Swift package. You do not need local native SDK
checkouts to consume the library.

## 2. Configure iOS

Run from the app's `ios` directory:

```bash
bundle exec pod install
```

The application target must embed and sign `GoogleInteractiveMediaAds.framework`, pulled in by
the native player's Swift package. Add a Run Script phase to the application target using the
`EMBED_FRAMEWORKS_SCRIPT` body in the [iOS plugin implementation](../../plugin/src/ios.ts).
The [example's integration script](../../example/ios/link_bunny_sdk.rb) shows the Xcode wiring.
The Expo plugin installs this phase automatically.

For PiP, enable the Audio background mode (`UIBackgroundModes` containing `audio`).
For camera capture, add `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` to
Info.plist and request runtime access before mounting the broadcaster.

## 3. Configure Android

Set the SDK and Kotlin versions from Requirements in your app's Gradle configuration.
Enable desugaring in the **app module**, even though the library also enables it:

```groovy
android {
    compileOptions {
        coreLibraryDesugaringEnabled true
    }
}

dependencies {
    coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:2.1.5"
}
```

Ensure AndroidManifest.xml declares `android.permission.INTERNET`. Camera capture additionally
needs `android.permission.CAMERA` and `android.permission.RECORD_AUDIO`, plus runtime grants.
Configure the host activity for [Picture-in-Picture](picture-in-picture-and-cast.md) if needed.

## 4. Initialize

Call the public JS initializer once during startup, after loading and validating your
configuration and **before** mounting a player or making management/upload calls:

```ts
import { initialize } from '@bunny.net/stream-react-native';

export function configureStream(accessKey: string, libraryId: number): boolean {
  try {
    initialize(accessKey, libraryId);
    return true;
  } catch (error) {
    console.warn(error instanceof Error ? error.message : 'SDK initialization failed');
    return false;
  }
}
```

Only mount SDK content after this function returns `true`; otherwise show a configuration error.
`initialize` is synchronous and rejects blank access keys and non-positive or non-integer IDs.
Do not initialize as a side effect of rendering a component. If initialization happens in an
effect, keep the player unmounted until your own ready state has been set.

For VOD and live players, `source.libraryId` falls back to the ID passed to `initialize()`.
An explicit positive integer overrides the fallback; an invalid explicit value is an error,
not a request to use the default. Management calls, uploads, and broadcaster sources still
require their own library ID.

Configuration is module state, not reactive React state. Calling `initialize` again does not
rerender mounted components. Changing a player's effective library on a later render remounts
its native host. An explicit library ID does not select separate credentials: the management
API uses the initialized native instance. The wrapper does not expose the Android SDK's
multi-instance `create()` API. Use the public `initialize`, not `NativeBunnyStreamPlayer.initialize`,
so the JS fallback and native configuration stay in sync.

## 5. Make a call

After successful initialization:

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export async function listLibraryVideos(libraryId: number) {
  const result = await BunnyStreamApi.listVideos(libraryId, { page: 1, itemsPerPage: 20 });
  if (result.ok) {
    console.log(result.value.items);
  } else {
    console.warn(result.error.kind, result.error.message);
  }
  return result;
}
```

## Credentials and production apps

A library API key can manage content. Do not commit it or assume that environment variables,
build-time secrets, or secure storage make a key used by a distributed app impossible to extract.
Keep management operations and playback-token signing on your backend wherever possible.

The current wrapper's documented initialization requires a non-empty API access key; it does
not expose a token-only initializer or a configurable backend proxy for management calls.
Passing a playback token does not remove that initialization requirement. Do not substitute
an embed token or a made-up string for the API key. If your production app must never receive
library credentials, resolve that architectural requirement before adopting this initialization
flow. See [Secure playback](secure-playback.md).

## Next steps

- [Play a video](play-a-video.md) or [play a live stream](play-a-live-stream.md).
- [Upload videos](upload-videos.md) or [broadcast from the camera](go-live-from-the-camera.md).
- [Handle errors](handle-errors.md) and review the [capability matrix](capability-matrix.md).
