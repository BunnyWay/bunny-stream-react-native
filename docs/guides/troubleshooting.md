# Troubleshooting

Start with [Getting started](getting-started.md) and the [capability matrix](capability-matrix.md).
Test on both target platforms: a prop accepted by TypeScript may be platform-specific or ignored.

## Native module or Fabric component is missing

Expo Go and web are unsupported. Use a native development build, enable the New Architecture,
and rebuild after installing/updating the package or changing plugin configuration. On iOS,
install pods before rebuilding. A Metro reload cannot add native modules to an existing binary.

## Android build fails on SDK metadata or desugaring

Check `compileSdk` 36+, Kotlin 2.2.20+, JDK 17, and app-module core library desugaring.
The library's own desugaring setting does not replace the app's setting. With Expo, inspect the
generated Gradle configuration and rebuild after plugin changes.

## iOS fails on `spm_dependency` or a missing IMA framework

The podspec relies on React Native's CocoaPods `spm_dependency` helper. Use a compatible React
Native/CocoaPods setup rather than removing the dependency declaration. A missing
`GoogleInteractiveMediaAds.framework` at runtime means the application target did not embed the
SwiftPM binary. Follow [iOS setup](getting-started.md#2-configure-ios), or regenerate the Expo
project with the plugin and rebuild. Do not add a second incompatible native SDK version manually.

## `MISSING_LIBRARY_ID` or `INVALID_LIBRARY_ID`

Call public `initialize()` before rendering SDK content, or supply a valid source library ID
in addition to initialization. Values must be positive integers, not numeric strings. An invalid
explicit value is rejected even if a valid default exists. Handle `onError` for **both** VOD and
live. Without a handler, configuration failures throw.

An explicit source ID does not bypass native initialization or provide credentials for another
library. See [Getting started](getting-started.md#4-initialize).

## Player is empty or black

Check non-zero component dimensions, successful initialization, the library/media IDs, and whether
the video has finished processing. For protected content, check backend-issued tokens, expiry in
seconds, authorization for the correct ID, and the library's security settings. A working metadata
request alone does not prove CDN playback is authorized. Test unprotected content separately to
isolate configuration from DRM/device failures.

## Live loading indicator never disappears

Live playback does not emit VOD `onReady` or `onProgress`. Read `onLiveStateChange` or the hook's
`state.isLoading`/`state.liveState`, and wire both `onError` and `onLiveError`. `offline`,
`countdown`, and `trailer` are valid states, not necessarily errors.

## Live custom controls do nothing

Ref commands are VOD-only, even when the active live source transitions to its recording.
Use the live native controls for playback/DVR/PiP. Hiding them removes those controls without
adding equivalent JS live commands.

## State belongs to the previous video

Pass a source identity key to `useBunnyStreamPlayer` or remount your screen per media item.
Include explicit/effective library and token identity if those can change. Calling `initialize`
again alone is not a React state update. Avoid simultaneously mounting multiple active VOD players.

## Thumbnails fail with HTTP 403

Use `BunnyImage` or `bunnyImageSource` for recognized Bunny CDN URLs. For custom hostnames,
set the expected Referer header yourself. Check token and access rules too: an image helper
cannot grant authorization. See [Secure playback](secure-playback.md).

## PiP or casting controls are missing

Keep native controls enabled and check the dashboard control settings. Android PiP needs host
activity support and configuration-change handling. iOS PiP needs the audio background mode.
Chromecast requires Google Play services and a compatible receiver on the network. iOS uses
AirPlay, not the Android casting event API. See [PiP and casting](picture-in-picture-and-cast.md).

## Camera preview or broadcast does not start

Grant camera and microphone runtime access **before mounting** the broadcaster; plugin permission
declarations are not grants. Check initialization, credentials, stream state, and a non-zero view
size on a real device. Ended streams cannot restart. On Android keep the native controls visible:
programmatic start relies on their button and does nothing when they are hidden.

## Viewers still see a session after the broadcaster leaves

Stop explicitly before navigating away or backgrounding. Killing the screen/process is not a
reliable server-side stop signal. Use a new stream after ending the previous one.

## Upload pause/resume does nothing

`startUpload` defaults to `basic`. Android basic uploads cannot pause/resume; choose `mode: 'tus'`
for resumable uploads and inspect `pauseSupported` in progress events. Check result envelopes
as well as asynchronous failure events.

## Upload does not recover after relaunch

On Android, use `continueUpload` with the saved library ID, video ID, and original accessible file.
An old `uploadId` is insufficient. On iOS, initialize, subscribe, then call `restoreUploads` for
cached TUS transfers. User force-quit, expired credentials, missing files, and changed server state
can prevent recovery. See [Upload videos](upload-videos.md).

## Upload completed but video is not playable

Completion reports transfer completion. Read the video's processing state and playback readiness
instead of mounting a player immediately. AI/encoding/import requests are also asynchronous jobs.

## API returns `InvalidState` on one platform

Check initialization and the operation's [platform support](capability-matrix.md#management-api).
For example, local VOD thumbnail upload and `smartGenerate` return `InvalidState` on iOS.
Other options can be silently ignored rather than rejected; do not retry an unsupported operation.

## Reporting a problem

Include the package version, React Native/Expo version, platform/device, native build versions,
source type, and a minimal reproduction with error code/kind and HTTP status. Compare behavior
with the [examples](README.md). Remove API keys, playback tokens, stream keys, and personal file
paths from logs before sharing an issue.
