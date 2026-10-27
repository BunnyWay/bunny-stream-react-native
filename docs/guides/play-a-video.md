# Play a video

Prerequisites: complete [Getting started](getting-started.md), initialize successfully, and use a
video that has finished processing. For protected libraries, obtain a [playback token](secure-playback.md).

## Basic playback

```tsx
import { BunnyStreamPlayer } from '@bunny.net/stream-react-native';

export function VideoScreen({ videoId }: { videoId: string }) {
  return (
    <BunnyStreamPlayer
      source={{ type: 'vod', videoId }}
      style={{ width: '100%', aspectRatio: 16 / 9 }}
      onError={({ nativeEvent }) => console.warn(nativeEvent.code, nativeEvent.message)}
    />
  );
}
```

The library ID falls back to `initialize()`. Set `source.libraryId` to override it. The player
needs non-zero layout dimensions. `autoPlay` and `controls` default to `true` for VOD.

Player appearance and available controls follow the library's dashboard settings. React Native
exposes `controls` to show/hide the built-in controls and an iOS-only `watermark` overlay; it does
not expose every native appearance API.

The VOD callbacks `onChaptersUpdated`, `onMomentsUpdated`, and `onRetentionGraphUpdated` are
Android-only; the iOS bridge does not expose these events.

## State and custom controls

Use `useBunnyStreamPlayer` to aggregate events and expose VOD commands:

```tsx
import { Button, Text, View } from 'react-native';
import {
  BunnyStreamPlayer,
  sourceIdentityKey,
  useBunnyStreamPlayer,
} from '@bunny.net/stream-react-native';
import type { BunnyStreamSource } from '@bunny.net/stream-react-native';

export function ControlledVideo({ videoId, libraryId }: { videoId: string; libraryId: number }) {
  const source: BunnyStreamSource = { type: 'vod', videoId, libraryId };
  const player = useBunnyStreamPlayer(undefined, sourceIdentityKey(source));

  return (
    <View>
      <BunnyStreamPlayer
        ref={player.ref}
        source={source}
        controls={false}
        style={{ width: '100%', aspectRatio: 16 / 9 }}
        {...player.eventHandlers}
      />
      <Button
        title={player.state.isPlaying ? 'Pause' : 'Play'}
        onPress={player.state.isPlaying ? player.controls.pause : player.controls.play}
      />
      <Button title="Forward 10 seconds" onPress={() => player.controls.skipForward(10_000)} />
      <Text>{Math.floor(player.progress.positionMs / 1000)} seconds</Text>
      {player.state.error && <Text>{player.state.error.message}</Text>}
    </View>
  );
}
```

Spread `eventHandlers` onto the component and attach `ref`. The hook's option callbacks receive
unwrapped payloads; direct component callbacks receive `{ nativeEvent }`. Add custom hook
callbacks through its options rather than overwriting the spread handlers and losing state updates.
Pass a source key when switching videos. If your app changes the configured library, include the
effective library ID in that key, as the example does.

`BunnyVodPlayerRef` also provides `seekTo`, `skipBackward`, `setVolume`, `setPlaybackRate`,
`mute`, and `unmute`. Times are milliseconds, volume is 0–1, and rate must be positive.
Keep `onProgress` wired when using skip commands so the wrapper knows the current position.
`setVideoQuality` and imperative `enterPiP` are Android-only. Commands do nothing for live sources.

## Handling unavailable videos

The VOD `onError` payload and the hook's `state.error` preserve `code`, `message`,
and `nativeCode`, and add optional `category` and `httpStatus` fields.
`category` is `unavailable`, `network`, or `unknown`. HTTP 403, DNS sinkholes,
and terminal `/play`/settings responses (Android reports 401/403/404/410 there)
are `unavailable`; this does not distinguish geo-blocking from token or referrer
restrictions. `httpStatus` is only present when Android reports a real HTTP
status. iOS and DNS-only refusals leave it absent.

Using `player` from the hook example, render your own loading and error UI even
with `controls={false}`:

```tsx
{!player.state.error && (player.state.isLoading || player.state.isBuffering) && (
  <Text>Loading...</Text>
)}
{player.state.error && (
  <Text>
    {player.state.error.category === 'unavailable'
      ? 'Video is not available'
      : player.state.error.category === 'network'
        ? 'No internet connection. Check your connection and try again.'
        : player.state.error.message}
  </Text>
)}
```

The hook clears loading and buffering when an error arrives. Do not automatically
retry `unavailable`. An explicit user retry may remount the player after the
restriction or token has been corrected; replaying the same refused request in a
loop will not fix it. Pass `sourceIdentityKey(source)` to the hook so a new video
clears the old error. Live failures still use `onLiveError` and are outside this
VOD classification contract.

## Resume positions

On Android, pass `resumeConfig` to opt into native persistence. On iOS, use `useResumePosition`
with an app-provided `ResumePositionStorage` implementation, such as AsyncStorage. The storage
dependency is not installed by the SDK. Forward progress to `savePosition`; the hook does not
subscribe to a player automatically:

```tsx
import {
  BunnyStreamPlayer,
  useBunnyStreamPlayer,
  useResumePosition,
} from '@bunny.net/stream-react-native';
import type { ResumePositionStorage } from '@bunny.net/stream-react-native';

export function ResumableVideo({
  videoId,
  storage,
}: {
  videoId: string;
  storage: ResumePositionStorage;
}) {
  const player = useBunnyStreamPlayer(undefined, videoId);
  const resume = useResumePosition({ videoId, playerRef: player.ref, storage });

  return (
    <BunnyStreamPlayer
      ref={player.ref}
      source={{ type: 'vod', videoId }}
      resumeConfig={{ enableAutoSave: true }}
      style={{ width: '100%', aspectRatio: 16 / 9 }}
      {...player.eventHandlers}
      onProgress={(event) => {
        player.eventHandlers.onProgress(event);
        const { positionMs, durationMs } = event.nativeEvent;
        void resume.savePosition(positionMs, durationMs).catch(console.warn);
      }}
    />
  );
}
```

The JS persistence hook is a no-op on Android. It defaults to seven-day retention, a 30-second
minimum position, a 5% resume threshold, and a 95% near-end threshold. Remount this screen when
switching videos so its stored-position state belongs to one video.
Use `clearResumePosition`, `getAllResumePositions`, and the other
[resume helpers](../../src/player/resumePositions.ts) for a resume library; pass storage on iOS.

## Gotchas

- Only one active VOD player is supported at a time. Unmount inactive players in navigation stacks.
- Changing the source type, media ID, effective library ID, token, or expiry remounts the native
  host. Avoid regenerating playback tokens on every render.
- Upload completion is not encoding completion. Inspect video status/play data before playback.
- See [Handle errors](handle-errors.md) for configuration errors and native playback failures.
