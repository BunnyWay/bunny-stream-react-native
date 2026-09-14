import type { UseBunnyImageResult } from './types';

import * as React from 'react';

import { BUNNY_REFERER, isBunnyCdnUrl } from './bunnyImageSource';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resolves a Bunny CDN image URL to a `data:` URI with the required `Referer`
 * header so any React Native image component can render it. Non-Bunny URLs pass
 * through unchanged.
 *
 * @deprecated Prefer {@link BunnyImage} or {@link bunnyImageSource} — they use
 * the native image cache and avoid base64 data URIs in lists. This hook fetches
 * through JS and encodes the payload as a `data:` URI.
 *
 * @example
 * const { uri, loading } = useBunnyImage(thumbnailUrl);
 * if (loading) return <Placeholder />;
 * return <Image source={{ uri }} />;
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
    // Non-Bunny URLs do not need the Referer header.
    if (!isBunnyCdnUrl(url)) {
      setState({ uri: url, loading: false, error: undefined });
      return;
    }
    let cancelled = false;
    setState({ uri: undefined, loading: true, error: undefined });
    (async () => {
      try {
        const response = await fetch(url, { headers: { Referer: BUNNY_REFERER } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const dataUri = await blobToDataUrl(await response.blob());
        if (!cancelled) {
          setState({ uri: dataUri, loading: false, error: undefined });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ uri: undefined, loading: false, error: error as Error });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
