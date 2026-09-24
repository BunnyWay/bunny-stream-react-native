import type { ImageStyle, StyleProp } from 'react-native';

import * as React from 'react';
import { Image, View } from 'react-native';

import { useBunnyImage } from '@bunny.net/stream-react-native';

/**
 * Thumbnail renderer for Bunny CDN URLs.
 *
 * Bunny CDN hotlink protection rejects image requests without a `Referer`
 * header. React Native's `Image` accepts `source.headers`, but header support
 * in the native image pipelines (Fresco on Android, RCTImageLoader on iOS)
 * proved unreliable for this CDN — thumbnails silently fail and render
 * nothing. The `useBunnyImage` hook fetches through JS instead, where the
 * header is always sent, and returns a `data:` URI that any `Image` renders.
 *
 * Trade-off: the payload is fetched and base64-encoded in JS, bypassing the
 * native image cache — acceptable for a demo list.
 */
export function BunnyThumbnail({
  url,
  style,
  resizeMode = 'cover',
}: {
  url: string | undefined;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}) {
  const { uri } = useBunnyImage(url);

  // Keep the layout box while the JS fetch is in flight (or the URL missing).
  if (!uri) {
    return <View style={style} />;
  }
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;
}
