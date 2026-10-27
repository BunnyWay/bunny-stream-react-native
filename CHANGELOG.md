# Changelog

All notable changes to Bunny Stream React Native are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/), and the project
follows [Semantic Versioning](https://semver.org/).

Add user-facing changes under `[Unreleased]` as part of the pull request that makes
them. Use `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security` groups
as needed. Include migration steps for breaking changes and name the affected
platform when behavior differs between Android and iOS.

Release notes are tracked here starting with the release after `v1.0.0`.
For earlier releases, see [GitHub Releases](https://github.com/BunnyWay/bunny-stream-react-native/releases).

## [Unreleased]

### Changed

- Update the native Bunny Stream Android SDK from 4.2.1 to 4.2.2 and the iOS SDK
  from 1.0.2 to 1.0.3. The exact versions and revisions are recorded in
  `native-sdk-baselines.json`.

### Fixed

- Android: playback-only initialization now works with libraries that require a
  referrer. Player settings requests send the required `Referer` header, and
  settings failures surface the original error instead of starting playback with
  an empty URL.
- iOS: the native playback speed menu follows the library's configured speeds
  instead of always offering 0.5x to 2x.
- iOS: quality selection derives bitrate caps from the stream's actual variants
  and includes 1440p and 2160p renditions when available.
