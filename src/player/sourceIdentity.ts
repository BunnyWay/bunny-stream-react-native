import type { BunnyStreamSource } from './BunnyStreamPlayer.types';

function defaultTo<T, U>(value: T | undefined, fallback: U): T | U {
  return value ?? fallback;
}

/**
 * Builds a stable identity key that remounts the native host when the source
 * type, identifier, library, token, or expiration changes.
 */
export function sourceIdentityKey(source: BunnyStreamSource): string {
  const libraryId = defaultTo(source.libraryId, 0);
  const token = defaultTo(source.token, '');
  const expires = defaultTo(source.expires, '');
  if (source.type === 'live') {
    return `live:${libraryId}:${source.streamId}:${token}:${expires}`;
  }
  return `vod:${libraryId}:${source.videoId}:${token}:${expires}`;
}
