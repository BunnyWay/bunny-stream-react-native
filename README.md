# Bunny Stream React Native

<p align="center">
  <img src="resources/bunnynet.svg" width="70%" alt="BunnyNet" />
</p>
<p align="center">
    <a href="https://www.npmjs.com/package/@bunny.net/stream-react-native">
        <img src="https://img.shields.io/npm/v/@bunny.net/stream-react-native" alt="npm" />
    </a>
    <a href="./LICENSE">
        <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
    </a>
    <a href="https://github.com/BunnyWay/bunny-stream-react-native/actions/workflows/ci.yml">
        <img src="https://github.com/BunnyWay/bunny-stream-react-native/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
    </a>
</p>

## What is Bunny Stream?

Bunny Stream is the React Native SDK for [Bunny's](https://bunny.net) video platform. It wraps the official [iOS](https://github.com/BunnyWay/bunny-stream-ios) and [Android](https://github.com/BunnyWay/bunny-stream-android) SDKs with one TypeScript API for video management, uploads, playback, and live broadcasting.

### Key features

- **Video playback**: native player with adaptive streaming, captions, customizable controls, and resume positions.
- **Live streaming**: live playback with countdowns, pre-stream trailers, DVR, and transition to the recording.
- **Camera recording and broadcasting**: record videos or broadcast live with automatic reconnect and primary/backup failover.
- **Resumable uploads**: TUS uploads with progress events, pause, resume, and cancellation.
- **Library management**: typed APIs for videos, collections, live streams, and analytics.
- **Expo support**: a config plugin for development builds.

## Documentation

- [Integration guides](docs/guides/README.md) — setup, Expo, playback, uploads, broadcasting, and content management.
- [Capability matrix](docs/guides/capability-matrix.md) and [troubleshooting](docs/guides/troubleshooting.md).
- [Platform notes](#platform-differences) — platform-specific options and limitations.
- [React Native example](example/) — playback, uploads, library management, and live streaming; see [setup instructions](CONTRIBUTING.md#running-the-example-app).
- [Expo example](example-expo/README.md) — a minimal app using the config plugin.
- [Bunny Stream documentation](https://docs.bunny.net/stream/mobile-sdk).

## Requirements

- React Native with the **New Architecture** enabled (TurboModules and Fabric). The example app uses React Native 0.86.2.
- **Expo** (if used): SDK 52+ with a development build. Expo Go is not supported.
- **iOS**: Xcode and CocoaPods; use the minimum iOS deployment target required by your React Native version (the native Bunny SDK requires iOS 15+). The CocoaPods setup must support React Native's `spm_dependency` helper.
- **Android**: Android 8.0 (API 26)+, `compileSdk` 36+, JDK 17, Kotlin 2.2.20+, and core library desugaring.
- A [Bunny Stream video library](https://bunny.net/stream/) with its library ID and API access key.
- A physical device for camera recording and broadcasting.

## Installation

```bash
npm install @bunny.net/stream-react-native
```

### React Native

The package links automatically. Android dependencies are resolved from Maven Central; iOS dependencies are resolved from the public Swift package.

**iOS:** install pods from your app's `ios` directory:

```bash
bundle exec pod install
```

The app must embed and sign `GoogleInteractiveMediaAds.framework`, a dependency of the native player. Add a Run Script build phase using the `EMBED_FRAMEWORKS_SCRIPT` from the [iOS config plugin](plugin/src/ios.ts). The Expo plugin adds this automatically.

**Android:** use the SDK and Kotlin versions listed above, and enable desugaring in `android/app/build.gradle`:

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

Ensure the app declares `android.permission.INTERNET`. For Picture-in-Picture, add `android:supportsPictureInPicture="true"` to the host activity.

### Expo

Expo requires a [development build](https://docs.expo.dev/develop/development-builds/introduction/) with the New Architecture enabled. **Expo Go and web are not supported.**

Add the plugin to `app.json`:

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

Then generate and build the native app:

```bash
npx expo prebuild
npx expo run:ios
# or: npx expo run:android
```

The plugin configures permissions, Android build settings and Picture-in-Picture, and iOS framework embedding and background audio. It runs during prebuild; apps that manage native projects manually must apply those settings themselves. See the [plugin options](plugin/src/types.ts) for customization.

### Camera permissions

Before mounting the broadcaster, request camera and microphone permissions in your app. For manual native setup, also declare `CAMERA` and `RECORD_AUDIO` in AndroidManifest.xml, and add `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` to Info.plist. The Expo plugin adds these declarations, but your app still needs to request runtime access.

## Quickstart

### Initialize

Call `initialize` once during app startup, before mounting a player or using the API:

```ts
import { initialize } from '@bunny.net/stream-react-native';

initialize('your-library-api-key', 12345);
```

### Play a video

```tsx
import { BunnyStreamPlayer } from '@bunny.net/stream-react-native';

export function VideoScreen() {
  return (
    <BunnyStreamPlayer
      source={{ type: 'vod', videoId: 'your-video-guid' }}
      style={{ width: '100%', aspectRatio: 16 / 9 }}
    />
  );
}
```

For both VOD and live sources, `source.libraryId` is optional and falls back to the library passed to `initialize()`. Set it on the source to override the initialized library.

Set `controls={false}` to hide the player's built-in controls. See the [player types](src/player/BunnyStreamPlayer.types.ts) for props, events, and commands.

### Play a live stream

Use the same component with a live source. It also uses the initialized library unless you explicitly provide `libraryId`:

```tsx
<BunnyStreamPlayer
  source={{ type: 'live', streamId: 'your-stream-guid' }}
  style={{ width: '100%', aspectRatio: 16 / 9 }}
/>
```

Missing or invalid library IDs report `MISSING_LIBRARY_ID` or `INVALID_LIBRARY_ID` through `onError`; without a handler, configuration errors throw. Native live errors use `onLiveError`.

### Broadcast from the camera

After granting camera and microphone permissions, mount the broadcaster with an existing live stream. Its built-in controls start and stop the broadcast:

```tsx
import { BunnyStreamBroadcaster } from '@bunny.net/stream-react-native';

<BunnyStreamBroadcaster
  accessKey="your-library-api-key"
  source={{ type: 'live', libraryId: 12345, streamId: 'your-stream-guid' }}
  style={{ flex: 1 }}
  onError={(event) => console.warn(event.message)}
/>;
```

Use `source={{ type: 'new', libraryId: 12345 }}` to record and upload a new video instead. Broadcasting is foreground-only; stop it when the app enters the background.

### Manage videos and live streams

API calls return a `BunnyResult`: check `ok` to access the value or error.

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

const result = await BunnyStreamApi.listVideos(12345);

if (result.ok) {
  console.log(result.value.items);
} else {
  console.warn(result.error.message);
}
```

The [API reference in source](src/api/BunnyStreamApi.ts) also covers collections, live stream creation and scheduling, thumbnails, captions, reencoding, AI transcription, and analytics. See [platform differences](#platform-differences) for capabilities that are not shared by both SDKs.

### Upload a video

After initialization, pass a local file URI to start a resumable upload. The SDK creates the video entry for you:

```ts
import { BunnyStreamUpload } from '@bunny.net/stream-react-native';

const result = await BunnyStreamUpload.startUpload({
  libraryId: 12345,
  uri: 'file:///path/to/video.mp4',
  title: 'My video',
  mode: 'tus',
});

if (result.ok) {
  console.log(result.value.uploadId);
} else {
  console.warn(result.error.message);
}
```

Subscribe with `BunnyStreamUpload.addUploadListener` to track progress and completion; call the returned unsubscribe function when finished. `startUpload()` defaults to `basic`, so set `mode: 'tus'` explicitly for resumable uploads. See the [upload API](src/upload/BunnyStreamUpload.ts) for pause, resume, and cancellation.

### Interrupted uploads and background behavior

Use `continueUpload()` to resume an interrupted TUS transfer. Do not assume uploads automatically retry when connectivity returns.

On iOS, TUS supports background uploads and reattaching to cached transfers with `restoreUploads()`; user force-quit cancels background transfers. On Android, uploads stop with the process; use `continueUpload()` with saved video/file details to resume after relaunch. Recovery depends on file availability, authorization, and server state.

## Platform differences

Feature availability and options differ between platforms. See the [player types](src/player/BunnyStreamPlayer.types.ts) and [API source](src/api/BunnyStreamApi.ts) for operation-specific limitations. Android TV requires `useNativeTvPlayer` and the optional `net.bunny:tv` dependency.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, running the examples, and contribution guidelines.

## License

Bunny Stream React Native is licensed under the [MIT License](LICENSE).
