/**
 * Maps raw playback errors to user-facing copy. Native errors arrive as
 * `{ code, message, nativeCode }`; a CDN 403 can mean geo-blocking, referrer
 * protection, or an expired/invalid playback token — the player deliberately
 * does not distinguish them (same as the upstream iOS SDK), so the friendly
 * message names all three causes.
 */

const ACCESS_DENIED_PATTERN = /403|forbidden|access denied|unauthori[sz]ed|not ?available/i;
const NOT_FOUND_PATTERN = /\b404\b|not ?found/i;
// Media3's DRM error family (nativeCode). The Android SDK refuses playback
// up-front when the library's required Widevine level exceeds the device's
// (PR #88); the bridge reports it as ERROR_CODE_DRM_SYSTEM_ERROR, the same
// code the engine uses for genuine DRM failures — both are terminal here.
const DRM_ERROR_PATTERN = /ERROR_CODE_DRM/;

export const ACCESS_DENIED_MESSAGE =
  'Playback refused (403). The video may be geo-restricted, blocked by ' +
  'referrer protection, or the token is expired/invalid.';

export const NOT_FOUND_MESSAGE =
  'Video not found (404). Check that the video ID and library ID are ' +
  'correct — or that the video is public / the configured access key can ' +
  'read it. The play endpoint returns 404 for protected videos fetched ' +
  'without a key.';

export const DRM_ERROR_MESSAGE =
  "This video can't be played on this device. Its DRM protection " +
  'requires a higher device security level (e.g. Widevine L1) than ' +
  'available here, or the license server refused playback.';

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
  return (
    ACCESS_DENIED_PATTERN.test(`${error.nativeCode ?? ''} ${error.message ?? ''}`) ||
    DRM_ERROR_PATTERN.test(error.nativeCode ?? '')
  );
}

/**
 * Friendly copy for access-denied playback errors, or the original message
 * for anything else. Returns null when there is no error.
 */
export function playbackErrorMessage(error: PlayerErrorLike): string | null {
  if (!error) return null;
  const haystack = `${error.nativeCode ?? ''} ${error.message ?? ''}`;
  // Order matters: a refused DRM license carrying an HTTP 403 is still a CDN
  // refusal, so access-denied wins over the generic DRM copy.
  if (ACCESS_DENIED_PATTERN.test(haystack)) {
    return ACCESS_DENIED_MESSAGE;
  }
  if (DRM_ERROR_PATTERN.test(error.nativeCode ?? '')) {
    return DRM_ERROR_MESSAGE;
  }
  if (NOT_FOUND_PATTERN.test(haystack)) {
    return NOT_FOUND_MESSAGE;
  }
  return error.message ?? 'Playback failed';
}

/** Same mapping for live errors, which arrive as a plain message string. */
export function liveErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null;
  return ACCESS_DENIED_PATTERN.test(message) ? ACCESS_DENIED_MESSAGE : message;
}
