# Capability matrix

This is the **React Native wrapper** surface, not a promise that every native SDK feature has a
JavaScript equivalent. It follows the [pinned SDK baselines](../../native-sdk-baselines.json).
“Native UI” means the built-in player controls; it does not imply a matching ref command.

## VOD and live playback

| Capability                               | VOD source                          | Live source                                                            |
| ---------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Component                                | `BunnyStreamPlayer`                 | `BunnyStreamPlayer`                                                    |
| Library ID fallback                      | `initialize()` library              | `initialize()` library                                                 |
| Embed token/expiry                       | `source.token`, `source.expires`    | Same, authorized for the stream ID                                     |
| Native playback controls/fullscreen      | Yes                                 | Yes                                                                    |
| `autoPlay` prop                          | Yes                                 | Not forwarded to live host                                             |
| Ref play/pause/seek/volume/rate commands | Yes                                 | Ignored, including after transition to recorded VOD                    |
| Progress/readiness/playback callbacks    | VOD callbacks and hook state        | Use `onLiveStateChange`; no VOD progress/readiness events              |
| Error callbacks                          | `onError`, `onPlaybackError`        | `onError` for JS configuration; `onLiveError` for native live failures |
| DVR seeking/pause                        | Normal VOD timeline                 | Native UI within the available DVR window when enabled                 |
| Countdown/pre-stream trailer             | Not applicable                      | Native player, depending on stream configuration                       |
| Transition to recording                  | Not applicable                      | When recording is enabled and ready                                    |
| Captions                                 | Native player UI                    | Live captions are not currently available end to end                   |
| Resume positions                         | Android native; iOS JS storage hook | Not exposed for the live host                                          |

## Platform-specific playback features

| Capability                        | Android                                            | iOS                                                   |
| --------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Picture-in-Picture                | Native UI for VOD/live; imperative command for VOD | Native UI for VOD/live; imperative command is a no-op |
| Casting                           | Chromecast native UI                               | AirPlay native UI                                     |
| `onPlayerTypeChange`              | VOD only; `default`/`cast`                         | Not emitted                                           |
| DRM                               | Widevine                                           | FairPlay                                              |
| `setVideoQuality`                 | VOD local engine                                   | No-op                                                 |
| `watermark` overlay               | Not rendered                                       | Rendered                                              |
| Chapters/moments/retention events | VOD callbacks exposed                              | Not exposed                                           |
| `resumeConfig`                    | Native VOD persistence                             | Use `useResumePosition` with app-provided storage     |
| `useNativeTvPlayer`               | VOD; optional matching `net.bunny:tv` dependency   | Ignored; no tvOS support                              |
| `BunnyImage` / `bunnyImageSource` | Supported                                          | Supported                                             |

Only one active VOD player is supported. Controls and protected playback also depend on dashboard
configuration, content, device support, and receiver capabilities.

## Management API

| Operation                                                     | Android               | iOS                                                |
| ------------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| Videos/collections CRUD, captions, remote thumbnail selection | Supported             | Supported                                          |
| Import via `fetchNewVideo`                                    | Async server fetch    | Async server fetch                                 |
| `refetchVideo`                                                | Re-downloads source   | Metadata refresh only; request/options ignored     |
| VOD local `uploadThumbnail`                                   | Supported             | `InvalidState`; use `setThumbnail` with a URL      |
| Reencoding/repackaging, rendition listing/deletion            | Supported             | Supported, with flag differences below             |
| `deleteAllResolutions` flag                                   | Supported             | Ignored                                            |
| `fetchVideoStorageSize`                                       | Supported             | `InvalidState`                                     |
| `fetchVideoStatistics`, `fetchVideoHeatmap`                   | Supported             | Supported                                          |
| `fetchVideoHeatmapData`                                       | Supported             | `InvalidState`                                     |
| `smartGenerate`                                               | Supported             | `InvalidState`                                     |
| `transcribeVideo`                                             | Supported             | Supported; chapter/moment generation flags ignored |
| Live CRUD, start/stop, ingest status, thumbnails              | Supported             | Supported                                          |
| `pollLiveStream`                                              | Single status refresh | Delegates to `getLiveStream`                       |

Management feature availability can also depend on library/account settings. Unsupported calls
and ignored fields are different outcomes; a shared TypeScript type is not proof of platform parity.

## Uploads

TUS pause/resume/cancel are supported on both platforms. Android basic pause/resume are no-ops;
iOS basic can suspend/resume a task. Interrupted-transfer continuation requires TUS.

Android uploads stop with the process; recover TUS using saved video/file details and
`continueUpload`. iOS TUS uses background URLSession and cached recovery through `restoreUploads`;
user force-quit is not a guarantee of continued execution. See the full
[upload behavior table](upload-videos.md#background-and-process-behavior).

## Camera publishing

| Capability                                    | Android                                              | iOS                                      |
| --------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| Record new VOD / broadcast to existing stream | Supported                                            | Supported                                |
| Camera/mute commands and state callbacks      | Supported                                            | Supported                                |
| Programmatic start                            | Simulates built-in button; visible controls required | Native controller command                |
| `quality`                                     | Ignored; native fixed settings                       | Configurable                             |
| `dualPublish`                                 | Primary and backup at once                           | Ignored; single publishing with failover |
| Reconnect/failover events                     | Exposed                                              | Exposed                                  |
| Background camera publishing                  | Not supported by this integration                    | Not supported by this integration        |

The initial `cameraPosition` prop is not applied by either bridge; use `switchCamera` and
`onCameraChange`. On iOS, `hideDefaultControls` and `source.ingestEndpoint` are also not applied.
Use the built-in controls and test on each platform. See
[Go live from the camera](go-live-from-the-camera.md#platform-limits).

## Source references

- [Player props and commands](../../src/player/BunnyStreamPlayer.types.ts).
- [Management operations](../../src/api/BunnyStreamApi.ts) and [request options](../../src/api/models/requests.ts).
- [Uploads](../../src/upload/BunnyStreamUpload.ts) and [broadcaster props](../../src/broadcaster/types.ts).
