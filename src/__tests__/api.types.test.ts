import { describe, expect, it, jest } from '@jest/globals';

// `api/types.ts` re-exports `BunnyStreamUpload`, which imports the native
// TurboModule. Mock it so the test can import the type-only barrel without
// requiring the native binary.
jest.mock('../specs/NativeBunnyStreamUpload', () => {
  const upload = {
    startUpload: jest.fn(),
    continueUpload: jest.fn(),
    pauseUpload: jest.fn(),
    resumeUpload: jest.fn(),
    cancelUpload: jest.fn(),
    getUploadState: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  return { __esModule: true, default: upload };
});

import {
  LiveStreamStatusEnum,
  TRANSITIONAL_VIDEO_STATUSES,
  VideoStatusEnum,
  errorOrNull,
  fold,
  getOrNull,
  liveStreamStatusLabel,
  map,
  videoStatusLabel,
  type BunnyError,
  type BunnyResult,
} from '../api/types';

describe('BunnyResult helpers', () => {
  const ok: BunnyResult<number> = { ok: true, value: 42 };
  const err: BunnyResult<number> = {
    ok: false,
    error: { kind: 'Auth', httpStatus: 401, message: 'nope', isTerminal: true },
  };

  describe('getOrNull', () => {
    it('returns the value for Ok', () => {
      expect(getOrNull(ok)).toBe(42);
    });
    it('returns null for Err', () => {
      expect(getOrNull(err)).toBeNull();
    });
  });

  describe('errorOrNull', () => {
    it('returns null for Ok', () => {
      expect(errorOrNull(ok)).toBeNull();
    });
    it('returns the error for Err', () => {
      expect(errorOrNull(err)?.kind).toBe('Auth');
    });
  });

  describe('fold', () => {
    it('applies onOk for Ok', () => {
      expect(
        fold(
          ok,
          (v) => v * 2,
          () => -1,
        ),
      ).toBe(84);
    });
    it('applies onErr for Err', () => {
      expect(
        fold(
          err,
          () => -1,
          (e) => e.httpStatus,
        ),
      ).toBe(401);
    });
  });

  describe('map', () => {
    it('transforms Ok value', () => {
      const mapped = map(ok, (v) => v.toString());
      expect(mapped).toEqual({ ok: true, value: '42' });
    });
    it('passes Err through unchanged', () => {
      const mapped = map<number, string>(err, (v) => v.toString());
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error.kind).toBe('Auth');
      }
    });
  });
});

describe('VideoStatusEnum', () => {
  it('maps FINISHED to 4', () => {
    expect(VideoStatusEnum.FINISHED).toBe(4);
  });
  it('maps ERROR to 5', () => {
    expect(VideoStatusEnum.ERROR).toBe(5);
  });
  it('maps UPLOAD_FAILED to 6', () => {
    expect(VideoStatusEnum.UPLOAD_FAILED).toBe(6);
  });
  it('maps JIT_SEGMENTING to 7', () => {
    expect(VideoStatusEnum.JIT_SEGMENTING).toBe(7);
  });
  it('maps JIT_PLAYLISTS_CREATED to 8', () => {
    expect(VideoStatusEnum.JIT_PLAYLISTS_CREATED).toBe(8);
  });
});

describe('TRANSITIONAL_VIDEO_STATUSES', () => {
  it('contains CREATED, UPLOADED, PROCESSING, TRANSCODING, JIT_SEGMENTING', () => {
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.CREATED)).toBe(true);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.UPLOADED)).toBe(true);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.PROCESSING)).toBe(true);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.TRANSCODING)).toBe(true);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.JIT_SEGMENTING)).toBe(true);
  });
  it('does not contain FINISHED, ERROR, UPLOAD_FAILED or JIT_PLAYLISTS_CREATED', () => {
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.FINISHED)).toBe(false);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.ERROR)).toBe(false);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.UPLOAD_FAILED)).toBe(false);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.JIT_PLAYLISTS_CREATED)).toBe(false);
  });
});

describe('LiveStreamStatusEnum', () => {
  it('maps RUNNING to 4', () => {
    expect(LiveStreamStatusEnum.RUNNING).toBe(4);
  });
  it('maps VOD_PROCESSING to 6', () => {
    expect(LiveStreamStatusEnum.VOD_PROCESSING).toBe(6);
  });
});

describe('videoStatusLabel', () => {
  it('returns FINISHED for 4', () => {
    expect(videoStatusLabel(VideoStatusEnum.FINISHED)).toBe('FINISHED');
  });
  it('returns UNKNOWN for an unmapped value', () => {
    expect(videoStatusLabel(99 as never)).toBe('UNKNOWN');
  });
});

describe('liveStreamStatusLabel', () => {
  it('returns RUNNING for 4', () => {
    expect(liveStreamStatusLabel(LiveStreamStatusEnum.RUNNING)).toBe('RUNNING');
  });
  it('returns UNKNOWN for an unmapped value', () => {
    expect(liveStreamStatusLabel(99 as never)).toBe('UNKNOWN');
  });
});

describe('BunnyError shape', () => {
  it('terminal errors have isTerminal=true', () => {
    const auth: BunnyError = { kind: 'Auth', httpStatus: 401, message: 'x', isTerminal: true };
    expect(auth.isTerminal).toBe(true);
  });
  it('transient errors have isTerminal=false', () => {
    const network: BunnyError = { kind: 'Network', httpStatus: 0, message: 'x', isTerminal: false };
    expect(network.isTerminal).toBe(false);
  });
});
