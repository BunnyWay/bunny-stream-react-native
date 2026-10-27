import { describe, expect, it, jest } from '@jest/globals';

type PlayerError = {
  code?: string;
  message?: string;
  nativeCode?: string;
  category?: string;
  httpStatus?: number;
} | null;

const {
  playbackErrorMessage,
  liveErrorMessage,
  isBlockedPlaybackError,
  ACCESS_DENIED_MESSAGE,
  NOT_FOUND_MESSAGE,
  DRM_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  UNAVAILABLE_MESSAGE,
} = jest.requireActual<{
  playbackErrorMessage: (e: PlayerError) => string | null;
  liveErrorMessage: (m: string | null | undefined) => string | null;
  isBlockedPlaybackError: (e: PlayerError) => boolean;
  ACCESS_DENIED_MESSAGE: string;
  NOT_FOUND_MESSAGE: string;
  DRM_ERROR_MESSAGE: string;
  NETWORK_ERROR_MESSAGE: string;
  UNAVAILABLE_MESSAGE: string;
}>('../../example/src/utils/playbackErrors');

describe('playbackErrorMessage', () => {
  it.each([
    { message: 'Source error: Response code: 403' },
    { message: 'Forbidden' },
    { code: 'PLAYBACK_ERROR', message: 'error', nativeCode: 'BunnyError.Auth:403' },
    { message: 'Access denied by CDN' },
    // iOS bridge appends the Swift enum case name to nativeCode for
    // VideoPlayerError — a 403 surfaces as `.notAvailable`.
    { message: 'error', nativeCode: 'BunnyStreamPlayer.VideoPlayerError:2:notAvailable' },
  ])('maps access-denied errors to friendly copy: %o', (error) => {
    expect(playbackErrorMessage(error)).toBe(ACCESS_DENIED_MESSAGE);
  });

  it.each([
    // iOS `VideoPlayerError.notFound` — wrong ID, wrong library, or a
    // protected video fetched without an access key.
    { message: 'error', nativeCode: 'BunnyStreamPlayer.VideoPlayerError:1:notFound' },
    { message: 'Response code: 404' },
  ])('maps not-found errors to actionable copy: %o', (error) => {
    expect(playbackErrorMessage(error)).toBe(NOT_FOUND_MESSAGE);
  });

  it.each([
    // Android: the bridge reports the SDK's pre-load Widevine security-level
    // refusal as this media3 code; the engine uses the same family for real
    // DRM failures.
    {
      code: 'PLAYBACK_ERROR',
      message: "This video can't be played on this device",
      nativeCode: 'ERROR_CODE_DRM_SYSTEM_ERROR',
    },
    { message: 'DRM error', nativeCode: 'ERROR_CODE_DRM_LICENSE_ACQUISITION_FAILED' },
  ])('maps DRM failures to DRM copy: %o', (error) => {
    expect(playbackErrorMessage(error)).toBe(DRM_ERROR_MESSAGE);
  });

  it('keeps a 403 license denial in the access-denied bucket', () => {
    // A refused DRM license carrying an HTTP status still reads as a CDN
    // refusal — access-denied copy is the more accurate one there.
    expect(
      playbackErrorMessage({
        message: 'Response code: 403',
        nativeCode: 'ERROR_CODE_DRM_LICENSE_ACQUISITION_FAILED',
      }),
    ).toBe(ACCESS_DENIED_MESSAGE);
  });

  it.each([
    // Structured classification from the bridge wins over string matching:
    // Android reports the CDN status, a DNS-sinkholed host arrives with no
    // HTTP status at all, and iOS reports the class only.
    { category: 'unavailable', httpStatus: 403, message: 'error' },
    { category: 'unavailable', message: 'Failed to connect to vz-abc.b-cdn.net/127.0.0.1:443' },
    { category: 'unavailable', message: 'Video is not available' },
  ])('maps the structured unavailable category without inventing an HTTP status: %o', (error) => {
    expect(playbackErrorMessage(error)).toBe(UNAVAILABLE_MESSAGE);
  });

  it('maps the structured network category to the retryable copy', () => {
    expect(playbackErrorMessage({ category: 'network', message: 'ERROR_CODE_IO_NETWORK' })).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it('keeps not-found errors retryable', () => {
    expect(
      isBlockedPlaybackError({
        message: 'error',
        nativeCode: 'BunnyStreamPlayer.VideoPlayerError:1:notFound',
      }),
    ).toBe(false);
  });

  it('passes through unrelated errors', () => {
    expect(playbackErrorMessage({ message: 'Network timeout' })).toBe('Network timeout');
  });

  it('returns null for no error', () => {
    expect(playbackErrorMessage(null)).toBeNull();
  });
});

describe('isBlockedPlaybackError', () => {
  it.each([
    { message: 'Source error: Response code: 403' },
    { message: 'Forbidden' },
    { message: 'error', nativeCode: 'BunnyStreamPlayer.VideoPlayerError:2:notAvailable' },
    { message: 'Access denied by CDN' },
    { category: 'unavailable', httpStatus: 403 },
    { category: 'unavailable', message: 'Connection refused' },
  ])('recognises terminal CDN refusals: %o', (error) => {
    expect(isBlockedPlaybackError(error)).toBe(true);
  });

  it.each([
    // Device-level DRM failures are terminal: the security level is a
    // property of the hardware and a retry changes nothing.
    { message: 'refused', nativeCode: 'ERROR_CODE_DRM_SYSTEM_ERROR' },
    { message: 'refused', nativeCode: 'ERROR_CODE_DRM_DISALLOWED_OPERATION' },
  ])('recognises terminal DRM refusals: %o', (error) => {
    expect(isBlockedPlaybackError(error)).toBe(true);
  });

  it.each([
    { message: 'Network timeout' },
    { message: 'Decoder init failed' },
    { category: 'network', message: 'ERROR_CODE_IO_NETWORK_CONNECTION_FAILED' },
    { category: 'unknown', message: 'Decoder init failed' },
    null,
  ])('leaves retryable errors retryable: %o', (error) => {
    expect(isBlockedPlaybackError(error)).toBe(false);
  });
});

describe('liveErrorMessage', () => {
  it('maps a 403 live error', () => {
    expect(liveErrorMessage('HTTP 403')).toBe(ACCESS_DENIED_MESSAGE);
  });
  it('passes through other live errors and nulls', () => {
    expect(liveErrorMessage('Stream ended')).toBe('Stream ended');
    expect(liveErrorMessage(null)).toBeNull();
  });
});
