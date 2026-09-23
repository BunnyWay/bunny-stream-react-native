# Bunny Stream React Native

> 🚧 **Coming soon.** This SDK is currently in early development and is not yet ready for use. Follow this repository for updates.

## What is Bunny Stream?

Bunny Stream is a video platform that provides encoding, storage, delivery, and playback for video content through Bunny's global CDN. This package will bring Bunny Stream to React Native by wrapping the official native SDKs behind a single, idiomatic React Native/TypeScript API, based on:

- [Bunny Stream iOS SDK](https://github.com/BunnyWay/bunny-stream-ios)
- [Bunny Stream Android SDK](https://github.com/BunnyWay/bunny-stream-android)

### Planned Key Features

- Complete API Integration: Full support for the Bunny REST Stream API
- Efficient Video Upload: TUS protocol implementation for reliable, resumable uploads
- Advanced Video Player: Native playback powered by AVKit (iOS) and Media3/ExoPlayer (Android)
- Camera Upload Support: Recording and uploading videos directly from the device camera
- Type-Safe API: Fully typed TypeScript API for compile-time safety
- Native Bridge, Not a Reimplementation: A thin React Native bridge/plugin on top of the official native SDKs

## System Requirements

| Requirement  | Minimum version                               |
| ------------ | --------------------------------------------- |
| Node.js      | 18 (see `.nvmrc` for the version used in CI)  |
| React        | 18.0.0                                        |
| React Native | 0.71.0                                        |
| Android API  | 26 (required by the Bunny Stream Android SDK) |

These are the floors declared in `peerDependencies` / `engines` in `package.json` and may be raised as the native bridge is implemented. The native implementation targets the React Native **New Architecture** (TurboModules and Fabric components).

## Status

This repository contains the TypeScript contract, Android and iOS native bridges, build tooling via [react-native-builder-bob](https://github.com/callstack/react-native-builder-bob), and an example app for development. Platform support is documented per feature in the sections below.

### Camera broadcaster

`BunnyStreamBroadcaster` is a Fabric component that hosts the native Bunny Stream camera capture pipeline. It supports recording a new VOD or broadcasting to an existing live stream.

```tsx
import { BunnyStreamBroadcaster } from 'bunny-stream-react-native';

<BunnyStreamBroadcaster
  accessKey="access-key"
  source={{ type: 'live', libraryId: 123, streamId: 'stream-id' }}
  cameraPosition="back"
  onStateChange={(e) => console.log('state:', e.state)}
  onError={(e) => console.warn('error:', e.message)}
/>
```

**Permissions:** Camera and microphone permissions must be requested by the host app before mounting the broadcaster. Neither native SDK requests these permissions itself.

**Platform differences:**

- **iOS:** `startBroadcast`, `stopBroadcast`, `switchCamera`, `setMuted`, and `toggleMute` are supported natively via `BunnyBroadcastController`. Quality is fully configurable through the `quality` prop (mapped to `BroadcastQuality`).
- **Android:** `stopBroadcast`, `switchCamera`, `setMuted`, and `toggleMute` are supported. `startBroadcast` is **not** supported natively — the public SDK has no start method. The bridge simulates the built-in start button when `hideDefaultControls` is `false`; when controls are hidden, `startBroadcast` resolves with an `InvalidState` error. Quality is hard-coded by the SDK (1080p30, ~9.3 Mbps video, 64 kbps audio); the `quality` prop is accepted but ignored.

**Reconnect and failover:** Both platforms retry with 1/2/4/8/8s backoff up to 5 attempts, alternating primary and backup ingest endpoints. Proactive failover occurs after two consecutive not-live polls. `dualPublish` publishes to both endpoints simultaneously with independent 5s reconnect on Android.

**Background policy:** The broadcaster is foreground-only. Neither native SDK exposes a public background-broadcast or interruption-resume API. Host apps must stop the broadcast on app backgrounding.

### Extended player controls

Adds skip, chapters/moments/retention events, and resume position.

**Skip forward/backward** (both platforms, JS-side):

```tsx
playerRef.current?.skipForward();    // +10s (configurable)
playerRef.current?.skipBackward();   // -10s (configurable)
```

**Chapters, moments, retention graph** (Android-only player events):

```tsx
<BunnyStreamPlayer
  source={{ type: 'vod', videoId }}
  onChaptersUpdated={(e) => setChapters(e.nativeEvent.chapters)}
  onMomentsUpdated={(e) => setMoments(e.nativeEvent.moments)}
  onRetentionGraphUpdated={(e) => setRetention(e.nativeEvent.points)}
/>
```

> **iOS:** The native player view does not expose these events. Fetch chapters/moments via `BunnyStreamApi.getVideo` and the retention/heatmap via `BunnyStreamApi.getVideoHeatmap`.

**Resume position:**

- **Android:** Native SDK `PlaybackPositionManager` via the `resumeConfig` prop. The `onResumePositionAvailable` event fires when a saved position is available; the host decides whether to seek.
- **iOS:** JS-side fallback via the `useResumePosition` hook with `AsyncStorage`. Tracks progress, persists positions, and restores on player readiness.

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useResumePosition } from 'bunny-stream-react-native';

const { restoredPosition, savePosition, clearPosition, getAllPositions } = useResumePosition({
  playerRef,
  videoId: 'video-id',
  videoTitle: 'My Video',
  storage: AsyncStorage,
  config: { retentionDays: 7, minimumWatchMs: 30_000 },
});
```

**Resume confirmation UX:** return `false` from `onPositionAvailable` (iOS hook) or handle `onResumePositionAvailable` (Android prop) to show a "Resume / Start Over" prompt instead of auto-seeking — the example app demonstrates this pattern.

**Resume management** (platform-agnostic; Android delegates to the native `PlaybackPositionManager`, iOS uses the pluggable storage):

```tsx
import {
  getAllResumePositions,
  clearResumePosition,
  clearAllResumePositions,
  exportResumePositions,
  importResumePositions,
  cleanupExpiredResumePositions,
} from 'bunny-stream-react-native';

const positions = await getAllResumePositions(AsyncStorage); // storage arg is iOS-only
await clearResumePosition('video-id', AsyncStorage);
await clearAllResumePositions(AsyncStorage);
const json = await exportResumePositions(AsyncStorage); // normalized PlaybackPosition[] JSON
await importResumePositions(json, AsyncStorage);
await cleanupExpiredResumePositions(AsyncStorage, 7 /* retentionDays, iOS-only arg */);
```

**Playback speed list** — `getPlaybackSpeeds()` queries the native engine on Android (respects `allowedSpeeds` and dashboard `playerSettings`); on iOS it returns the SDK's hardcoded list `[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]`:

```tsx
import { getPlaybackSpeeds } from 'bunny-stream-react-native';

const speeds = await getPlaybackSpeeds();
```

### Images, TV, and cast/PiP

**BunnyImage** — image component that renders Bunny CDN thumbnails through the native image pipeline (Fresco on Android, `RCTImageLoader` on iOS). Injects the `Referer` header that CDN hotlink protection requires; no JS `fetch` + base64, so lists stay cheap.

```tsx
import { BunnyImage, bunnyImageSource } from 'bunny-stream-react-native';

<BunnyImage source={video.thumbnailUrl} style={{ width: 160, height: 90 }} />
<Image source={bunnyImageSource(video.thumbnailUrl)} /> // or with plain Image
```

`useBunnyImage` is deprecated — it converts images to `data:` URIs in JS and bypasses native caches.

**Android TV** — opt-in via the `useNativeTvPlayer` prop (Android-only). Routes through the SDK's `playVideoWithTVDetection`: on leanback devices it launches the dedicated TV player activity when the consumer app also depends on the `net.bunny:tv` artifact (published separately); otherwise it falls back to the embedded player.

```tsx
<BunnyStreamPlayer source={{ type: 'vod', videoId }} useNativeTvPlayer />
```

`isRunningOnTV()` reports the leanback system feature (always `false` on iOS — the iOS SDK does not support tvOS).

**Cast handover** — `onPlayerTypeChange` (Android-only) fires when playback moves between the device and a Chromecast receiver:

```tsx
<BunnyStreamPlayer
  source={{ type: 'vod', videoId }}
  onPlayerTypeChange={(e) => setIsCasting(e.nativeEvent.playerType === 'cast')}
/>
```

> **iOS:** AirPlay state is internal to the SDK — this event never fires.

**PiP** — `playerRef.current?.enterPiP()` enters picture-in-picture on Android (API 26+, requires `android:supportsPictureInPicture="true"` on the host activity). No-op on iOS — the SDK exposes no public PiP API.

> Programmatic cast start/stop and fullscreen commands are not exposed by either SDK's public API; the native buttons inside the player controls already work.

### Public SDK APIs

The Android SDK is consumed from Maven Central (`net.bunny:player/api/recording:4.0.0`) — no local checkout or `mavenLocal()` needed. iOS still uses a pinned local checkout pending a public release tag.

**Video insights** — Android-only additions (iOS resolves with an `InvalidState` error; the endpoints are absent from the iOS generated client):

```tsx
// Play data enriched with heatmap (GET /videos/{id}/play/heatmap)
const playData = await BunnyStreamApi.fetchVideoHeatmapData(libraryId, videoId, token, expires);
// Per-rendition storage breakdown (GET /videos/{id}/storage)
const storage = await BunnyStreamApi.fetchVideoStorageSize(libraryId, videoId);
```

**Live poll** — `pollLiveStream(libraryId, streamId)` is the lightweight single-shot fetch the native players use for status refreshes. iOS delegates to `getLiveStream` (same return shape).

**Video quality** (Android-only; no-op on iOS) — `setVideoQuality` applies Media3 track-selection parameters on the engine exposed by the SDK's public `BunnyPlayer.currentPlayer`:

```tsx
playerRef.current?.setVideoQuality({ maxHeight: 720 });   // cap at 720p
playerRef.current?.setVideoQuality({ maxBitrate: 1_500_000 }); // cap bitrate (bps)
playerRef.current?.setVideoQuality('auto');                // back to adaptive
```

List available renditions with `BunnyStreamApi.fetchVideoResolutions`. While casting, the constraint is a no-op on the cast player and reapplies when playback returns to the device.

## Development

For local development setup, running the example app, and contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Installation

```bash
npm install bunny-stream-react-native
```

> Not published yet. This section is a placeholder for the first release.

### Expo

The package ships an Expo config plugin (`app.plugin.js`). Because the library contains native code, it requires a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`expo-dev-client`, `expo prebuild`, or EAS Build) — **Expo Go and Expo web are not supported**. Expo SDK 52 or newer is required since the library only supports the New Architecture.

```json
{
  "expo": {
    "plugins": [
      [
        "bunny-stream-react-native",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to record and broadcast video.",
          "microphonePermission": "Allow $(PRODUCT_NAME) to capture audio during recording and broadcasting.",
          "photoLibraryPermission": "Allow $(PRODUCT_NAME) to pick videos to upload."
        }
      ]
    ]
  }
}
```

The plugin applies the host-app configuration the native SDKs need:

- **Android:** `CAMERA`/`RECORD_AUDIO` permissions, `supportsPictureInPicture` + `configChanges` on `MainActivity` (required for `enterPiP()`), core library desugaring in `android/app/build.gradle` (required by the SDK's media3/IMA dependencies), `android.minSdkVersion=26` / `android.kotlinVersion=2.2.20` floors in `gradle.properties` (only raised, never lowered), and a pinned `kotlin-gradle-plugin` version in the root `build.gradle` (the Expo template declares it versionless, which resolves to a compiler too old for the SDK's Kotlin metadata).
- **iOS:** camera/microphone/photo-library usage descriptions, `UIBackgroundModes=audio` (required for `enterPiP()`), an "Embed SwiftPM Frameworks" build phase that copies `GoogleInteractiveMediaAds.framework` into the app bundle, and a backport of the upstream `spm.rb` UUID-collision fix for React Native < 0.88 (applied to `node_modules` during `prebuild`).

| Prop | Default | Notes |
| --- | --- | --- |
| `cameraPermission` | generic text | `false` skips the key |
| `microphonePermission` | generic text | `false` skips the key |
| `photoLibraryPermission` | — | only written when provided |
| `enablePictureInPicture` | `true` | Android manifest flags |
| `enableBackgroundAudio` | `true` | iOS `UIBackgroundModes=audio` |
| `desugarJdkLibsVersion` | `"2.1.5"` | Android desugar dependency |

Bare React Native apps that also use Expo modules (no `prebuild` step) must apply the same changes by hand — the plugin only runs during Continuous Native Generation. `BUNNY_STREAM_IOS_SDK_PATH` works unchanged (the podspec reads it during `pod install`).

The iOS SDK generates its API client with the `swift-openapi-generator` build-tool plugin. `expo run:ios`, Xcode and EAS Build handle this correctly out of the box. If you drive `xcodebuild` yourself, pass only `-destination` — do **not** add `-sdk iphonesimulator`, which makes Xcode compile plugin executables for the destination platform and fails with `_OpenAPIGeneratorCore is only to be used by swift-openapi-generator itself`.

## Related SDKs

- [Bunny Stream iOS SDK](https://github.com/BunnyWay/bunny-stream-ios)
- [Bunny Stream Android SDK](https://github.com/BunnyWay/bunny-stream-android)
- [Bunny Stream documentation](https://docs.bunny.net/stream/mobile-sdk)

## License

Bunny Stream React Native is licensed under the [MIT License](./LICENSE). See the LICENSE file for more details.

## About

React Native bridge/plugin for Bunny Stream, wrapping the native iOS and Android Bunny Stream SDKs for video management, playback, uploading, and camera recording.
[docs.bunny.net/stream/mobile-sdk](https://docs.bunny.net/stream/mobile-sdk)
