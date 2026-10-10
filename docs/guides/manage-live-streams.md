# Manage live streams

Prerequisites: [initialize the SDK](getting-started.md) and use credentials authorized for the
library. Management calls return `BunnyResult`; creating a stream does not start a camera or RTMP encoder.

## Create and schedule

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export async function scheduleStream(libraryId: number, scheduledStartTime: string) {
  const result = await BunnyStreamApi.createLiveStream(libraryId, {
    title: 'Live Q&A',
    scheduledStartTime,
    enableCountdown: true,
    dvrEnabled: true,
    dvrWindowSeconds: 1800,
    recordVod: true,
  });
  if (result.ok) {
    console.log('Created stream:', result.value.id);
  } else {
    console.warn(result.error.message);
  }
  return result;
}
```

Supply a future ISO 8601 date including a timezone, such as a value from `Date.toISOString()`.
The API requires a title on creation even though the shared create/update type makes it optional.
The returned stream includes its ID and available ingest information. Treat its stream key as
a credential and avoid logging the complete response.

## Read and update

Use `listLiveStreams(libraryId, options)` for paginated listings and
`getLiveStream(libraryId, streamId)` for a full record. Listing options include `page`,
`itemsPerPage`, `search`, `orderBy`, and `collectionId`.

`updateLiveStream` reuses the create request type. Only supplied, non-null fields are sent:

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export function updateStreamTrailer(libraryId: number, streamId: string, trailerVideoId: string) {
  return BunnyStreamApi.updateLiveStream(libraryId, streamId, {
    preStreamTrailerVideoId: trailerVideoId,
    enableCountdown: true,
  });
}
```

The trailer is an existing video from the library. The native player handles its pre-stream loop.
Countdowns additionally need a scheduled start; setting `enableCountdown` alone is not a schedule.

## Start and stop

The usual lifecycle is created/scheduled → encoder-connected preview → running → ended, with
VOD processing when a recording is being prepared. Use `LiveStreamStatusEnum` or
`liveStreamStatusLabel` rather than raw numeric status codes.

- `startLiveStream(libraryId, streamId)` moves a prepared stream from preview to running.
- `stopLiveStream(libraryId, streamId)` ends the stream. It cannot be restarted; create a new
  stream for the next broadcast.

These are server-side operations, not camera commands. Use them when managing an external
encoder. [BunnyStreamBroadcaster](go-live-from-the-camera.md) manages the camera broadcast
lifecycle itself; avoid independently racing its start/stop with management calls.

## Watch status

`pollLiveStream(libraryId, streamId)` performs **one request**, not a subscription. On iOS it
delegates to `getLiveStream`. `getLiveStreamStatus` provides ingest status.

If your own lobby/admin UI needs polling, delay between requests, avoid overlaps, stop on
unmount/background, and stop retrying terminal errors. The native live player already owns its
playback-status polling; it does not need a duplicate management loop alongside it.

## Thumbnails

- `setLiveStreamThumbnail(libraryId, streamId, thumbnailUrl)` selects a remote image.
- `uploadLiveStreamThumbnail(libraryId, streamId, uri, contentType)` uploads a local image on
  both platforms; content type defaults to `image/jpeg`. Images larger than 20 MB are rejected.
- `listLiveStreamThumbnails(libraryId, streamId, options)` lists generated images, optionally
  constrained by `limit`, `from`, and `to`.
- `deleteLiveStreamThumbnail(libraryId, streamId, restoreLibraryDefault)` removes the selection;
  the final argument defaults to `false`.

Local files use `file://` on both platforms; Android also supports `content://`.

## RTMP outputs

The create/update request accepts `rtmpOutputs`, an array of `{ endpoint, streamKey }` objects
for server-side forwarding to other destinations. Account support and server validation apply;
do not assume every account accepts configured outputs.

These outputs are not the broadcaster's primary/backup ingest endpoints and are not
`dualPublish`. They forward an incoming stream from the service rather than creating additional
camera publishers on the device.

## Delete

`deleteLiveStream(libraryId, streamId)` permanently deletes the stream. Recorded VOD content
remains in the library. Require confirmation and handle the result before removing it from UI state.

See [Play a live stream](play-a-live-stream.md), [Handle errors](handle-errors.md), and the
[live models](../../src/api/models/liveStream.ts).
