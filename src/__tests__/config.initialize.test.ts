import type * as Initialization from '../config/initialize';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../specs/NativeBunnyStreamPlayer', () => ({
  __esModule: true,
  default: { initialize: jest.fn() },
}));

let configuration: typeof Initialization;
let nativeInitialize: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  configuration = jest.requireActual<typeof Initialization>('../config/initialize');
  nativeInitialize = (
    jest.requireMock('../specs/NativeBunnyStreamPlayer') as {
      default: { initialize: jest.Mock };
    }
  ).default.initialize;
});

describe('initialized library configuration', () => {
  it('is unset before initialization', () => {
    expect(configuration.getConfiguredLibraryId()).toBeUndefined();
  });

  it('stores a successfully initialized library and updates it on reinitialization', () => {
    configuration.initialize('access-key', 123);
    expect(configuration.getConfiguredLibraryId()).toBe(123);
    expect(nativeInitialize).toHaveBeenCalledWith('access-key', 123, '1.0.0');

    configuration.initialize('other-key', 456);
    expect(configuration.getConfiguredLibraryId()).toBe(456);
  });

  it.each([0, -1, 1.5, NaN, Infinity, -Infinity])(
    'does not delegate or replace configuration for invalid ID %s',
    (libraryId) => {
      configuration.initialize('access-key', 123);
      nativeInitialize.mockClear();

      expect(() => configuration.initialize('access-key', libraryId)).toThrow(
        'libraryId must be a positive integer',
      );
      expect(nativeInitialize).not.toHaveBeenCalled();
      expect(configuration.getConfiguredLibraryId()).toBe(123);
    },
  );

  it.each(['', ' ', null, undefined])(
    'treats a blank access key %s as playback-only mode',
    (accessKey) => {
      configuration.initialize(accessKey as string, 456);

      expect(nativeInitialize).toHaveBeenCalledWith('', 456, '1.0.0');
      expect(configuration.getConfiguredLibraryId()).toBe(456);
    },
  );

  it('leaves configuration unset if native initialization fails', () => {
    nativeInitialize.mockImplementationOnce(() => {
      throw new Error('native initialization failed');
    });

    expect(() => configuration.initialize('access-key', 123)).toThrow(
      'native initialization failed',
    );
    expect(configuration.getConfiguredLibraryId()).toBeUndefined();
  });

  it('preserves the last successful configuration if native initialization fails', () => {
    configuration.initialize('access-key', 123);
    nativeInitialize.mockImplementationOnce(() => {
      throw new Error('native initialization failed');
    });

    expect(() => configuration.initialize('other-key', 456)).toThrow(
      'native initialization failed',
    );
    expect(configuration.getConfiguredLibraryId()).toBe(123);
  });
});
