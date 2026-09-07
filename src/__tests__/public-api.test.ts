import type * as PublicApi from '../index';

import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../specs/NativeBunnyStreamPlayer', () => ({
  __esModule: true,
  default: { initialize: jest.fn() },
}));
jest.mock('../specs/NativeBunnyStreamApi', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../specs/BunnyStreamPlayerNativeComponent', () => ({
  __esModule: true,
  default: 'BunnyStreamPlayerView',
  Commands: {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    setVolume: jest.fn(),
    setPlaybackRate: jest.fn(),
    mute: jest.fn(),
    unmute: jest.fn(),
  },
}));
jest.mock('../specs/BunnyLiveStreamPlayerNativeComponent', () => ({
  __esModule: true,
  default: 'BunnyLiveStreamPlayerView',
}));

describe('public package API', () => {
  it('exports the intentional runtime surface', () => {
    const publicApi = jest.requireActual<typeof PublicApi>('../index');

    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'BunnyStreamApi',
        'BunnyStreamPlayer',
        'LiveStreamStatusEnum',
        'NativeBunnyStreamApi',
        'NativeBunnyStreamPlayer',
        'TRANSITIONAL_VIDEO_STATUSES',
        'VideoStatusEnum',
        'errorOrNull',
        'fold',
        'getOrNull',
        'initialize',
        'liveStreamStatusLabel',
        'map',
        'sourceIdentityKey',
        'useBunnyImage',
        'useBunnyStreamPlayer',
        'videoStatusLabel',
      ].sort(),
    );
  });
});
