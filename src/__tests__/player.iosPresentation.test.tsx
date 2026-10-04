import type * as ReactTypes from 'react';

import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { BunnyStreamPlayer, serializeWatermark } from '../player/BunnyStreamPlayer';

const mockVodHost = jest.fn();
const mockLiveHost = jest.fn();

jest.mock('../specs/NativeBunnyStreamPlayer', () => ({
  __esModule: true,
  default: { initialize: jest.fn() },
}));

jest.mock('../specs/BunnyStreamPlayerNativeComponent', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof ReactTypes;
  return {
    __esModule: true,
    default: React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      mockVodHost(props);
      React.useImperativeHandle(ref, () => ({}));
      return null;
    }),
    Commands: {
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      setVolume: jest.fn(),
      setPlaybackRate: jest.fn(),
      mute: jest.fn(),
      unmute: jest.fn(),
      enterPiP: jest.fn(),
      setVideoQuality: jest.fn(),
    },
  };
});

jest.mock('../specs/BunnyLiveStreamPlayerNativeComponent', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof ReactTypes;
  return {
    __esModule: true,
    default: React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      mockLiveHost(props);
      React.useImperativeHandle(ref, () => ({}));
      return null;
    }),
  };
});

describe('iOS player presentation props', () => {
  it('forwards controls=false to VOD and live hosts', async () => {
    await render(
      <BunnyStreamPlayer source={{ type: 'vod', libraryId: 1, videoId: 'vod' }} controls={false} />,
    );
    await render(
      <BunnyStreamPlayer
        source={{ type: 'live', libraryId: 1, streamId: 'live' }}
        controls={false}
      />,
    );

    expect(mockVodHost.mock.calls.at(-1)?.[0]).toMatchObject({ controls: false });
    expect(mockLiveHost.mock.calls.at(-1)?.[0]).toMatchObject({ controls: false });
  });

  it('serializes watermark for both hosts', async () => {
    const watermark = {
      imageUrl: 'https://cdn.example.com/logo.png',
      position: 'bottomTrailing' as const,
      relativeWidth: 0.2,
      opacity: 0.8,
      margin: 8,
    };
    await render(
      <BunnyStreamPlayer
        source={{ type: 'vod', libraryId: 1, videoId: 'vod' }}
        watermark={watermark}
      />,
    );
    await render(
      <BunnyStreamPlayer
        source={{ type: 'live', libraryId: 1, streamId: 'live' }}
        watermark={watermark}
      />,
    );

    expect(mockVodHost.mock.calls.at(-1)?.[0]).toMatchObject({
      watermark: JSON.stringify(watermark),
    });
    expect(mockLiveHost.mock.calls.at(-1)?.[0]).toMatchObject({
      watermark: JSON.stringify(watermark),
    });
  });

  it('rejects invalid watermark values', () => {
    expect(() => serializeWatermark({ imageUrl: 'file:///logo.png' })).toThrow(TypeError);
    expect(() =>
      serializeWatermark({ imageUrl: 'https://cdn.example.com/logo.png', opacity: 2 }),
    ).toThrow(RangeError);
  });

  it('removes the native watermark for null', () => {
    expect(serializeWatermark(null)).toBeUndefined();
  });
});
