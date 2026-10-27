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

## [1.1.0] - 2026-10-27

### Added

- `onError` on the VOD player now reports a stable cross-platform `category`:
  `unavailable` for terminal refusals (a CDN 403 — geo-blocking, referrer
  protection or token auth are deliberately not told apart — a DNS-sinkholed
  CDN host, or a terminal `/play`/settings response such as 401/404/410 on
  Android), `network` for lost connectivity (retryable), and `unknown` for
  anything else. Android also reports `httpStatus` when the failure carried a
  real HTTP status. `useBunnyStreamPlayer`'s `state.error` carries the same
  fields, so apps can show "Video is not available" for geo-blocked content
  instead of an endless spinner.

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
