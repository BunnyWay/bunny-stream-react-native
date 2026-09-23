# Bunny Stream Mobile SDK — Live Features

> **Confidential / private**

## Status summary

As of **2 September**:

- **Supported:** 14 of 30 features
- **Not supported:** 5 of 30 features
- **Partial or pending verification:** 11 of 30 features

## Feature checklist

| # | Feature | Description / requirements | Android Mobile SDK | iOS Mobile SDK | React Native SDK |
| ---: | --- | --- | --- | --- | --- |
| 1 | RTMP live encoding | Start and stop a live stream; configure stream key and URL; use the camera, video, and microphone audio to stream from a mobile device to Bunny ingest. | Finished | Finished | **Not supported** (2 Sep) |
| 2 | Live MPEG-DASH playback | Playback support for live stream codecs. | Finished | Not supported or recommended by AVPlayer | Inherited from native SDKs |
| 3 | Live HLS playback | Playback support for live stream codecs. | Finished | Finished | Inherited from native SDKs |
| 4 | Add live stream flow | Allow users to create a live stream through the Mobile SDK. | Finished | Finished | **Supported** |
| 5 | Live stream title | Set a title when creating a live stream. | Finished | Finished | **Supported** |
| 6 | Live stream description | Set a description when creating a live stream. | Finished | Finished | **Supported** |
| 7 | Scheduling | Enable or disable scheduling and configure time, date, and timezone. | Finished | Finished (17 Jun) | **Partial:** verify timezone support |
| 8 | DVR | Enable or disable DVR and configure the DVR timeframe. | Finished | Finished | **Supported** |
| 9 | Thumbnail management | Enable or disable thumbnails; list, upload, preview, and delete thumbnail assets. | Finished | Finished (17 Jun) | **Supported** |
| 10 | Pre-stream trailer management | Enable or disable a pre-stream trailer; list, upload, preview, and delete trailer assets. | Finished | Finished (17 Jun) | **Not supported** (2 Sep) |
| 11 | Watermark management | Enable or disable a watermark; upload, preview, and delete the asset; configure its size and position. Use the VOD dashboard library encoder settings as the reference for size and position. | Waiting for API | Finished | **Not supported** (2 Sep) |
| 12 | Live stream preview | Preview a live stream in the stream creation/management flow. | Finished | Finished | **Not supported** (2 Sep) |
| 13 | Live stream status | Expose the current live stream status. | Finished | Finished | **Supported** |
| 14 | Primary and backup badges | Identify primary and backup stream endpoints. | Finished | Finished (17 Jun) | **Supported** |
| 15 | RTMP ingest details | Expose the stream key, primary URL, and backup URL. | Finished | Finished | **Supported** |
| 16 | RTMP outputs | Configure up to four outputs, each with a stream URL and stream key. | Finished | Finished | **Partial** (2 Sep) |
| 17 | Mobile SDK user agent | Identify that playback comes from a Mobile SDK and report the SDK version. | Finished | Finished (17 Jun) | **Not supported** (2 Sep) |
| 18 | CMCD v2 statistics | Send Common Media Client Data statistics from the Mobile SDK player to Bunny using headers, query parameters, and JSON, aligned with the iOS implementation. | To be updated to match iOS | Finished | **Pending verification** (2 Sep) |
| 19 | AirPlay | Cast VOD and live video from an iOS device through the Mobile SDK player. | Not applicable | Finished | **Pending verification** (2 Sep) |
| 20 | Chromecast | Cast VOD and live video from an Android device through the Mobile SDK player. | Finished (24 Jun) | Not applicable | **Pending verification** (2 Sep) |
| 21 | Live player UI customization | Configure UI language and font family for the transport bar and countdown; primary color; AirPlay, Chromecast, duration, large play button, fullscreen, mute, PiP, live play/pause, progress, settings, volume, and DVR controls; watch-time heatmap; and compact controls. | Requires review; likely partially supported | Finished | **Partial; pending verification** (2 Sep) |
| 22 | Portrait and landscape orientation | Update the player orientation when the device rotates during a live stream. | Finished | Finished | **Supported** |
| 23 | 16:9 and 9:16 playback | Play both horizontal and vertical live content. | Finished | Finished (17 Jun) | Inherited from native SDKs |
| 24 | Live-to-VOD playback | Switch to VOD playback when a live stream ends. | Finished | Finished (24 Jun) | **Supported** |
| 25 | Live player countdown | Display a countdown before a live stream. The countdown must remain visible above the pre-stream trailer and thumbnail. | Finished | Finished | **Pending verification** (2 Sep) |
| 26 | Live player watermark | Display the watermark during a live stream. Note: this is currently not working on web. | Finished | Finished | **Pending verification** (2 Sep) |
| 27 | Live player thumbnail | Display the thumbnail before a live stream starts. | Finished | Finished (24 Jun) | **Pending verification** (2 Sep) |
| 28 | Live player pre-stream trailer | Display the pre-stream trailer before a live stream starts. | Finished | Finished | **Pending verification** (2 Sep) |
| 29 | Thumbnail fallback logic | When a custom thumbnail is configured and the encoder disconnects, display the thumbnail in the player. | Finished | Finished (24 Jun) | **Supported** |
| 30 | Pre-stream trailer precedence | The pre-stream trailer takes precedence over the thumbnail. | Finished | Finished | **Pending verification** (2 Sep) |

## Delivery plan

### Immediate next steps

1. Deliver a test application to Mateusz.
2. While Aleksander is on leave, Mateusz will execute the React Native feature verification described above.
3. Record verified results and update all partial or pending statuses.
4. Begin the next development phase: camera ingest and RTMP live encoding from the React Native SDK.

### Remaining implementation work

According to Aleksander, the main remaining items are:

- uploader module;
- camera and live-ingest module;
- comprehensive testing;
- release and publishing scripts for npm.

## React Native SDK audit scope

The repository structure and example application are going to be refactored. **Do not review the current example application yet**, because findings would quickly become obsolete.

The SDK audit should instead focus on the library itself:

1. **npm package readiness**
   - package structure and published file set;
   - entry points, exports, TypeScript declarations, source maps, and build artifacts;
   - peer dependencies and React Native autolinking configuration;
   - release/versioning process and npm publishing scripts.

2. **New Architecture compatibility**
   - review the complete native bridge;
   - verify TurboModule compatibility;
   - verify Fabric Native Component/codegen compatibility;
   - identify lifecycle, threading, event, and backward-compatibility risks.

3. **Native API exposure**
   - confirm that methods and properties from the Android and iOS repositories are exposed correctly;
   - confirm that argument types, return values, events, errors, and platform differences are represented accurately in the React Native API.

4. **Feature parity**
   - compare the React Native SDK with both native SDKs;
   - identify missing, partial, or unverifiable functionality;
   - map each native capability to its React Native implementation and test coverage.

5. **React Native integration quality**
   - assess whether the public API, component lifecycle, state handling, event subscriptions, and native resource cleanup follow React Native conventions;
   - verify behavior across supported React Native versions and both old and new architectures;
   - identify likely runtime, build, and integration issues for consumers.

## Expo strategy

Adding an Expo config plugin does **not automatically require a second example application**. The existing bare React Native example can remain the primary native-development and debugging application.

However, a separate minimal Expo example is recommended because it validates a different consumer workflow:

- installation in an Expo project;
- config plugin behavior during prebuild;
- generated iOS and Android native configuration;
- development build creation;
- autolinking and runtime behavior in the Expo environment.

This must be an **Expo development build / prebuild** example, not an Expo Go example, because the SDK contains custom native modules and components. The Expo example may be introduced after the current example application and repository structure have been refactored.

## Maintenance proposal: continuously green React Native SDK

Offer an ongoing **React Native SDK compatibility and release-readiness service** as part of library maintenance.

The service would provide:

- automated build and integration checks for supported React Native versions;
- automated checks when a new stable React Native or Expo SDK version is released;
- validation of Android and iOS builds under both relevant architecture modes;
- verification of the Expo config plugin, prebuild output, autolinking, and development builds;
- smoke tests for core playback and native bridge functionality;
- ready-to-install test builds for QA, including the minimum implementation needed to exercise the SDK;
- compatibility reports that identify regressions, required migrations, and recommended release actions.

This turns framework upgrades from reactive customer issues into a proactive compatibility process and helps keep the library continuously buildable, testable, and ready for adoption on current React Native and Expo versions.
