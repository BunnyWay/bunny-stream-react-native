import type { BunnyResult, VideoList } from '../api/types';
import type { Spec } from '../specs/NativeBunnyStreamApi';

import { describe, expect, it, jest } from '@jest/globals';

import { BunnyStreamApi } from '../api/BunnyStreamApi';

// Mock the Codegen TurboModule before importing the wrapper.
// The factory must be self-contained (hoisted above the module scope by Jest),
// so we build the mock object inside it and reach it through `jest.requireMock`.
jest.mock('../specs/NativeBunnyStreamApi', () => {
  const api = {
    isInitialized: jest.fn(),
    listVideos: jest.fn(),
    getVideo: jest.fn(),
    fetchVideoPlayData: jest.fn(),
    createVideo: jest.fn(),
    updateVideo: jest.fn(),
    deleteVideo: jest.fn(),
    listLiveStreams: jest.fn(),
    getLiveStream: jest.fn(),
    fetchLiveStreamPlayData: jest.fn(),
    createLiveStream: jest.fn(),
    updateLiveStream: jest.fn(),
    deleteLiveStream: jest.fn(),
    fetchPlayerSettings: jest.fn(),
  };
  return { __esModule: true, default: api };
});

// Reach the mock instance installed by the factory. Cast to a permissive mock
// shape — the exact return types are `Promise<Object>` in the Codegen spec,
// which TS treats narrowly; for test purposes we only need `mockResolvedValue`
// to accept our BunnyResult envelopes. Using `jest.Mock` with 0-1 type args
// for compatibility across @types/jest versions.
type MockSpec = {
  [K in keyof Spec]: Spec[K] extends (...args: infer A) => infer R
    ? jest.Mock<(...args: A) => R>
    : jest.Mock;
};

const mockApi = (jest.requireMock('../specs/NativeBunnyStreamApi') as { default: unknown })
  .default as unknown as MockSpec;

const okEnvelope = <T>(value: T): BunnyResult<T> => ({ ok: true, value });
const errEnvelope = <T>(message: string): BunnyResult<T> => ({
  ok: false,
  error: { kind: 'Auth', httpStatus: 401, message, isTerminal: true },
});

describe('BunnyStreamApi wrapper', () => {
  it('isInitialized delegates to the TurboModule', () => {
    mockApi.isInitialized.mockReturnValue(true);
    expect(BunnyStreamApi.isInitialized()).toBe(true);
    mockApi.isInitialized.mockReturnValue(false);
    expect(BunnyStreamApi.isInitialized()).toBe(false);
    expect(mockApi.isInitialized).toHaveBeenCalledTimes(2);
  });

  it('listVideos passes defaults when no options are given', async () => {
    const list: VideoList = { totalItems: 0, currentPage: 1, itemsPerPage: 100, items: [] };
    mockApi.listVideos.mockResolvedValue(okEnvelope(list));
    const result = await BunnyStreamApi.listVideos(7);
    expect(mockApi.listVideos).toHaveBeenCalledWith(7, 1, 100, null, null, null);
    expect(result.ok).toBe(true);
  });

  it('listVideos forwards provided options', async () => {
    mockApi.listVideos.mockResolvedValue(
      okEnvelope({ items: [], totalItems: 0, currentPage: 1, itemsPerPage: 10 }),
    );
    await BunnyStreamApi.listVideos(7, {
      page: 2,
      itemsPerPage: 10,
      search: 'cat',
      orderBy: 'title',
      collectionId: 'c1',
    });
    expect(mockApi.listVideos).toHaveBeenCalledWith(7, 2, 10, 'cat', 'title', 'c1');
  });

  it('listLiveStreams forwards nulls for omitted pagination', async () => {
    mockApi.listLiveStreams.mockResolvedValue(
      okEnvelope({ items: [], totalItems: 0, currentPage: 1, itemsPerPage: 50 }),
    );
    await BunnyStreamApi.listLiveStreams(7);
    expect(mockApi.listLiveStreams).toHaveBeenCalledWith(7, null, null, null, null, null);
  });

  it('listLiveStreams forwards provided options', async () => {
    mockApi.listLiveStreams.mockResolvedValue(
      okEnvelope({ items: [], totalItems: 0, currentPage: 1, itemsPerPage: 10 }),
    );
    await BunnyStreamApi.listLiveStreams(7, { page: 3, search: 'news' });
    expect(mockApi.listLiveStreams).toHaveBeenCalledWith(7, 3, null, 'news', null, null);
  });

  it('getVideo forwards libraryId and videoId', async () => {
    mockApi.getVideo.mockResolvedValue(okEnvelope({ id: 'v1', title: 't' }));
    await BunnyStreamApi.getVideo(7, 'v1');
    expect(mockApi.getVideo).toHaveBeenCalledWith(7, 'v1');
  });

  it('fetchVideoPlayData defaults token/expires to null', async () => {
    mockApi.fetchVideoPlayData.mockResolvedValue(okEnvelope({}));
    await BunnyStreamApi.fetchVideoPlayData(7, 'v1');
    expect(mockApi.fetchVideoPlayData).toHaveBeenCalledWith(7, 'v1', null, null);
  });

  it('fetchVideoPlayData forwards token and expires', async () => {
    mockApi.fetchVideoPlayData.mockResolvedValue(okEnvelope({}));
    await BunnyStreamApi.fetchVideoPlayData(7, 'v1', 'tok', 123);
    expect(mockApi.fetchVideoPlayData).toHaveBeenCalledWith(7, 'v1', 'tok', 123);
  });

  it('createVideo forwards the request object', async () => {
    mockApi.createVideo.mockResolvedValue(okEnvelope({ id: 'v2', title: 'new' }));
    await BunnyStreamApi.createVideo(7, { title: 'new' });
    expect(mockApi.createVideo).toHaveBeenCalledWith(7, { title: 'new' });
  });

  it('deleteVideo forwards libraryId and videoId', async () => {
    mockApi.deleteVideo.mockResolvedValue(okEnvelope(null));
    await BunnyStreamApi.deleteVideo(7, 'v1');
    expect(mockApi.deleteVideo).toHaveBeenCalledWith(7, 'v1');
  });

  it('propagates Err envelopes unchanged', async () => {
    mockApi.getVideo.mockResolvedValue(errEnvelope('not found'));
    const result = await BunnyStreamApi.getVideo(7, 'missing');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Auth');
      expect(result.error.message).toBe('not found');
    }
  });

  it('createLiveStream forwards the request', async () => {
    mockApi.createLiveStream.mockResolvedValue(okEnvelope({ id: 's1', title: 'live' }));
    await BunnyStreamApi.createLiveStream(7, { title: 'live', isPublic: true });
    expect(mockApi.createLiveStream).toHaveBeenCalledWith(7, { title: 'live', isPublic: true });
  });

  it('deleteLiveStream forwards libraryId and streamId', async () => {
    mockApi.deleteLiveStream.mockResolvedValue(okEnvelope(null));
    await BunnyStreamApi.deleteLiveStream(7, 's1');
    expect(mockApi.deleteLiveStream).toHaveBeenCalledWith(7, 's1');
  });

  it('fetchPlayerSettings forwards libraryId, videoId, token, expires', async () => {
    mockApi.fetchPlayerSettings.mockResolvedValue(okEnvelope({ thumbnailUrl: 'https://x/t.jpg' }));
    await BunnyStreamApi.fetchPlayerSettings(7, 'v1', 'tok', 99);
    expect(mockApi.fetchPlayerSettings).toHaveBeenCalledWith(7, 'v1', 'tok', 99);
  });

  it('fetchPlayerSettings defaults token/expires to null', async () => {
    mockApi.fetchPlayerSettings.mockResolvedValue(okEnvelope({ thumbnailUrl: '' }));
    await BunnyStreamApi.fetchPlayerSettings(7, 'v1');
    expect(mockApi.fetchPlayerSettings).toHaveBeenCalledWith(7, 'v1', null, null);
  });
});
