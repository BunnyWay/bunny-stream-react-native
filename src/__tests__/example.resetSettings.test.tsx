import type * as ReactTypes from 'react';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockClearStorage = jest.fn<() => Promise<void>>();
const mockResetSdk = jest.fn<() => Promise<void>>();
const mockResetUploadUi = jest.fn();

jest.mock('@env', () => ({}), { virtual: true });
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }), { virtual: true });
jest.mock('@bunny.net/stream-react-native', () => ({ initialize: jest.fn() }), { virtual: true });
jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({
    __esModule: true,
    default: { clear: mockClearStorage, getItem: async () => null },
  }),
  { virtual: true },
);
jest.mock('../config/initialize', () => ({ resetLocalSdkState: mockResetSdk }));
jest.mock('../../example/src/features/upload/VideoUploadScreen', () => ({
  resetUploadScreenState: mockResetUploadUi,
}));

const { SettingsScreen } = jest.requireActual<{
  SettingsScreen: ReactTypes.ComponentType<{
    navigation: { goBack: () => void };
    onAppReset: () => void;
  }>;
}>('../../example/src/features/settings/SettingsScreen');

beforeEach(() => {
  mockClearStorage.mockReset().mockResolvedValue(undefined);
  mockResetSdk.mockReset().mockResolvedValue(undefined);
  mockResetUploadUi.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function openResetConfirmation() {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const restart = jest.fn();
  const view = await render(
    <SettingsScreen navigation={{ goBack: jest.fn() }} onAppReset={restart} />,
  );
  await fireEvent.press(view.getByText('Reset app data'));
  const buttons = alert.mock.calls[0]?.[2] ?? [];
  return { alert, buttons, restart };
}

describe('example app data reset', () => {
  it('requires confirmation and leaves app data alone when cancelled', async () => {
    const { alert, buttons, restart } = await openResetConfirmation();
    expect(alert.mock.calls[0]?.[0]).toBe('Reset app data?');
    expect(buttons.map((button) => button.style)).toEqual(['cancel', 'destructive']);

    await act(async () => buttons[0]?.onPress?.());
    expect(mockClearStorage).not.toHaveBeenCalled();
    expect(mockResetSdk).not.toHaveBeenCalled();
    expect(restart).not.toHaveBeenCalled();
  });

  it('clears native SDK data, upload screen state, and all storage before restarting', async () => {
    const { buttons, restart } = await openResetConfirmation();
    mockClearStorage.mockImplementation(async () => {
      expect(mockResetSdk).toHaveBeenCalledTimes(1);
      expect(restart).not.toHaveBeenCalled();
    });

    await act(async () => buttons[1]?.onPress?.());
    expect(mockResetUploadUi).toHaveBeenCalledTimes(1);
    expect(mockClearStorage).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('reports a failed reset without restarting', async () => {
    const { alert, buttons, restart } = await openResetConfirmation();
    mockResetSdk.mockRejectedValueOnce(new Error('Storage unavailable'));

    await act(async () => buttons[1]?.onPress?.());
    expect(alert).toHaveBeenLastCalledWith('Could not reset app data', 'Storage unavailable');
    expect(restart).not.toHaveBeenCalled();
  });
});
