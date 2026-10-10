# Upload videos

Prerequisites: [initialize the SDK](getting-started.md), obtain a local file URI, and retain
permission to read it. Use `file://` on iOS; Android also accepts `content://`. The SDK does not
provide a file picker. A temporary picker URI may need copying into app-owned storage or a
persistable Android URI permission before it can be reused after relaunch.

## Start a TUS upload

`startUpload` creates the video record internally. Do not call `createVideo` first for this flow.
Select `mode: 'tus'` explicitly: the default is `basic`.

```ts
import { BunnyStreamUpload } from '@bunny.net/stream-react-native';

export async function uploadVideo(libraryId: number, uri: string) {
  const result = await BunnyStreamUpload.startUpload({
    libraryId,
    uri,
    title: 'My video',
    mode: 'tus',
  });
  if (result.ok) {
    console.log('Upload handle:', result.value.uploadId);
  } else {
    console.warn(result.error.kind, result.error.message);
  }
  return result;
}
```

The result is an upload handle, **not** transfer completion. `collectionId` is optional.
Keep the handle in state that outlives the screen starting the upload.

## Subscribe before starting

Events can arrive before the start call returns. Register a listener at app/upload-manager
scope before starting transfers, and keep it attached while tracking them:

```ts
import { useEffect } from 'react';
import { BunnyStreamUpload } from '@bunny.net/stream-react-native';
import type { UploadEvent } from '@bunny.net/stream-react-native';

export function useUploadEvents(onEvent: (event: UploadEvent) => void) {
  useEffect(() => {
    const unsubscribe = BunnyStreamUpload.addUploadListener(onEvent);
    BunnyStreamUpload.restoreUploads();
    return unsubscribe;
  }, [onEvent]);
}
```

Call this hook only after initialization, with a stable callback. It observes **all** uploads;
route by `event.uploadId` if your app has several. An app-level owner should restore once at
startup, not separately for every screen. Removing a listener stops observation, not the upload.

Events are `started`, `progress`, `paused`, `completed`, `cancelled`, and `failed`. Progress is a
fraction from 0 to 1, with `bytesUploaded`, `totalBytes`, and `pauseSupported`. A failed event
contains `BunnyError` and a nullable `videoId`. Read video IDs from any event that supplies one;
do not rely on seeing `started` after reattaching.

Persist the **library ID, video ID, local URI, and upload mode** for interruption recovery.
The `uploadId` addresses an in-process transfer and is not enough to resume after process death.
`getUploadState(uploadId)` returns a `BunnyResult` containing a snapshot or `null` for an unknown
or evicted handle; it does not restart anything.

## Pause, resume, and cancel

Call `pauseUpload(uploadId)`, `resumeUpload(uploadId)`, or `cancelUpload(uploadId)` in response
to the corresponding UI action. Each returns a `BunnyResult<void>`; check it, as with start:

```ts
import { BunnyStreamUpload } from '@bunny.net/stream-react-native';

export async function pauseTransfer(uploadId: string) {
  const result = await BunnyStreamUpload.pauseUpload(uploadId);
  if (!result.ok) console.warn(result.error.message);
  return result;
}
```

Pause/resume/cancel are supported for TUS on both platforms. Use `pauseSupported` from progress
events to decide whether to show a pause button. Cancellation is not a reversible pause and may
remove the partial server-side video; do not offer it as a way to resume later.

## Continue an interrupted transfer

Use `resumeUpload` for a paused transfer still known to the SDK. Use `continueUpload` for an
interrupted TUS transfer, including Android recovery after relaunch:

```ts
import { BunnyStreamUpload } from '@bunny.net/stream-react-native';

export async function continueTransfer(libraryId: number, videoId: string, uri: string) {
  const result = await BunnyStreamUpload.continueUpload({
    libraryId,
    videoId,
    uri,
    mode: 'tus',
  });
  if (!result.ok) console.warn(result.error.message);
  return result;
}
```

This returns a **new upload handle**. Supply the same file for the existing video, not a new file
with the same name. Do not use `startUpload` to recover an existing transfer: it creates another
video. Retrying depends on file availability, authorization, and server state. Do not assume the
SDK automatically retries as soon as connectivity returns; offer a controlled recovery action.

## Background and process behavior

| Mode               | Android                                                                                                                 | iOS                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Basic              | Pause/resume are no-ops; process death stops the transfer.                                                              | Pause/resume suspend/resume the task; process death stops the transfer.                                              |
| TUS                | Pause/resume/cancel supported. Process death stops the transfer; continue with saved video/file details after relaunch. | Pause/resume/cancel supported. Background URLSession and cached transfers support recovery after system termination. |
| `restoreUploads()` | No-op; use `continueUpload` for TUS recovery.                                                                           | Reattaches to cached TUS transfers after initialization and listener registration.                                   |

On iOS, **user force-quit is different from system termination**: force-quit cancels background
transfers until relaunch. Recovery is not guaranteed if files, credentials, or server state change.
On Android the SDK does not start a foreground upload service. Navigation away from a React
screen is not the same as process death, but a running process is not a background-execution guarantee.
`continueUpload` is not supported for the basic uploader.

## After completion

`completed` means the bytes arrived, not that encoding finished. Read the video with
`BunnyStreamApi.getVideo` and track its status, or inspect playback readiness with
`fetchVideoPlayData`. Use bounded polling and stop on terminal failures; see
[Manage videos](manage-videos.md) and [Handle errors](handle-errors.md).
