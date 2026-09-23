import type { BunnyResult } from '../api/result/BunnyResult';
import type { Spec } from '../specs/NativeBunnyStreamUpload';
import type { UploadHandle, UploadState } from '../upload/types';

import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { BunnyStreamUpload } from '../upload/BunnyStreamUpload';

// Mock the Codegen TurboModule before importing the wrapper.
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

type MockSpec = {
  [K in keyof Spec]: Spec[K] extends (...args: infer A) => infer R
    ? jest.Mock<(...args: A) => R>
    : jest.Mock;
};

const mockUpload = (jest.requireMock('../specs/NativeBunnyStreamUpload') as { default: unknown })
  .default as unknown as MockSpec;

const okHandle = (uploadId: string): BunnyResult<UploadHandle> => ({
  ok: true,
  value: { uploadId },
});

const okNull = (): BunnyResult<null> => ({ ok: true, value: null });

const errEnvelope = (message: string): BunnyResult<never> => ({
  ok: false,
  error: {
    kind: 'InvalidState',
    httpStatus: 0,
    message,
    isTerminal: true,
  },
});

describe('BunnyStreamUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startUpload', () => {
    it('delegates to NativeBunnyStreamUpload.startUpload with normalized options', async () => {
      mockUpload.startUpload.mockResolvedValue(okHandle('upload-1'));

      const result = await BunnyStreamUpload.startUpload({
        libraryId: 123,
        uri: 'file:///path/to/video.mp4',
        mode: 'tus',
      });

      expect(mockUpload.startUpload).toHaveBeenCalledWith(
        123,
        'file:///path/to/video.mp4',
        null,
        null,
        'tus',
      );
      expect(result).toEqual(okHandle('upload-1'));
    });

    it('passes title and collectionId when provided', async () => {
      mockUpload.startUpload.mockResolvedValue(okHandle('upload-2'));

      await BunnyStreamUpload.startUpload({
        libraryId: 456,
        uri: 'file:///path/to/video.mp4',
        title: 'My Video',
        collectionId: 'col-1',
        mode: 'basic',
      });

      expect(mockUpload.startUpload).toHaveBeenCalledWith(
        456,
        'file:///path/to/video.mp4',
        'My Video',
        'col-1',
        'basic',
      );
    });

    it('defaults mode to basic when omitted', async () => {
      mockUpload.startUpload.mockResolvedValue(okHandle('upload-3'));

      await BunnyStreamUpload.startUpload({
        libraryId: 789,
        uri: 'file:///path/to/video.mp4',
      });

      expect(mockUpload.startUpload).toHaveBeenCalledWith(
        789,
        'file:///path/to/video.mp4',
        null,
        null,
        'basic',
      );
    });

    it('propagates error envelopes without throwing', async () => {
      mockUpload.startUpload.mockResolvedValue(errEnvelope('Invalid upload URI'));

      const result = await BunnyStreamUpload.startUpload({
        libraryId: 1,
        uri: 'invalid',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Invalid upload URI');
      }
    });
  });

  describe('continueUpload', () => {
    it('delegates to NativeBunnyStreamUpload.continueUpload with videoId', async () => {
      mockUpload.continueUpload.mockResolvedValue(okHandle('upload-4'));

      const result = await BunnyStreamUpload.continueUpload({
        libraryId: 123,
        videoId: 'video-abc',
        uri: 'file:///path/to/video.mp4',
      });

      expect(mockUpload.continueUpload).toHaveBeenCalledWith(
        123,
        'video-abc',
        'file:///path/to/video.mp4',
        'tus',
      );
      expect(result).toEqual(okHandle('upload-4'));
    });

    it('defaults mode to tus for continueUpload', async () => {
      mockUpload.continueUpload.mockResolvedValue(okHandle('upload-5'));

      await BunnyStreamUpload.continueUpload({
        libraryId: 1,
        videoId: 'v1',
        uri: 'file:///path/to/video.mp4',
      });

      expect(mockUpload.continueUpload).toHaveBeenCalledWith(
        1,
        'v1',
        'file:///path/to/video.mp4',
        'tus',
      );
    });
  });

  describe('pauseUpload', () => {
    it('delegates to NativeBunnyStreamUpload.pauseUpload', async () => {
      mockUpload.pauseUpload.mockResolvedValue(okNull());

      const result = await BunnyStreamUpload.pauseUpload('upload-1');

      expect(mockUpload.pauseUpload).toHaveBeenCalledWith('upload-1');
      expect(result.ok).toBe(true);
    });
  });

  describe('resumeUpload', () => {
    it('delegates to NativeBunnyStreamUpload.resumeUpload', async () => {
      mockUpload.resumeUpload.mockResolvedValue(okNull());

      const result = await BunnyStreamUpload.resumeUpload('upload-1');

      expect(mockUpload.resumeUpload).toHaveBeenCalledWith('upload-1');
      expect(result.ok).toBe(true);
    });
  });

  describe('cancelUpload', () => {
    it('delegates to NativeBunnyStreamUpload.cancelUpload', async () => {
      mockUpload.cancelUpload.mockResolvedValue(okNull());

      const result = await BunnyStreamUpload.cancelUpload('upload-1');

      expect(mockUpload.cancelUpload).toHaveBeenCalledWith('upload-1');
      expect(result.ok).toBe(true);
    });
  });

  describe('getUploadState', () => {
    it('delegates to NativeBunnyStreamUpload.getUploadState and returns the state', async () => {
      const state: UploadState = {
        status: 'uploading',
        videoId: 'v1',
        bytesUploaded: 50,
        totalBytes: 100,
        progress: 0.5,
      };
      mockUpload.getUploadState.mockResolvedValue({
        ok: true,
        value: state,
      } as BunnyResult<UploadState | null>);

      const result = await BunnyStreamUpload.getUploadState('upload-1');

      expect(mockUpload.getUploadState).toHaveBeenCalledWith('upload-1');
      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.status).toBe('uploading');
      }
    });

    it('returns null for unknown uploadId', async () => {
      mockUpload.getUploadState.mockResolvedValue(okNull());

      const result = await BunnyStreamUpload.getUploadState('unknown');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('addUploadListener', () => {
    it('subscribes to bunnyStreamUploadEvent and returns an unsubscribe function', () => {
      // The NativeEventEmitter is mocked by React Native's test setup.
      const listener = jest.fn();
      const unsubscribe = BunnyStreamUpload.addUploadListener(listener);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
});
