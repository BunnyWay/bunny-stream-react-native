import type { PlayerErrorEvent } from '../player/BunnyStreamPlayer.types';
import type { PlayerErrorEvent as NativePlayerErrorEvent } from '../specs/BunnyStreamPlayerNativeComponent';

/** Fabric represents missing optional scalars as defaults on iOS. */
export function normalizePlayerErrorEvent(event: NativePlayerErrorEvent): PlayerErrorEvent {
  const { category, httpStatus, ...legacy } = event;
  return {
    ...legacy,
    ...(category && {
      category: category === 'unavailable' || category === 'network' ? category : 'unknown',
    }),
    ...(httpStatus !== undefined &&
      Number.isInteger(httpStatus) &&
      httpStatus >= 100 &&
      httpStatus <= 599 && { httpStatus }),
  };
}
