# Picture-in-Picture and casting

Prerequisites: a working [VOD](play-a-video.md) or [live](play-a-live-stream.md) player, native
controls enabled, and the corresponding controls enabled in the library's dashboard settings.
Test on devices that support the feature; not every simulator provides system PiP or casting.

## Android Picture-in-Picture

Configure the activity hosting React Native in AndroidManifest.xml. Merge these attributes with
the activity's existing configuration rather than replacing it:

```xml
<activity
    android:name=".MainActivity"
    android:supportsPictureInPicture="true"
    android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode" />
```

The Expo plugin applies this by default. Configuration-change handling prevents the activity
from being recreated during the transition. The native PiP control is available to both VOD
and live playback when supported by the device and enabled in the dashboard.

For VOD only, `BunnyVodPlayerRef.enterPiP()` (also `player.controls.enterPiP()` from the hook)
requests PiP programmatically. The wrapper ignores this command for a live source.

## iOS Picture-in-Picture and AirPlay

Enable the Audio background mode in the app target (`UIBackgroundModes` containing `audio`).
The Expo plugin does this unless `enableBackgroundAudio` is disabled. Use the native player's
PiP and AirPlay controls; the wrapper's imperative `enterPiP()` is a no-op on iOS.
AirPlay state remains internal to the native SDK and does not emit `onPlayerTypeChange`.

Background audio configuration supports playback/PiP. It does not make camera broadcasting
a supported background operation.

## Android Chromecast

The native SDK initializes casting and uses the Bunny Stream receiver. The cast control depends
on dashboard settings, Google Play services, and a compatible receiver on the network. No
additional React Native casting package is required for the native control.

The native SDK supports casting VOD and live playback. The wrapper forwards
`onPlayerTypeChange` for the **VOD host**, with `nativeEvent.playerType` equal to `default` or
`cast`. It does not forward that callback from the live host. Use the native UI for live casting.

Receiver playback chooses its own adaptive quality. Calling VOD `setVideoQuality` adjusts the
local Android engine and takes effect when playback returns to the device, not on the receiver.
Test DRM, captions, audio tracks, and device-to-receiver handover with your own content.

## Android TV

The optional dedicated TV player is not bundled with the wrapper. Add `net.bunny:tv` to the
consumer app's Android dependencies, using the same version as the wrapper's `net.bunny:player`
dependency (currently 4.1.0; see [native-sdk-baselines.json](../../native-sdk-baselines.json)):

```groovy
dependencies {
    implementation "net.bunny:tv:4.1.0"
}
```

Then enable TV detection for a VOD player:

```tsx
import { BunnyStreamPlayer } from '@bunny.net/stream-react-native';

export function TvAwareVideo({ videoId }: { videoId: string }) {
  return (
    <BunnyStreamPlayer
      source={{ type: 'vod', videoId }}
      useNativeTvPlayer
      style={{ width: '100%', aspectRatio: 16 / 9 }}
    />
  );
}
```

On Android TV, this can launch the SDK's dedicated activity; otherwise it falls back to embedded
playback. The prop is VOD-only in the wrapper and ignored on iOS; it is not tvOS support.
Adding a dependency does not turn an ordinary Expo or React Native app into a complete TV app:
the host still needs suitable TV navigation and native project configuration. Rebuild after
adding the dependency.
