import { describe, expect, it } from '@jest/globals';

import { normalizeLiveStateEvent } from '../internal/liveStateEvent';

describe('normalizeLiveStateEvent', () => {
  it('removes Codegen default values from iOS loading events', () => {
    expect(
      normalizeLiveStateEvent(
        {
          state: 'loading',
          isLive: false,
          reason: '',
          targetEpochMs: 0,
          title: '',
          videoId: '',
          message: '',
          dvrEnabled: false,
        },
        'ios',
      ),
    ).toEqual({ state: 'loading', isLive: false });
  });

  it('preserves metadata exposed by iOS live states', () => {
    expect(
      normalizeLiveStateEvent(
        {
          state: 'trailer',
          isLive: false,
          targetEpochMs: 1_700_000_000_000,
          title: 'Launch',
          videoId: 'video-id',
        },
        'ios',
      ),
    ).toEqual({
      state: 'trailer',
      isLive: false,
      targetEpochMs: 1_700_000_000_000,
      title: 'Launch',
      videoId: 'video-id',
    });
  });

  it('preserves a known false DVR value on Android', () => {
    expect(
      normalizeLiveStateEvent({ state: 'live', isLive: true, dvrEnabled: false }, 'android'),
    ).toEqual({ state: 'live', isLive: true, dvrEnabled: false });
  });

  it('preserves offline and failed messages', () => {
    expect(
      normalizeLiveStateEvent(
        { state: 'offline', isLive: false, reason: 'failed', message: 'Playback failed' },
        'ios',
      ),
    ).toEqual({
      state: 'offline',
      isLive: false,
      reason: 'failed',
      message: 'Playback failed',
    });
  });
});
