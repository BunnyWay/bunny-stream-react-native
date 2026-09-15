import type * as PublicApi from '../index';

import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../specs/NativeBunnyStreamPlayer', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    isRunningOnTV: jest.fn(() => false),
    getPlaybackSpeeds: jest.fn(async () => []),
    getAllSavedPositions: jest.fn(async () => '[]'),
    clearSavedPosition: jest.fn(async () => undefined),
    clearAllSavedPositions: jest.fn(async () => undefined),
    exportPositions: jest.fn(async () => '[]'),
    importPositions: jest.fn(async () => false),
    cleanupExpiredPositions: jest.fn(async () => undefined),
  },
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
jest.mock('../specs/BunnyStreamBroadcasterNativeComponent', () => ({
  __esModule: true,
  default: 'BunnyStreamBroadcasterView',
}));

describe('public package API', () => {
  it('exports the intentional runtime surface', () => {
    const publicApi = jest.requireActual<typeof PublicApi>('../index');

    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'BUNNY_REFERER',
        'BunnyImage',
        'BunnyStreamApi',
        'BunnyStreamBroadcaster',
        'BunnyStreamPlayer',
        'BunnyStreamUpload',
        'LiveStreamStatusEnum',
        'NativeBunnyStreamApi',
        'NativeBunnyStreamPlayer',
        'NativeBunnyStreamUpload',
        'TRANSITIONAL_VIDEO_STATUSES',
        'VideoStatusEnum',
        'bunnyImageSource',
        'cleanupExpiredResumePositions',
        'clearAllResumePositions',
        'clearResumePosition',
        'errorOrNull',
        'exportResumePositions',
        'fold',
        'getAllResumePositions',
        'getOrNull',
        'getPlaybackSpeeds',
        'importResumePositions',
        'initialize',
        'isBunnyCdnUrl',
        'isRunningOnTV',
        'liveStreamStatusLabel',
        'map',
        'sourceIdentityKey',
        'useBunnyImage',
        'useBunnyStreamPlayer',
        'useResumePosition',
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
