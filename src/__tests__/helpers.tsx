import type { UseBunnyStreamPlayerOptions } from '../useBunnyStreamPlayer';

import { act, renderHook } from '@testing-library/react-native';

import { useBunnyStreamPlayer } from '../useBunnyStreamPlayer';

// Convenience: fire a native-event-shaped payload at a handler.
export async function fire<T>(
  handler: ((e: { nativeEvent: T }) => void) | undefined,
  nativeEvent: T,
): Promise<void> {
  await act(() => {
    handler?.({ nativeEvent });
  });
}

// Render the hook with optional initial options.
export async function renderPlayerHook(
  initialOptions?: UseBunnyStreamPlayerOptions,
) {
  return renderHook(
    (opts: UseBunnyStreamPlayerOptions | undefined) =>
      useBunnyStreamPlayer(opts),
    { initialProps: initialOptions },
  );
}
