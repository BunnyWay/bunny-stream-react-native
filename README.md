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

This repository contains the TypeScript contract, Android and iOS native bridges, build tooling via [react-native-builder-bob](https://github.com/callstack/react-native-builder-bob), and an example app for development. See the generated [capability matrix](./docs/CAPABILITIES.md) for current platform support and planned delivery phases.

### Camera broadcaster (Phase 5)

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

### Extended player controls (Phase 6)

Phase 6 adds skip, chapters/moments/retention events, and resume position.

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

See the [capability matrix](./docs/CAPABILITIES.md) for the full platform breakdown.

Planned roadmap:

1. Wrap the [Bunny Stream iOS SDK](https://github.com/BunnyWay/bunny-stream-ios)
2. Wrap the [Bunny Stream Android SDK](https://github.com/BunnyWay/bunny-stream-android)
3. Expose both through a single React Native bridge/plugin with a shared TypeScript API

## Development

For local development setup, running the example app, and contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Installation

```bash
npm install bunny-stream-react-native
```

> Not published yet. This section is a placeholder for the first release.

## Related SDKs

- [Bunny Stream iOS SDK](https://github.com/BunnyWay/bunny-stream-ios)
- [Bunny Stream Android SDK](https://github.com/BunnyWay/bunny-stream-android)
- [Bunny Stream documentation](https://docs.bunny.net/stream/mobile-sdk)

## License

Bunny Stream React Native is licensed under the [MIT License](./LICENSE). See the LICENSE file for more details.

## About

React Native bridge/plugin for Bunny Stream, wrapping the native iOS and Android Bunny Stream SDKs for video management, playback, uploading, and camera recording.
[docs.bunny.net/stream/mobile-sdk](https://docs.bunny.net/stream/mobile-sdk)
