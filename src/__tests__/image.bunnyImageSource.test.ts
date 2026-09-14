import { describe, expect, it } from '@jest/globals';

import {
  BUNNY_REFERER,
  bunnyImageSource,
  isBunnyCdnUrl,
} from '../image/bunnyImageSource';

describe('isBunnyCdnUrl', () => {
  it('detects Bunny CDN hosts', () => {
    expect(isBunnyCdnUrl('https://vz-12345.b-cdn.net/abc/thumbnail.jpg')).toBe(true);
    expect(isBunnyCdnUrl('https://iframe.mediadelivery.net/embed/1/2')).toBe(true);
  });

  it('rejects non-Bunny hosts', () => {
    expect(isBunnyCdnUrl('https://example.com/image.png')).toBe(false);
    expect(isBunnyCdnUrl('file:///local/path.png')).toBe(false);
  });
});

describe('bunnyImageSource', () => {
  it('returns undefined for nullish input', () => {
    expect(bunnyImageSource(null)).toBeUndefined();
    expect(bunnyImageSource(undefined)).toBeUndefined();
  });

  it('injects the Referer header for Bunny CDN URLs', () => {
    const source = bunnyImageSource('https://vz-1.b-cdn.net/thumb.jpg');
    expect(source).toEqual({
      uri: 'https://vz-1.b-cdn.net/thumb.jpg',
      headers: { Referer: BUNNY_REFERER },
    });
  });

  it('passes non-Bunny URLs through without headers', () => {
    const source = bunnyImageSource('https://example.com/a.png');
    expect(source).toEqual({ uri: 'https://example.com/a.png' });
  });

  it('preserves existing headers and merges Referer for Bunny URLs', () => {
    const source = bunnyImageSource({
      uri: 'https://vz-1.b-cdn.net/t.jpg',
      headers: { 'X-Custom': 'yes' },
      cache: 'reload',
    });
    expect(source).toEqual({
      uri: 'https://vz-1.b-cdn.net/t.jpg',
      headers: { 'X-Custom': 'yes', Referer: BUNNY_REFERER },
      cache: 'reload',
    });
  });

  it('passes require() sources through unchanged', () => {
    const source = bunnyImageSource(42);
    expect(source).toBe(42);
  });

  it('maps over source arrays', () => {
    const sources = bunnyImageSource([
      { uri: 'https://vz-1.b-cdn.net/a.jpg' },
      { uri: 'https://example.com/b.jpg' },
    ]);
    expect(sources).toEqual([
      { uri: 'https://vz-1.b-cdn.net/a.jpg', headers: { Referer: BUNNY_REFERER } },
      { uri: 'https://example.com/b.jpg' },
    ]);
  });

  it('passes through a uri-less source object unchanged', () => {
    expect(bunnyImageSource({ width: 10, height: 10 })).toEqual({ width: 10, height: 10 });
  });
});
