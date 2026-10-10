# Secure playback

Prerequisites: complete [Getting started](getting-started.md), configure the library's security
settings, and provide an authenticated backend that decides who can watch each video or stream.

## Playback tokens are not API credentials

There are separate responsibilities:

- The library API access key authorizes management operations and is required by the current
  wrapper's `initialize(accessKey, libraryId)` contract.
- An embed view token and expiry authorize playback when token authentication is enabled.
- CDN delivery protection is handled by the native player using the playback configuration.

An embed token is not a replacement for the initialization key. The current wrapper has no
token-only initialization or custom management-backend endpoint. Backend token signing protects
the signing secret, but does not by itself solve the wrapper's API-credential requirement.
Review that limitation before distributing a consumer app; do not ship a privileged library key
under the assumption that it becomes secret when supplied through an environment variable.

## Request tokens from your backend

Your backend must authenticate the user, check entitlement to the requested media ID, and issue
a short-lived token with a Unix expiry in **seconds**. Send the result over HTTPS. Keep signing
keys and library management credentials on the server wherever possible, and never log tokens
or stream keys in production telemetry.

The app-facing response can use this shape:

```ts
export type PlaybackAuthorization = {
  token: string;
  expires: number;
};
```

Fetch fresh authorization before mounting protected playback. This guide deliberately leaves
backend authentication and signing implementation to your server integration; neither belongs
in a React component. A short lifetime such as 1–5 minutes is a starting point, not a guarantee
that the same token will cover every later playback request in a long session.

## Pass authorization to the player

After SDK initialization and a successful backend authorization request:

```tsx
import { BunnyStreamPlayer } from '@bunny.net/stream-react-native';

type AuthorizedVideoProps = {
  videoId: string;
  libraryId: number;
  token: string;
  expires: number;
};

export function AuthorizedVideo({ videoId, libraryId, token, expires }: AuthorizedVideoProps) {
  return (
    <BunnyStreamPlayer
      source={{ type: 'vod', videoId, libraryId, token, expires }}
      style={{ width: '100%', aspectRatio: 16 / 9 }}
      onError={({ nativeEvent }) => console.warn(nativeEvent.message)}
    />
  );
}
```

For live playback, use `{ type: 'live', streamId, libraryId, token, expires }` and authorize the
stream ID. Handle both `onError` and `onLiveError`. `fetchVideoPlayData`, `fetchPlayerSettings`,
and `fetchLiveStreamPlayData` also accept token and expiry arguments.

Changing token or expiry remounts the native player. Refresh deliberately rather than signing
or requesting a new token on every render. The wrapper does not automatically fetch tokens
from your backend.

`BunnyStreamApi.generateEmbedToken` and `signPlaybackToken` are **demo/debug helpers only**.
They require the secret on the device. Do not use them as a production authorization flow.

## Protected thumbnails and images

The native player supplies the required headers for its own assets. For images rendered by
your React Native UI, use `BunnyImage`:

```tsx
import { BunnyImage } from '@bunny.net/stream-react-native';

export function VideoThumbnail({ thumbnailUrl }: { thumbnailUrl: string }) {
  return (
    <BunnyImage
      source={{ uri: thumbnailUrl }}
      style={{ width: 240, height: 135 }}
      resizeMode="cover"
    />
  );
}
```

`bunnyImageSource` provides the same source transformation for React Native `Image` or
`ImageBackground`. Recognized Bunny CDN URLs receive `Referer: https://iframe.mediadelivery.net/`.
Custom CDN hostnames are not automatically recognized; provide the required headers explicitly
using `BUNNY_REFERER` if you use one. A Referer header is hotlink protection, not user authorization.

Prefer `BunnyImage` or `bunnyImageSource` over the deprecated `useBunnyImage` hook, which fetches
through JavaScript and creates base64 data URIs instead of using the normal native image cache.

## DRM

The native players support FairPlay on iOS and Widevine on Android when configured for the
library/content. The wrapper does not expose a general-purpose DRM license-server configuration
API. Test protected content on your target devices and casting receivers; DRM playback and
embed-token authorization are separate concerns.

For the native SDK security overviews, see the [Android SDK page](https://bunny.net/docs/stream/android-sdk)
and [iOS SDK page](https://bunny.net/docs/stream/ios-sdk). For wrapper-specific limitations, use
this guide and the guides for [VOD playback](play-a-video.md), [live playback](play-a-live-stream.md),
and [Picture-in-Picture and casting](picture-in-picture-and-cast.md).
