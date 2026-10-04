# Play a live stream

Prerequisites: [initialize the SDK](getting-started.md) and obtain an existing stream ID.
Use the same `BunnyStreamPlayer` component as VOD, but select `type: 'live'`.

```tsx
import { Text, View } from 'react-native';
import { BunnyStreamPlayer, useBunnyStreamPlayer } from '@bunny.net/stream-react-native';

export function LiveScreen({ streamId }: { streamId: string }) {
  const player = useBunnyStreamPlayer(undefined, streamId);

  return (
    <View>
      <BunnyStreamPlayer
        source={{ type: 'live', streamId }}
        style={{ width: '100%', aspectRatio: 16 / 9 }}
        {...player.eventHandlers}
      />
      <Text>{player.state.liveState?.state ?? 'loading'}</Text>
      {player.state.error && <Text>{player.state.error.message}</Text>}
      {player.state.liveError && <Text>{player.state.liveError}</Text>}
    </View>
  );
}
```

`libraryId` is optional and falls back to `initialize()`, just as it does for VOD. Include the
effective library and token identity in the hook's source key if your screen changes those values.

## What the native player handles

- Scheduled countdowns when `enableCountdown` and a future scheduled start are configured.
- A looping pre-stream trailer when the stream references a trailer video.
- Live playback and DVR seeking within the available window when DVR is enabled.
- Transition to the recorded VOD when recording is enabled and the recording is ready.
- Offline/thumbnail states and status polling.

These behaviors depend on server state and the stream configuration. See
[Manage live streams](manage-live-streams.md); displaying a player does not start a broadcast.

## Events and errors

Direct `onLiveStateChange` callbacks receive `{ nativeEvent }` with `state` equal to `loading`,
`offline`, `countdown`, `trailer`, `live`, or `vod`. Fields such as `dvrEnabled`, `targetEpochMs`,
and `videoId` are optional. `targetEpochMs` uses milliseconds, unlike token expiry (seconds).

Native live failures use `onLiveError`. JS configuration failures, including missing or invalid
library IDs, use `onError`. Handle **both**, or spread the hook's `eventHandlers` as above.
The live host does not expose VOD progress, readiness, and playback-state callbacks; use its live
state rather than waiting for `onReady` to dismiss your loading indicator.

## Controls and layout

Keep the built-in controls for DVR, fullscreen, PiP, and platform casting. `controls={false}`
hides that UI. VOD ref commands such as `play`, `pause`, `seekTo`, and `enterPiP` are ignored
for a live source; the wrapper does not expose a live controller, even after transition to VOD.
`autoPlay` is also VOD-only.

For portrait streams, use a portrait layout and react to `onVideoSizeChange` if the dimensions
are not known in advance. Do not force every stream into a landscape frame.

## Protected streams

Pass backend-issued `token` and `expires` on the live source. Authorize the stream ID, not a
different video ID. See [Secure playback](secure-playback.md) for authorization and DRM, and
[Picture-in-Picture and casting](picture-in-picture-and-cast.md) for platform-specific controls.

Live captions are not currently available end to end. Resume-position persistence is a VOD
feature and is not exposed for the live host.
