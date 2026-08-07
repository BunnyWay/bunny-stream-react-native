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

| Requirement | Minimum version |
| ------------ | ---------------- |
| Node.js | 18 (see `.nvmrc` for the version used in CI) |
| React | 18.0.0 |
| React Native | 0.71.0 |

These are the floors declared in `peerDependencies` / `engines` in `package.json` and may be raised as the native bridge is implemented. The planned native implementation will target the React Native **New Architecture** (TurboModules and Fabric components).

## Status

This repository currently contains the base setup for the future npm package (TypeScript configuration, linting, and build tooling via [react-native-builder-bob](https://github.com/callstack/react-native-builder-bob)) and an example app for development. No native bridge exists yet.

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
