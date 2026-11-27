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

### Added

- `yarn publish` now releases the library and then builds and uploads the example
  apps to TestFlight and Firebase App Distribution. Use `yarn example:distribute`
  to ship the example apps independently.
- Example app: share changelog notes in TestFlight and Firebase App Distribution,
  and notify the configured external TestFlight group when the build is available.
- iOS example: include the configured encryption export compliance declaration
  in new TestFlight builds.
- Example app: show the app version and platform build number at the bottom of
  Settings on iOS and Android.
- Example app: reset settings, credentials, resume positions, and local upload
  data from Settings after confirmation.

### Changed

- Example app: add Yarn commands backed by Fastlane to build and upload iOS to
  TestFlight and Android to Firebase App Distribution, with upload-only retries.
  iOS uploads support either App Store Connect API keys or Apple ID with an
  app-specific password.
  Release APK builds now increment Android `versionCode` automatically.

- Example app: automatically synchronize its package and native app versions with
  the library during release preparation and builds.
- Example app: automatically increment the iOS build number before each IPA build.
- Example app: add Android APK builds with upload to Firebase App Distribution.
- Example app: change the Android application ID from `com.microsoft.reacttestapp`
  to `net.bunny.stream.reactnative.example`. Android installs it as a separate app.

### Fixed

- iOS example: select the Bunny App Store Connect team automatically and find
  external TestFlight testers through the app's beta groups.
- Example app: resolve Node from the iOS build environment instead of a
  developer-specific path.
- Example app: reject combining `--build` with a custom `--apk` path so Android
  build-and-upload commands cannot distribute an older binary from that path.

## [1.1.2] - 2026-11-26

### Fixed

- Fix Metro bundling of the published package on Android and iOS by removing
  an invalid relative `package.json` import from SDK initialization.

## [1.1.1] - 2026-11-05

### Added

- Example app: configure a separate token authentication key in Settings or
  `BUNNY_TOKEN_AUTH_KEY`. Saved settings override environment defaults; the
  library API key remains dedicated to management operations.

### Changed

- Update the native Bunny Stream iOS SDK from 1.0.3 to 1.0.5. The exact versions
  and revisions are recorded in `native-sdk-baselines.json`.

### Fixed

- Example app: pass playback tokens and expiry to the VOD player from direct
  play, the video list, saved resume positions, and completed uploads. Live
  playback and thumbnail requests also use the configured token signing key.
- iOS: opening the player's settings menu while in fullscreen no longer
  dismisses fullscreen.
- iOS: ended live streams now authorize their recording and fallback playback
  with the provided token and `Referer` header instead of showing
  "not available" on token-authenticated libraries.
- The README logo no longer renders twice on npm; the light/dark variants now
  use a `<picture>` element instead of GitHub-only `#gh-*-mode-only` anchors.

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
