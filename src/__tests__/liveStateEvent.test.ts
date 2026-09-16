import { describe, expect, it } from '@jest/globals';

import { normalizeLiveStateEvent } from '../internal/liveStateEvent';

describe('normalizeLiveStateEvent', () => {
  it('removes Codegen default values from iOS loading events', () => {
    expect(
      normalizeLiveStateEvent({
        state: 'loading',
        isLive: false,
        reason: '',
        targetEpochMs: 0,
        title: '',
        videoId: '',
        message: '',
        dvrEnabled: false,
      }),
    ).toEqual({ state: 'loading', isLive: false, dvrEnabled: false });
  });

  it('preserves a fetched DVR flag on iOS', () => {
    expect(normalizeLiveStateEvent({ state: 'live', isLive: true, dvrEnabled: true })).toEqual({
      state: 'live',
      isLive: true,
      dvrEnabled: true,
    });
  });

  it('preserves metadata exposed by iOS live states', () => {
    expect(
      normalizeLiveStateEvent({
        state: 'trailer',
        isLive: false,
        targetEpochMs: 1_700_000_000_000,
        title: 'Launch',
        videoId: 'video-id',
      }),
    ).toEqual({
      state: 'trailer',
      isLive: false,
      targetEpochMs: 1_700_000_000_000,
      title: 'Launch',
      videoId: 'video-id',
    });
  });

  it('preserves a known false DVR value on Android', () => {
    expect(normalizeLiveStateEvent({ state: 'live', isLive: true, dvrEnabled: false })).toEqual({
      state: 'live',
      isLive: true,
      dvrEnabled: false,
    });
  });

  it('preserves offline and failed messages', () => {
    expect(
      normalizeLiveStateEvent({
        state: 'offline',
        isLive: false,
        reason: 'failed',
        message: 'Playback failed',
      }),
    ).toEqual({
      state: 'offline',
      isLive: false,
      reason: 'failed',
      message: 'Playback failed',
    });
  });
});
