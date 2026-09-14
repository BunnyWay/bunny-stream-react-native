import * as React from 'react';
import { Image, type ImageProps } from 'react-native';

import { bunnyImageSource } from './bunnyImageSource';

/**
 * `Image` that resolves Bunny CDN thumbnails with the `Referer` header the
 * CDN hotlink protection requires.
 *
 * Uses the platform image pipeline (Fresco on Android, `RCTImageLoader` on
 * iOS) instead of JS `fetch` + base64, so images are natively cached and do
 * not allocate large data URIs — safe for lists. All `Image` props pass
 * through unchanged (`resizeMode`, `defaultSource`, `onError`, …).
 *
 * @example
 * <BunnyImage source={{ uri: video.thumbnailUrl }} style={styles.thumb} />
 * <BunnyImage source={video.thumbnailUrl} style={styles.thumb} />
 */
export const BunnyImage = React.forwardRef<Image, ImageProps & { source?: ImageProps['source'] | string }>(
  ({ source, ...rest }, ref) => (
    <Image ref={ref} source={bunnyImageSource(source)} {...rest} />
  ),
);

BunnyImage.displayName = 'BunnyImage';
