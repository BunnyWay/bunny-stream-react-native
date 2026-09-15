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
jest.mock('../specs/NativeBunnyStreamUpload', () => ({
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
        'BunnyStreamUpload',
        'LiveStreamStatusEnum',
        'NativeBunnyStreamApi',
        'NativeBunnyStreamPlayer',
        'NativeBunnyStreamUpload',
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

  it('validates initialization before delegating to the native module', () => {
    const publicApi = jest.requireActual<typeof PublicApi>('../index');
    const nativePlayer = (
      jest.requireMock('../specs/NativeBunnyStreamPlayer') as {
        default: { initialize: jest.Mock };
      }
    ).default;
    nativePlayer.initialize.mockClear();

    publicApi.initialize('access-key', 123);
    expect(nativePlayer.initialize).toHaveBeenCalledWith('access-key', 123);
    expect(() => publicApi.initialize('', 123)).toThrow('accessKey must be a non-empty string');
    expect(() => publicApi.initialize('access-key', 0)).toThrow(
      'libraryId must be a positive integer',
    );
    expect(nativePlayer.initialize).toHaveBeenCalledTimes(1);
  });
});
