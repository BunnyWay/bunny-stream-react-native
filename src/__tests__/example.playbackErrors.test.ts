import { describe, expect, it, jest } from '@jest/globals';

type PlayerError = { code?: string; message?: string; nativeCode?: string } | null;

const {
  playbackErrorMessage,
  liveErrorMessage,
  isBlockedPlaybackError,
  ACCESS_DENIED_MESSAGE,
  NOT_FOUND_MESSAGE,
} = jest.requireActual<{
  playbackErrorMessage: (e: PlayerError) => string | null;
  liveErrorMessage: (m: string | null | undefined) => string | null;
  isBlockedPlaybackError: (e: PlayerError) => boolean;
  ACCESS_DENIED_MESSAGE: string;
  NOT_FOUND_MESSAGE: string;
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
  ])('recognises terminal CDN refusals: %o', (error) => {
    expect(isBlockedPlaybackError(error)).toBe(true);
  });

  it.each([{ message: 'Network timeout' }, { message: 'Decoder init failed' }, null])(
    'leaves retryable errors retryable: %o',
    (error) => {
      expect(isBlockedPlaybackError(error)).toBe(false);
    },
  );
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
