# Handle errors

React Native exposes three different error channels: synchronous configuration validation,
async `BunnyResult` envelopes, and component/upload events. Do not treat them as interchangeable.

## Management and upload results

Async management calls and upload control calls resolve with either `{ ok: true, value }` or
`{ ok: false, error }`. Check the discriminant before reading the payload:

```ts
import { BunnyStreamApi } from '@bunny.net/stream-react-native';

export async function loadVideo(libraryId: number, videoId: string) {
  const result = await BunnyStreamApi.getVideo(libraryId, videoId);
  if (result.ok) return result.value;

  if (result.error.isTerminal) {
    console.warn('Action required:', result.error.message);
  } else {
    console.warn('Request failed; offer a delayed retry:', result.error.message);
  }
  return null;
}
```

`fold(result, onOk, onError)`, `getOrNull`, `errorOrNull`, and `map` are exported helpers.
`isInitialized()` is a synchronous boolean query, not an async management result.

## Error fields and recovery

`BunnyError` contains `kind`, `httpStatus`, `message`, and `isTerminal`. A status of `0` means
there is no usable HTTP response. Use the actual `isTerminal` value, not a guessed retry policy
based only on the message or error kind.

| Kind           | Typical meaning                                                           | Response                                                                |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `Auth`         | Missing, rejected, or unauthorized credentials.                           | Correct authorization; do not retry unchanged credentials indefinitely. |
| `NotFound`     | Missing library, video, or stream.                                        | Refresh resource state and check IDs.                                   |
| `Http`         | Other HTTP failure, including rate limiting or server errors.             | Inspect status and terminal flag; respect retry limits.                 |
| `Network`      | Connection, DNS, timeout, or transport failure.                           | Offer retry with backoff after connectivity recovers.                   |
| `Decode`       | Unexpected response format.                                               | Retain diagnostic context; repeated retries may not solve it.           |
| `LocalFile`    | An upload file cannot be read.                                            | Restore access to the original file or choose a new upload.             |
| `InvalidState` | Missing initialization, unsupported operation, or invalid resource state. | Fix state or use the supported platform/API path.                       |

For transient read failures, use bounded retries with delays. Avoid retrying writes or destructive
operations blindly: a timeout does not prove the server did not apply the first request.
Polling should stop on unmount, backgrounding, terminal failures, or a defined timeout.

## Initialization and player configuration

`initialize()` validates synchronously and can throw. Catch it during startup and keep SDK
components unmounted until configuration succeeds.

Both VOD and live sources resolve `libraryId` from the explicit source or the initialized library:

- No resolved ID: `MISSING_LIBRARY_ID`.
- Invalid explicit/resolved ID: `INVALID_LIBRARY_ID`.

When `onError` is present, the player reports these errors after React commits and does not
mount a native player. Without `onError`, it throws; an Error Boundary can catch it. An invalid
explicit ID does not silently fall back to the configured one. Watermark validation can also
throw for invalid values; `onError` is not a blanket catch for every JavaScript programming error.

## Player callbacks

```tsx
import { BunnyStreamPlayer } from '@bunny.net/stream-react-native';

export function LivePlayerWithErrors({ streamId }: { streamId: string }) {
  return (
    <BunnyStreamPlayer
      source={{ type: 'live', streamId }}
      style={{ width: '100%', aspectRatio: 16 / 9 }}
      onError={({ nativeEvent }) => console.warn(nativeEvent.code, nativeEvent.message)}
      onLiveError={({ nativeEvent }) => console.warn(nativeEvent.message)}
    />
  );
}
```

For VOD, `onError` carries native error codes as well as JS configuration errors;
`onPlaybackError` exposes an additional native playback message. Native live failures use
`onLiveError`, not `onPlaybackError`. Direct callbacks wrap payloads in `nativeEvent`.

`useBunnyStreamPlayer` unwraps these payloads for its option callbacks and tracks `state.error`
and `state.liveError`. Spread its handlers onto the player or those states will not update.
See [Play a live stream](play-a-live-stream.md).

## Upload and broadcaster events

An upload start result only says whether the transfer was started. Later failures arrive as
`UploadEvent` values with `type: 'failed'`, a `BunnyError`, and a nullable `videoId`. Listen for
those events as well as checking `startUpload` and control results. Recovery requires saved
file/video details; see [Upload videos](upload-videos.md).

Broadcaster `onError` receives a plain `{ message }` payload. `onReconnectFailed` means automatic
reconnection was exhausted. Ref commands return `void`; they do not return management envelopes.

These result contracts do not cover failures to load a missing native module, unsupported Expo Go
execution, or arbitrary application exceptions. See [Troubleshooting](troubleshooting.md).
