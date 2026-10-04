# Go live from the camera

Prerequisites: [initialize the SDK](getting-started.md), create a usable
[live stream](manage-live-streams.md), and grant camera and microphone permissions on a physical
device. The broadcaster does not request permissions for you.

## Permissions

- Android: declare `CAMERA` and `RECORD_AUDIO` and request runtime access with your app's
  permission flow (for example, React Native `PermissionsAndroid`).
- iOS: declare `NSCameraUsageDescription` and `NSMicrophoneUsageDescription`, then request
  runtime access through your app's permission library.
- Expo: the plugin writes the declarations, but runtime requests are still your responsibility.

Do not mount the camera view until both permissions are granted. Handle denial and offer a way
to open app settings. Recheck access when returning from settings.

## Mount the broadcaster

The component's built-in controls start and stop publishing. Its source requires an explicit
library ID, and `accessKey` is a required prop; the player's library fallback does not apply here.
Use credentials/library consistent with the initialized SDK, particularly on Android, which uses
the initialized native instance.

```tsx
import { useEffect, useRef } from 'react';
import { AppState, Button, Text, View } from 'react-native';
import { BunnyStreamBroadcaster } from '@bunny.net/stream-react-native';
import type { BunnyStreamBroadcasterRef } from '@bunny.net/stream-react-native';

type BroadcastScreenProps = {
  accessKey: string;
  libraryId: number;
  streamId: string;
  permissionsGranted: boolean;
};

export function BroadcastScreen({
  accessKey,
  libraryId,
  streamId,
  permissionsGranted,
}: BroadcastScreenProps) {
  const broadcasterRef = useRef<BunnyStreamBroadcasterRef>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') broadcasterRef.current?.stopBroadcast();
    });
    return () => subscription.remove();
  }, []);

  if (!permissionsGranted) return <Text>Camera and microphone access is required.</Text>;

  return (
    <View style={{ flex: 1 }}>
      <BunnyStreamBroadcaster
        ref={broadcasterRef}
        accessKey={accessKey}
        source={{ type: 'live', libraryId, streamId }}
        style={{ flex: 1 }}
        onError={(event) => console.warn(event.message)}
        onReconnectFailed={() => console.warn('Broadcast reconnection failed')}
      />
      <Button title="Stop broadcast" onPress={() => broadcasterRef.current?.stopBroadcast()} />
    </View>
  );
}
```

Broadcasting is foreground-only. Stop when leaving the screen **before** navigation unmounts
the view, as well as when the app becomes inactive/backgrounded. The example handles AppState;
wire your navigator's exit action to the same stop command. Do not rely on process termination
to finish the server-side live session. Ending a stream is final, so explain this to the user
before starting another session.

## Events and controls

Unlike player component events, broadcaster callbacks receive **plain payloads**, not
`{ nativeEvent }` wrappers:

- `onStateChange`: `idle`, `preparing`, or `live`.
- `onElapsedTime`: elapsed milliseconds and a formatted string.
- `onCameraChange` and `onMuteChange`: camera/microphone UI state.
- `onIngestStateChange`: primary/backup connection state.
- `onReconnecting`, `onFailover`, `onReconnectFailed`, and `onError`: recovery and failures.

The ref provides `startBroadcast`, `stopBroadcast`, `switchCamera`, `setMuted`, and `toggleMute`.
Commands return `void`, not a `BunnyResult`; observe events for outcomes.

## Platform limits

- On Android, programmatic start simulates the native start button. Keep
  `hideDefaultControls={false}` (the default). With controls hidden, `startBroadcast` does
  nothing; do not wait for a rejected Promise or an `InvalidState` result. `autoStart` has the
  same visible-controls constraint.
- On iOS, the controller exposes programmatic start, but the bridge does not apply
  `hideDefaultControls` or `source.ingestEndpoint`. Use the built-in UI and native ingest selection.
- The initial `cameraPosition` prop is not applied by either bridge. Use `switchCamera` and
  `onCameraChange` to control and observe the actual camera rather than assuming this prop selected it.
- `quality` is configurable on iOS but ignored on Android, where the native recording SDK
  currently uses fixed quality settings.
- `dualPublish` is Android-only. It publishes to primary and backup simultaneously, increasing
  bandwidth usage. iOS uses single publishing with failover; the prop does not enable dual output.
- Reconnection is bounded. Handle exhausted retries and terminal failures rather than promising
  uninterrupted broadcasting.

## Record to a new VOD

For camera capture that creates a new video, use `source={{ type: 'new', libraryId }}` instead of
a live source. Keep the same permission, credential, and foreground-lifecycle requirements.
Use the video management API to refresh the library afterward; broadcaster events do not expose
the file uploader's `uploadId`/`videoId` event contract. For an existing device file and explicit
TUS controls, use [BunnyStreamUpload](upload-videos.md) instead.

The [broadcaster types](../../src/broadcaster/types.ts) list all props and events; the
[capability matrix](capability-matrix.md) distinguishes accepted props from bridged behavior.
