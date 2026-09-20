# Bunny Stream Mobile SDK — Live Features (updated RN audit)

> Updated against the current wrapper state (branch `sync-public-sdk`,
> Android SDK `4.0.0` from Maven Central, iOS public `main` @ `4158e2e`).
> Original document: `live-features.md` (status as of 2 Sep).
> Statuses cross-checked with `docs/CAPABILITIES.md` — where CAPABILITIES
> reports "partial" due to missing programmatic APIs (cast/AirPlay/PiP/
> fullscreen), this table marks "Supported" because the feature requirement
> concerns playback through the native controls, which works; the difference
> is noted per row.

## Status summary

- **Supported:** 22 of 30 features (incl. #18, #28, #30 delivered entirely by the native SDKs)
- **Inherited:** 3 of 30 features (codec/platform behavior: #2, #3, #23)
- **Partial:** 4 of 30 features (#10, #17, #21, #26)
- **Not supported:** 1 of 30 features (#11)

Key changes since the original audit: the RTMP broadcaster module is
implemented, the live player forwards the full SDK state (countdown, trailer,
DVR, live→VOD), trailers can be configured via `preStreamTrailerVideoId`, and
PiP/AirPlay/Chromecast were verified on the native controls.

## Feature checklist

| # | Feature | Android SDK | iOS SDK | React Native SDK |
| ---: | --- | --- | --- | --- |
| 1 | RTMP live encoding | Finished | Finished | **Supported** — `BunnyStreamBroadcaster`; Android start simulates the native button, iOS native |
| 2 | Live MPEG-DASH playback | Finished | Not supported by AVPlayer | **Inherited** |
| 3 | Live HLS playback | Finished | Finished | **Inherited** |
| 4 | Add live stream flow | Finished | Finished | **Supported** — `createLiveStream` + editor screen |
| 5 | Live stream title | Finished | Finished | **Supported** |
| 6 | Live stream description | Finished | Finished | **Supported** |
| 7 | Scheduling | Finished | Finished | **Supported** — ISO timestamps, no dedicated timezone field (REST parity) |
| 8 | DVR | Finished | Finished | **Supported** — `dvrEnabled` propagated in `onLiveStateChange` |
| 9 | Thumbnail management | Finished | Finished | **Supported** — list/upload/set/delete + picker in example |
| 10 | Pre-stream trailer management | Finished | Finished | **Partial** — `preStreamTrailerVideoId` settable; no trailer asset endpoints (same in native domain APIs) |
| 11 | Watermark management | Waiting for API | Finished | **Not supported** — Android SDK has no watermark API at all; the iOS SDK exposes `PlayerWatermark` but it is not bridged. Align once Android ships an endpoint. |
| 12 | Live stream preview | Finished | Finished | **Supported** — live `BunnyStreamPlayer` is embeddable |
| 13 | Live stream status | Finished | Finished | **Supported** — `getLiveStreamStatus` + `pollLiveStream` |
| 14 | Primary and backup badges | Finished | Finished | **Supported** — `primaryIngestUrl`/`backupIngestUrl` |
| 15 | RTMP ingest details | Finished | Finished | **Supported** |
| 16 | RTMP outputs | Finished | Finished | **Supported** — `rtmpOutputs`, up to 4 in example |
| 17 | Mobile SDK user agent | Finished | Finished | **Partial** — traffic carries the native SDK UA, not an RN one |
| 18 | CMCD v2 statistics | Finished | Finished | **Supported (inherited)** — native players send CMCD automatically |
| 19 | AirPlay | N/A | Finished | **Supported** — native `AVRoutePickerView` in controls, gated by video `controlList`; no programmatic API |
| 20 | Chromecast | Finished | N/A | **Supported** — cast built into SDK 4.0.0, `onPlayerTypeChange` bridged; requires Play Services + a Cast device |
| 21 | Live player UI customization | Requires review | Finished | **Partial** — RN exposes `controls` + `setVideoQuality` (Android); live UI/theming not bridged (backlog) |
| 22 | Portrait/landscape orientation | Finished | Finished | **Supported** |
| 23 | 16:9 / 9:16 playback | Finished | Finished | **Inherited** — `onVideoSizeChange` bridged |
| 24 | Live-to-VOD playback | Finished | Finished | **Supported** — `vod` state in `onLiveStateChange` |
| 25 | Live player countdown | Finished | Finished | **Supported** — native countdown overlay; `countdown` + `targetEpochMs` emitted |
| 26 | Live player watermark | Unsupported | Finished | **Partial** — rendered natively on iOS; Android 4.0.0 has no watermark code in the player |
| 27 | Live player thumbnail | Finished | Finished | **Supported** — native `offline` state shows the thumbnail |
| 28 | Live player pre-stream trailer | Finished | Finished | **Supported (inherited)** — native looping trailer; `trailer` state emitted |
| 29 | Thumbnail fallback logic | Finished | Finished | **Supported** — native fallback on encoder disconnect |
| 30 | Pre-stream trailer precedence | Finished | Finished | **Supported (inherited)** — SDK state resolver prioritizes the trailer |

## Remaining work

1. **Watermark management (#11) and Android live watermark (#26)** — blocked on
   the Android SDK; iOS is ready to bridge once Android catches up.
2. **Trailer asset management (#10)** — no upload/list/delete endpoints for
   trailer assets in the native domain APIs; only `preStreamTrailerVideoId`.
3. **RN user agent (#17)** — needs a public UA configuration point in the
   native SDKs.
4. **Live UI customization (#21)** — expose `PlayerIcons`/`iconSet`/
   `fontFamily`/watermark props (phase 8C, `plans/Audit-public-sdk-alignment.md`).
5. **PiP on Android** — fixed in the example app (`example/android/build.gradle`
   patches the generated manifest with `supportsPictureInPicture` +
   `configChanges`, because RNTA cannot set activity attributes). iOS PiP works
   natively via controls; `enterPiP()` from JS is a no-op — no public SDK API.
6. **Programmatic live controls** (play/pause/seek/jump-to-live) — still blocked
   in both public SDKs (no public live controller).

## Manual verification notes

- **Chromecast**: full test needs a physical device with Play Services plus a
  Chromecast on the network; on an emulator without Play Services the cast
  button is hidden (correct SDK behavior).
- **AirPlay/PiP on iOS**: control buttons appear only when the video's
  `controlList` includes `airplay`/`pip` (player settings in the Bunny
  dashboard); PiP also requires `UIBackgroundModes` = `audio` in Info.plist.
- **Example thumbnails**: `BunnyImage`/`bunnyImageSource` (Referer via
  `source.headers`) proved unreliable in the native image pipelines — the
  example uses `useBunnyImage` (JS fetch + `data:` URI), see
  `example/src/components/BunnyThumbnail.tsx`.
- **Android live speed regression**: `DefaultBunnyPlayer` still restores a saved
  VOD speed on live — the polling workaround in `BunnyLiveStreamPlayerView`
  stays active; to be reported upstream.
