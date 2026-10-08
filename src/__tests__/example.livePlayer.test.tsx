import type * as LiveStreamModels from '../api/models/liveStream';
import type { BunnyStreamPlayerProps } from '../player/BunnyStreamPlayer.types';
import type * as PlayerHook from '../player/hooks/useBunnyStreamPlayer';
import type * as SourceIdentity from '../player/sourceIdentity';
import type * as ReactTypes from 'react';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

let mockErrorCode = 'MISSING_LIBRARY_ID';

jest.mock(
  '@bunny.net/stream-react-native',
  () => {
    const React = jest.requireActual<typeof ReactTypes>('react');
    const { useBunnyStreamPlayer } = jest.requireActual<typeof PlayerHook>(
      '../player/hooks/useBunnyStreamPlayer',
    );
    const { sourceIdentityKey } = jest.requireActual<typeof SourceIdentity>(
      '../player/sourceIdentity',
    );
    const { LiveStreamStatusEnum, liveStreamStatusLabel } = jest.requireActual<
      typeof LiveStreamModels
    >('../api/models/liveStream');
    return {
      useBunnyStreamPlayer,
      sourceIdentityKey,
      LiveStreamStatusEnum,
      liveStreamStatusLabel,
      BunnyStreamApi: {
        getLiveStream: async () => ({
          ok: true,
          value: {
            id: 'stream-id',
            videoLibraryId: 123,
            status: LiveStreamStatusEnum.RUNNING,
            rtmpOutputs: [],
          },
        }),
      },
      getOrNull: (result: { value: unknown }) => result.value,
      BunnyStreamPlayer: (props: BunnyStreamPlayerProps) => {
        React.useEffect(() => {
          props.onError?.({
            nativeEvent: { code: mockErrorCode, message: 'Invalid library configuration' },
          });
        }, [props.onError]);
        return null;
      },
    };
  },
  { virtual: true },
);
jest.mock('../../example/src/components/Header', () => ({ Header: () => null }));
jest.mock('../../example/src/components/PropertiesCard', () => ({ PropertiesCard: () => null }));
jest.mock('../../example/src/storage/playbackSettings', () => ({
  DEFAULT_PLAYBACK_SETTINGS: { autoPlay: true },
  loadPlaybackSettings: async () => ({ autoPlay: true }),
  savePlaybackSettings: async () => {},
}));

const { LivePlayerScreen } = jest.requireActual<{
  LivePlayerScreen: ReactTypes.ComponentType<{
    navigation: { goBack: () => void; addListener: (event: string, cb: () => void) => () => void };
    route: { params: { libraryId: number; streamId: string } };
  }>;
}>('../../example/src/features/live/LivePlayerScreen');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('live example configuration errors', () => {
  it.each(['MISSING_LIBRARY_ID', 'INVALID_LIBRARY_ID'])(
    'displays %s and stops the loading indicator',
    async (code) => {
      mockErrorCode = code;
      const view = await render(
        <LivePlayerScreen
          navigation={{ goBack: jest.fn(), addListener: jest.fn(() => () => {}) }}
          route={{ params: { libraryId: 123, streamId: 'stream-id' } }}
        />,
      );

      expect(view.getByText('Player error: Invalid library configuration')).toBeTruthy();
      expect(view.queryByLabelText('Loading live stream')).toBeNull();
    },
  );
});
