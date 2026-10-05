# Introducing Bunny Stream for React Native and Expo: Native video, now in your React apps

Building a mobile app with React Native helps you move quickly. Adding video should feel just as straightforward. But between playback, uploads, device cameras, and live streaming, even a simple idea can turn into a long list of integrations.

**Bunny is here to help!**

When we [introduced the Bunny Stream Mobile SDK](https://bunny.net/blog/introducing-bunny-stream-mobile-sdk-bringing-bunny-stream-to-your-native-ios-and-android-applications/), we made it easier to bring video to native iOS and Android applications. Today, we're bringing that experience to more developers with the **official Bunny Stream React Native SDK, with Expo support**.

Built on our [iOS](https://github.com/BunnyWay/bunny-stream-ios) and [Android](https://github.com/BunnyWay/bunny-stream-android) SDKs, it brings native playback, resumable uploads, camera capture, and live streaming together behind one TypeScript API. You build your app with familiar React components. Bunny Stream handles video encoding, storage, and delivery through our global CDN.

## Save time where it matters

Your next video feature shouldn't mean building separate integrations for every platform. The Bunny Stream React Native SDK connects your shared application code to the native Bunny players and media tools on each device.

### Resumable uploads for unreliable mobile connections

Mobile connections don't always cooperate. With TUS resumable uploads, an interrupted transfer can pick up where it left off instead of sending the whole video again. Progress events and pause, resume, and cancel controls make it easy to build an upload experience that keeps people informed.

Select TUS when starting an upload to enable resumable transfers. See the [upload notes](https://github.com/BunnyWay/bunny-stream-react-native#interrupted-uploads-and-background-behavior) for recovery and platform-specific background behavior.

### Familiar components, native playback

Add on-demand or live video with `BunnyStreamPlayer`. Playback runs through the native media engines on iOS and Android, while typed props, events, and React hooks help you connect the player to the rest of your app.

Player settings from your Bunny Stream dashboard carry through to the native experience, helping you keep your videos consistent with your brand. Captions, audio track selection, and adaptive playback give your audience the controls they expect.

### From camera to content

Let your users create as well as watch. Capture video directly from the device camera for your video library, or use `BunnyStreamBroadcaster` to go live from your app. Camera switching and microphone controls put the essentials within reach.

### More ways to watch

Give viewers room to enjoy their content with fullscreen playback, picture-in-picture, AirPlay on iOS, and Chromecast on Android through the native player controls. For protected content, the SDK brings support for Apple FairPlay and Google Widevine. VAST/IMA ad support also connects your app to Bunny Stream's video monetization features.

For Android TV, an optional native TV player integration brings playback to the big screen with an additional SDK dependency.

## Go live, from the first countdown to the replay

Live video needs more than a play button. Viewers arrive early, join halfway through, lose their connection, and come back after the event has finished. The SDK helps you build an experience around the whole broadcast.

### Set the stage

Create and schedule live streams, add titles and descriptions, and manage thumbnails through the API. Before the broadcast starts, welcome viewers with a countdown or a looping pre-stream trailer selected from your video library. The native player handles these states, giving your audience something to watch while they wait.

### Broadcast from your app

Send live video from the phone's camera over RTMP, with primary and backup ingest support, automatic reconnection, and failover handling. Broadcast and connection events let your app show what's happening as the stream progresses. You can also configure RTMP outputs to forward your stream to additional destinations.

### Help viewers catch up

With DVR enabled, viewers can pause, rewind within the available window, and return to the live action. The player supports both landscape and portrait video, whether you're building a live class, a community broadcast, or an event experience.

When a broadcast ends, streams configured to record can transition to on-demand playback once the recording is ready. Thumbnail fallback and live status updates also help the player handle interruptions along the way.

**One event, from the waiting room to the replay, inside your app.**

## Using Expo? You're invited too.

Using Expo requires **Expo SDK 52+**. The included **Expo config plugin** applies the native project configuration needed by the library during prebuild. Add it to your app configuration and create a development build locally or with EAS Build; Expo Go is not supported because the SDK uses native modules.

The SDK targets iOS and Android and uses React Native's New Architecture. Android requires **API 26+**; the setup guide covers the remaining native build requirements.

Install the package:

```bash
npm install @bunny.net/stream-react-native
```

For Expo projects, add the plugin to your existing app configuration:

```json
{
  "expo": {
    "plugins": ["@bunny.net/stream-react-native"]
  }
}
```

The [repository's setup guide](https://github.com/BunnyWay/bunny-stream-react-native#installation) covers native setup, initialization, and camera and microphone permissions. The plugin supplies default iOS permission messages; customize them through the `cameraPermission` and `microphonePermission` [plugin options](https://github.com/BunnyWay/bunny-stream-react-native/blob/main/plugin/src/types.ts). Example apps for React Native and Expo give you a starting point to explore.

## Just how easy is playback? This easy.

Once you've completed setup and initialized the SDK with your library configuration, adding a video looks like this:

```tsx
import { BunnyStreamPlayer } from '@bunny.net/stream-react-native';

export function VideoScreen() {
  return (
    <BunnyStreamPlayer source={{ type: 'vod', videoId: 'YOUR_VIDEO_ID' }} style={{ flex: 1 }} />
  );
}
```

Showing a live stream uses the same component. Change the source:

```tsx
source={{
  type: 'live',
  streamId: 'YOUR_STREAM_ID',
}}
```

`libraryId` falls back to the library passed to `initialize()` for both VOD and live sources. Provide it explicitly on a source to override the initialized library.

The SDK also gives you typed APIs for managing videos, collections, live streams, captions, reencoding, and AI transcription, so your integration can grow beyond the player as your app grows. Alongside these APIs, `BunnyImage` helps display thumbnails and other Bunny-hosted images with support for CDN hotlink protection. See the [platform notes](https://github.com/BunnyWay/bunny-stream-react-native#platform-differences) for links to operation-specific limitations.

## What will you build?

**Streaming and membership apps:** Bring your video catalog and live premieres into one mobile experience, with protected playback and big-screen viewing options.

**Social and creator platforms:** Let your community capture, upload, and broadcast from their phones, then keep recorded events available for anyone who missed them.

**Education and e-learning:** Combine on-demand lessons with scheduled live classes. DVR helps learners revisit a tricky explanation, while recordings let them catch up later.

## Ready to hop in?

At bunny.net, we believe adding video should leave you more time to build the experiences your audience comes for. With Bunny Stream for React Native and Expo, native video tools are now part of your React workflow.

Explore the [official Bunny Stream React Native SDK on GitHub](https://github.com/BunnyWay/bunny-stream-react-native), try the example apps, and bring your next video idea to life.
