import * as React from 'react';

/**
 * Bunny CDN requires a `Referer: https://iframe.mediadelivery.net/` header
 * for "Block direct URL file access" (hotlink protection). React Native's
 * `Image` does not reliably pass `headers` to its native image loader on
 * Android (regression tracked in facebook/react-native#25945, fix PR #56905).
 *
 * This hook fetches the image with the required header and returns a
 * `data:` URI that any image component (`Image`, `expo-image`, `FastImage`,
 * etc.) can render as a plain `source={{ uri }}`.
 *
 * Non-Bunny URLs are returned as-is — no fetch overhead.
 *
 * @example
 * const { uri, loading } = useBunnyImage(thumbnailUrl);
 * if (loading) return <Placeholder />;
 * return <Image source={{ uri }} style={...} />;
 */
export interface UseBunnyImageResult {
  /** The resolved URI — a `data:` URI for Bunny CDN URLs, or the original
   * URL for non-Bunny hosts. `undefined` while loading or on error. */
  uri: string | undefined;
  /** `true` while the image is being fetched. */
  loading: boolean;
  /** Set if the fetch failed. */
  error: Error | undefined;
}

/** Referer header value the Bunny CDN hotlink protection expects. */
const BUNNY_REFERER = 'https://iframe.mediadelivery.net/';

function isBunnyCdnUrl(url: string): boolean {
  return url.includes('b-cdn.net') || url.includes('mediadelivery');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resolves a Bunny CDN image URL to a `data:` URI (with the `Referer`
 * header the CDN's hotlink protection requires) so it can be rendered by
 * any React Native image component. Non-Bunny URLs pass through unchanged.
 */
export function useBunnyImage(url: string | undefined | null): UseBunnyImageResult {
  const [state, setState] = React.useState<UseBunnyImageResult>({
    uri: url && !isBunnyCdnUrl(url) ? url : undefined,
    loading: Boolean(url && isBunnyCdnUrl(url)),
    error: undefined,
  });

  React.useEffect(() => {
    if (!url) {
      setState({ uri: undefined, loading: false, error: undefined });
      return;
    }
    // Non-Bunny URLs don't need the Referer header — return as-is.
    if (!isBunnyCdnUrl(url)) {
      setState({ uri: url, loading: false, error: undefined });
      return;
    }
    let cancelled = false;
    setState({ uri: undefined, loading: true, error: undefined });
    (async () => {
      try {
        const res = await fetch(url, { headers: { Referer: BUNNY_REFERER } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const dataUri = await blobToDataUrl(await res.blob());
        if (!cancelled) {
          setState({ uri: dataUri, loading: false, error: undefined });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ uri: undefined, loading: false, error: err as Error });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
