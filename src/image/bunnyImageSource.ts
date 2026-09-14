import type { ImageSourcePropType, ImageURISource } from 'react-native';

/** Referer header value the Bunny CDN hotlink protection expects. */
export const BUNNY_REFERER = 'https://iframe.mediadelivery.net/';

export function isBunnyCdnUrl(url: string): boolean {
  return url.includes('b-cdn.net') || url.includes('mediadelivery');
}

function withRefererHeader(source: ImageURISource): ImageURISource {
  if (!source.uri || !isBunnyCdnUrl(source.uri)) return source;
  return { ...source, headers: { ...source.headers, Referer: BUNNY_REFERER } };
}

/**
 * Returns an `Image` source that carries the `Referer` header required by
 * Bunny CDN hotlink protection. Bunny URLs get the header; every other source
 * passes through unchanged, so the result can be fed straight into
 * `Image`/`ImageBackground`.
 *
 * @example
 * <Image source={bunnyImageSource(video.thumbnailUrl)} />
 */
export function bunnyImageSource(
  source: ImageSourcePropType | string | null | undefined,
): ImageSourcePropType | undefined {
  if (source == null) return undefined;
  const raw: ImageSourcePropType = typeof source === 'string' ? { uri: source } : source;
  if (typeof raw === 'number') return raw;
  if (Array.isArray(raw)) return raw.map(withRefererHeader);
  return withRefererHeader(raw);
}
