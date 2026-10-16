/**
 * Maps raw playback errors to user-facing copy. Native errors arrive as
 * `{ code, message, nativeCode }`; a CDN 403 can mean geo-blocking, referrer
 * protection, or an expired/invalid playback token — the player deliberately
 * does not distinguish them (same as the upstream iOS SDK), so the friendly
 * message names all three causes.
 */

const ACCESS_DENIED_PATTERN = /403|forbidden|access denied|unauthori[sz]ed|not ?available/i;
const NOT_FOUND_PATTERN = /\b404\b|not ?found/i;

const ACCESS_DENIED_MESSAGE =
  'Playback refused (403). The video may be geo-restricted, blocked by ' +
  'referrer protection, or the token is expired/invalid.';

const NOT_FOUND_MESSAGE =
  'Video not found (404). Check that the video ID and library ID are ' +
  'correct — or that the video is public / the configured access key can ' +
  'read it. The play endpoint returns 404 for protected videos fetched ' +
  'without a key.';

export const GEO_BLOCK_HINT =
  'If this error persists, the video may be geo-blocked in your region.';

type PlayerErrorLike = {
  code?: string;
  message?: string;
  nativeCode?: string;
} | null;

/**
 * True for terminal CDN refusals — geo-blocking, referrer protection, or an
 * expired/invalid token. Retrying cannot help, so the UI should not offer it
 * (mirrors the iOS SDK's `VideoNotAvailableView`).
 */
export function isBlockedPlaybackError(error: PlayerErrorLike): boolean {
  if (!error) return false;
  return ACCESS_DENIED_PATTERN.test(`${error.nativeCode ?? ''} ${error.message ?? ''}`);
}

/**
 * Friendly copy for access-denied playback errors, or the original message
 * for anything else. Returns null when there is no error.
 */
export function playbackErrorMessage(error: PlayerErrorLike): string | null {
  if (!error) return null;
  if (isBlockedPlaybackError(error)) {
    return ACCESS_DENIED_MESSAGE;
  }
  if (NOT_FOUND_PATTERN.test(`${error.nativeCode ?? ''} ${error.message ?? ''}`)) {
    return NOT_FOUND_MESSAGE;
  }
  return error.message ?? 'Playback failed';
}

/** Same mapping for live errors, which arrive as a plain message string. */
export function liveErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  return ACCESS_DENIED_PATTERN.test(message) ? ACCESS_DENIED_MESSAGE : message;
}
