import type * as ReactTypes from 'react';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockInitialize = jest.fn<(accessKey: string, libraryId: number) => void>();
const mockVideoListRender = jest.fn();
const mockNavigatorRender = jest.fn();
const mockLoadLibraryConfig =
  jest.fn<() => Promise<{ accessKey: string; libraryId: number | null }>>();
const mockLoadSettings =
  jest.fn<() => Promise<{ accessKey: string | null; libraryId: string } | null>>();
const mockSaveSettings =
  jest.fn<(settings: { accessKey: string | null; libraryId: string }) => Promise<void>>();

jest.mock('@env', () => ({ BUNNY_ACCESS_KEY: 'access-key', BUNNY_LIBRARY_ID: '123' }), {
  virtual: true,
});
jest.mock('@bunny.net/stream-react-native', () => ({ initialize: mockInitialize }), {
  virtual: true,
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }), { virtual: true });
jest.mock(
  'react-native-safe-area-context',
  () => ({
    SafeAreaProvider: ({ children }: ReactTypes.PropsWithChildren) => children,
    initialWindowMetrics: null,
  }),
  { virtual: true },
);
jest.mock('../../example-expo/src/config', () => ({
  BUNNY_ACCESS_KEY: 'access-key',
  BUNNY_LIBRARY_ID: 123,
  isConfigured: true,
}));
jest.mock('../../example-expo/src/screens/PlayerScreen', () => ({ PlayerScreen: () => null }));
jest.mock('../../example-expo/src/screens/VideoListScreen', () => ({
  VideoListScreen: () => {
    mockVideoListRender();
    return null;
  },
}));
jest.mock('../../example/src/navigation/RootNavigator', () => ({
  RootNavigator: () => {
    mockNavigatorRender();
    return null;
  },
}));
jest.mock('../../example/src/components/ScreenWrapper', () => ({
  ScreenWrapper: ({ children }: ReactTypes.PropsWithChildren) => children,
}));
jest.mock('../../example/src/components/Header', () => ({ Header: () => null }));
jest.mock('../../example/src/storage/settings', () => ({
  loadLibraryConfig: mockLoadLibraryConfig,
  loadSettings: mockLoadSettings,
  saveSettings: mockSaveSettings,
}));
jest.mock('../../example/src/storage/playbackSettings', () => ({
  DEFAULT_PLAYBACK_SETTINGS: { autoPlay: true },
  loadPlaybackSettings: async () => ({ autoPlay: true }),
  savePlaybackSettings: async () => {},
}));

const { default: ExpoApp } = jest.requireActual<{ default: ReactTypes.ComponentType }>(
  '../../example-expo/src/App',
);
const { default: NativeApp } = jest.requireActual<{ default: ReactTypes.ComponentType }>(
  '../../example/src/App',
);
const { SettingsScreen } = jest.requireActual<{
  SettingsScreen: ReactTypes.ComponentType<{ navigation: { goBack: () => void } }>;
}>('../../example/src/features/settings/SettingsScreen');
const expoConfig = jest.requireMock('../../example-expo/src/config') as {
  isConfigured: boolean;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInitialize.mockReset();
  mockLoadLibraryConfig.mockReset().mockResolvedValue({ accessKey: 'access-key', libraryId: 123 });
  mockLoadSettings.mockReset().mockResolvedValue(null);
  mockSaveSettings.mockReset().mockResolvedValue(undefined);
  expoConfig.isConfigured = true;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Expo startup', () => {
  it('initializes before mounting the video list', async () => {
    await render(<ExpoApp />);

    expect(mockInitialize).toHaveBeenCalledWith('access-key', 123);
    expect(mockVideoListRender).toHaveBeenCalled();
    expect(mockInitialize.mock.invocationCallOrder[0]).toBeLessThan(
      mockVideoListRender.mock.invocationCallOrder[0]!,
    );
  });

  it('does not mount content or initialize with missing or invalid credentials', async () => {
    expoConfig.isConfigured = false;
    const view = await render(<ExpoApp />);

    expect(view.getByText('Missing or invalid Bunny Stream credentials')).toBeTruthy();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockVideoListRender).not.toHaveBeenCalled();
  });

  it('shows an initialization failure without mounting content', async () => {
    mockInitialize.mockImplementationOnce(() => {
      throw new Error('Native initialization failed');
    });
    const view = await render(<ExpoApp />);

    expect(view.getByText('Bunny Stream initialization failed')).toBeTruthy();
    expect(view.getByText('Native initialization failed')).toBeTruthy();
    expect(mockVideoListRender).not.toHaveBeenCalled();
  });
});

describe('React Native startup', () => {
  it('initializes before mounting navigation', async () => {
    await render(<NativeApp />);

    expect(mockInitialize).toHaveBeenCalledWith('access-key', 123);
    expect(mockNavigatorRender).toHaveBeenCalled();
    expect(mockInitialize.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigatorRender.mock.invocationCallOrder[0]!,
    );
  });

  it('keeps navigation available for configuring a missing library', async () => {
    mockLoadLibraryConfig.mockResolvedValueOnce({ accessKey: '', libraryId: null });
    await render(<NativeApp />);

    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockNavigatorRender).toHaveBeenCalled();
  });

  it('reports native initialization errors and still allows access to settings', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockInitialize.mockImplementationOnce(() => {
      throw new Error('Native initialization failed');
    });
    await render(<NativeApp />);

    expect(alert).toHaveBeenCalledWith('SDK initialization failed', 'Native initialization failed');
    expect(mockNavigatorRender).toHaveBeenCalled();
  });

  it('reports configuration loading errors without leaving the app on the loading screen', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockLoadLibraryConfig.mockRejectedValueOnce(new Error('Configuration loading failed'));
    await render(<NativeApp />);

    expect(alert).toHaveBeenCalledWith('SDK initialization failed', 'Configuration loading failed');
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockNavigatorRender).toHaveBeenCalled();
  });
});

describe('React Native settings', () => {
  it.each(['0', '-1', '1.5', '123abc', 'Infinity', ' '])(
    'does not initialize or save invalid library ID %s',
    async (libraryId) => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const goBack = jest.fn();
      const view = await render(<SettingsScreen navigation={{ goBack }} />);
      await fireEvent.changeText(view.getByPlaceholderText('Enter your Library ID'), libraryId);
      await fireEvent.press(view.getByText('Save'));

      expect(alert).toHaveBeenCalledWith(
        'Invalid input',
        'Please enter a positive integer Library ID.',
      );
      expect(mockInitialize).not.toHaveBeenCalled();
      expect(mockSaveSettings).not.toHaveBeenCalled();
      expect(goBack).not.toHaveBeenCalled();
    },
  );

  it('initializes and saves normalized configuration', async () => {
    const goBack = jest.fn();
    const view = await render(<SettingsScreen navigation={{ goBack }} />);
    await fireEvent.changeText(view.getByPlaceholderText('Enter your Library ID'), '0456');
    await fireEvent.changeText(
      view.getByPlaceholderText('Enter your Library API Key'),
      ' saved-key ',
    );
    await fireEvent.press(view.getByText('Save'));

    expect(mockInitialize).toHaveBeenCalledWith('saved-key', 456);
    expect(mockSaveSettings).toHaveBeenCalledWith({ accessKey: 'saved-key', libraryId: '456' });
    expect(goBack).toHaveBeenCalled();
  });

  it('does not save configuration or leave settings when initialization fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const goBack = jest.fn();
    mockInitialize.mockImplementationOnce(() => {
      throw new Error('Native initialization failed');
    });
    const view = await render(<SettingsScreen navigation={{ goBack }} />);
    await fireEvent.press(view.getByText('Save'));

    expect(alert).toHaveBeenCalledWith('SDK initialization failed', 'Native initialization failed');
    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });
});
