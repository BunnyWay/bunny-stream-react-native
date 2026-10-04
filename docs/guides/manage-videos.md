# Manage videos and collections

Prerequisites: [initialize the SDK](getting-started.md) with credentials authorized for the
library. All async management methods return `BunnyResult`; inspect `ok` before reading `value`.
Examples below return results to their caller so the UI can handle failures.

## List and read

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export async function findVideos(libraryId: number, search: string) {
  const result = await BunnyStreamApi.listVideos(libraryId, {
    page: 1,
    itemsPerPage: 20,
    search,
    orderBy: 'date',
  });
  if (result.ok) {
    console.log(result.value.items, result.value.totalItems);
  } else {
    console.warn(result.error.message);
  }
  return result;
}
```

Page numbering starts at 1. Use `collectionId` to filter a listing, or `getVideo(libraryId, videoId)`
to fetch one item. A video contains metadata, status, captions, chapters, moments, dimensions,
available resolutions, and encoding progress. Nullable dimensions may not exist before processing.

## Processing and playback readiness

Uploads and imports finish transferring before encoding completes. Use `VideoStatusEnum` and
`videoStatusLabel` rather than hard-coded numbers. `FINISHED` is the normal ready state;
JIT libraries can settle on `JIT_PLAYLISTS_CREATED`. `ERROR` and `UPLOAD_FAILED` need attention.

For your own polling, use `TRANSITIONAL_VIDEO_STATUSES`, a delay between requests, a maximum
wait, and cleanup when the screen leaves. Stop retrying terminal API failures. Polling is not
provided automatically by a management call.

`fetchVideoPlayData(libraryId, videoId, token, expires)` returns playback URLs, player settings,
and readiness fields such as `isPlayable`. `fetchPlayerSettings` also provides a thumbnail URL.
Pass authorization for protected libraries; do not build CDN paths by guessing from filenames.

## Edit metadata

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export function renameVideo(libraryId: number, videoId: string, title: string) {
  return BunnyStreamApi.updateVideo(libraryId, videoId, {
    title,
    chapters: [{ title: 'Introduction', startSeconds: 0, endSeconds: 42 }],
  });
}
```

Unset or null fields are left unchanged; an empty list clears the corresponding list field.
API chapter/moment times use **seconds**, while player events and seek commands use milliseconds.

## Collections

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export async function addVideoToNewCollection(libraryId: number, videoId: string, name: string) {
  const collection = await BunnyStreamApi.createCollection(libraryId, name);
  if (!collection.ok) return collection;
  return BunnyStreamApi.updateVideo(libraryId, videoId, { collectionId: collection.value.id });
}
```

Also available: `listCollections`, `getCollection`, `updateCollection`, and `deleteCollection`.
Listing supports pagination, search, ordering, and optional thumbnails. Creation and video
assignment are separate requests, not a transaction; if assignment fails, the collection remains.

## Thumbnails and captions

- `setThumbnail(libraryId, videoId, thumbnailUrl)` sets a VOD thumbnail from a remote URL on both platforms.
- `uploadThumbnail(libraryId, videoId, uri)` uploads a local VOD thumbnail on Android only;
  iOS returns `InvalidState`. Use a remote URL on iOS. Live thumbnail uploads are a separate,
  cross-platform API.
- Render returned thumbnail URLs with [BunnyImage](secure-playback.md#protected-thumbnails-and-images)
  when hotlink protection applies.

To add captions, base64-encode an SRT or VTT file using your app's file tooling:

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export function addEnglishCaptions(libraryId: number, videoId: string, captionsFileBase64: string) {
  return BunnyStreamApi.addCaption(libraryId, videoId, {
    languageCode: 'en',
    label: 'English',
    captionsFileBase64,
  });
}
```

Use `deleteCaption(libraryId, videoId, languageCode)` to remove a track. Fetch the video's
`captions` metadata to display available tracks.

## Import from a URL

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export function importVideo(libraryId: number, url: string) {
  return BunnyStreamApi.fetchNewVideo({
    libraryId,
    request: { url, title: 'Imported video' },
  });
}
```

The server fetches the URL asynchronously. This call returns `BunnyResult<void>`, not the new
video ID or a completion signal. Refresh the listing to locate the resulting video, then track
its processing state. For device files, use [Upload videos](upload-videos.md).

`refetchVideo` can re-download a source on Android. On iOS it only refreshes metadata through
`getVideo`; it does not replace the media and ignores the refetch options.

## Encoding and storage

- `reencodeVideo(libraryId, videoId)` uses the default codec.
- `reencodeUsingCodec(libraryId, videoId, codec)` accepts `h264`, `vp9`, `hevc`, or `av1`.
- `repackageVideo(libraryId, videoId, keepOriginalFiles)` defaults to keeping originals.
- `fetchVideoResolutions(libraryId, videoId)` lists available renditions.
- `deleteResolutions(options)` removes renditions. Explicitly set `dryRun: true` first; its
  native default is destructive, and deleting the original can prevent later reencoding.

The wrapper's dry-run result is `BunnyResult<void>`; it is not a detailed deletion report.
Inspect available renditions separately and require confirmation before an actual deletion.
`deleteAllResolutions` is ignored on iOS. `fetchVideoStorageSize` is Android-only and returns
`InvalidState` on iOS.

## AI transcription

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export function transcribeVideo(libraryId: number, videoId: string) {
  return BunnyStreamApi.transcribeVideo({
    libraryId,
    videoId,
    request: { targetLanguages: ['en'], generateTitle: true, generateDescription: true },
  });
}
```

Transcription is available on both platforms. `generateChapters` and `generateMoments` in the
transcription request are ignored on iOS. The separate `smartGenerate` operation is Android-only
and returns `InvalidState` on iOS. Acceptance of an AI request is not completion; refresh metadata
later. Availability and processing depend on library/account settings.

## Analytics and deletion

`fetchVideoStatistics` accepts optional video ID, date range, and hourly aggregation.
`fetchVideoHeatmap` returns retention information. The separate `fetchVideoHeatmapData`
(play data enriched with heatmap) is Android-only; iOS returns `InvalidState`.

`deleteVideo(libraryId, videoId)` is irreversible. Require explicit user confirmation and refresh
local state only after checking the result. Avoid automatically replaying destructive requests
after an ambiguous network failure.

See the [management API](../../src/api/BunnyStreamApi.ts), [request types](../../src/api/models/requests.ts),
and [capability matrix](capability-matrix.md) for the full public surface.
