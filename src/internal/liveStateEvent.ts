import type { LiveStateChangeEvent } from '../player/BunnyStreamPlayer.types';
import type { LiveStateChangeEvent as NativeLiveStateChangeEvent } from '../specs/BunnyLiveStreamPlayerNativeComponent';

export type NormalizedLiveStateEvent = LiveStateChangeEvent;

export function normalizeLiveStateEvent(
  event: NativeLiveStateChangeEvent,
): NormalizedLiveStateEvent {
  const { reason, targetEpochMs, title, videoId, message, dvrEnabled, ...required } = event;
  return {
    ...required,
    ...(reason && { reason }),
    ...(typeof targetEpochMs === 'number' && targetEpochMs > 0 && { targetEpochMs }),
    ...(title && { title }),
    ...(videoId && { videoId }),
    ...(message && { message }),
    // iOS bridges `dvrEnabled` from the public `LiveStreamRepository` — the
    // SDK's live playback state does not carry it.
    ...(dvrEnabled !== undefined && { dvrEnabled }),
  };
}
