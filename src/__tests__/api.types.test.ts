import { describe, expect, it } from '@jest/globals';

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
  it('maps UPLOAD_FAILED to 6', () => {
    expect(VideoStatusEnum.UPLOAD_FAILED).toBe(6);
  });
});

describe('TRANSITIONAL_VIDEO_STATUSES', () => {
  it('contains CREATED, UPLOADED, PROCESSING, TRANSCODING', () => {
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.CREATED)).toBe(true);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.UPLOADED)).toBe(true);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.PROCESSING)).toBe(true);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.TRANSCODING)).toBe(true);
  });
  it('does not contain FINISHED or UPLOAD_FAILED', () => {
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.FINISHED)).toBe(false);
    expect(TRANSITIONAL_VIDEO_STATUSES.has(VideoStatusEnum.UPLOAD_FAILED)).toBe(false);
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
