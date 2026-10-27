import type * as PlayerHook from '../player/hooks/useBunnyStreamPlayer';
import type * as SourceIdentity from '../player/sourceIdentity';
import type * as ReactTypes from 'react';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { loadPlaybackSettings } from '../../example/src/storage/playbackSettings';

jest.mock('@react-native-async-storage/async-storage', () => ({}), { virtual: true });
jest.mock(
  '@bunny.net/stream-react-native',
  () => ({
    ...jest.requireActual<typeof PlayerHook>('../player/hooks/useBunnyStreamPlayer'),
    ...jest.requireActual<typeof SourceIdentity>('../player/sourceIdentity'),
    BunnyStreamPlayer: () => null,
    BunnyStreamApi: {},
    getPlaybackSpeeds: async () => [],
    useResumePosition: () => ({}),
  }),
  { virtual: true },
);
jest.mock('../../example/src/storage/playbackSettings', () => ({
  loadPlaybackSettings: jest.fn(async () => ({ autoPlay: true })),
}));
jest.mock('../../example/src/storage/settings', () => ({
  // Leave metadata pending: navigation must not depend on network completion.
  loadLibraryConfig: () => new Promise(() => {}),
}));
jest.mock('../../example/src/storage/resumeSettings', () => ({
  DEFAULT_RESUME_SETTINGS: { enabled: false },
  loadResumeSettings: async () => ({ enabled: false }),
}));
jest.mock('../../example/src/components/ResumeDialog', () => ({ ResumeDialog: () => null }));

const { PlayerScreen } = jest.requireActual<{
  PlayerScreen: ReactTypes.ComponentType<{
    navigation: { goBack: () => void; addListener: (event: string, cb: () => void) => () => void };
    route: { params: { libraryId: number; videoId: string } };
  }>;
}>('../../example/src/features/playback/PlayerScreen');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.mocked(loadPlaybackSettings).mockResolvedValue({ autoPlay: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('example player navigation during loading', () => {
  it.each(['settings', 'video'])('allows going back while %s are loading', async (pending) => {
    if (pending === 'settings') {
      jest.mocked(loadPlaybackSettings).mockImplementationOnce(() => new Promise(() => {}));
    }
    const goBack = jest.fn();
    const view = await render(
      <PlayerScreen
        navigation={{ goBack, addListener: () => () => {} }}
        route={{ params: { libraryId: 123, videoId: 'video-id' } }}
      />,
    );

    const loadingOverlay = view.getByLabelText('Loading video');
    expect(loadingOverlay.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(loadingOverlay.parent?.props.style)).toMatchObject({
      overflow: 'hidden',
    });
    fireEvent.press(view.getByText('‹ Back'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
