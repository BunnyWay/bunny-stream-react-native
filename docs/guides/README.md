# Integration guides

Task-oriented guides for the Bunny Stream React Native SDK on iOS and Android.
Examples use the public exports from `@bunny.net/stream-react-native`, not the native SDK APIs.

## Start here

- [Getting started](getting-started.md) — requirements, native setup, initialization, and credentials.
- [Expo](expo.md) — development builds, config plugin options, and permissions.

## Playback

- [Play a video](play-a-video.md) — native controls, hooks, commands, and resume positions.
- [Play a live stream](play-a-live-stream.md) — countdowns, trailers, DVR, and recordings.
- [Secure playback](secure-playback.md) — backend-issued tokens, DRM, and protected images.
- [Picture-in-Picture and casting](picture-in-picture-and-cast.md) — PiP, AirPlay, Chromecast, and Android TV.

## Managing content

- [Manage videos and collections](manage-videos.md) — metadata, captions, encoding, AI, and analytics.
- [Upload videos](upload-videos.md) — TUS, progress, pause/resume, and recovery.
- [Manage live streams](manage-live-streams.md) — scheduling, lifecycle, thumbnails, and RTMP outputs.

## Publishing from the device

- [Go live from the camera](go-live-from-the-camera.md) — permissions, broadcasting, and recording to VOD.

## Reference

- [Handle errors](handle-errors.md) — results, callbacks, and configuration failures.
- [Troubleshooting](troubleshooting.md).
- [Public exports](../../src/index.ts), [player types](../../src/player/BunnyStreamPlayer.types.ts), and [management API](../../src/api/BunnyStreamApi.ts).

The [React Native example](../../example/) demonstrates the larger integration;
the [Expo example](../../example-expo/README.md) demonstrates a minimal development build.
See [Contributing](../../CONTRIBUTING.md#running-the-example-app) to run the React Native example.

Native capabilities are not automatically available through the wrapper. These guides describe
the React Native API against the [pinned native SDK baselines](../../native-sdk-baselines.json).
Platform-specific limitations are documented alongside each feature in the guides above.
