import type { LiveStateChangeEvent } from '../specs/BunnyLiveStreamPlayerNativeComponent';

export type NormalizedLiveStateEvent = Pick<LiveStateChangeEvent, 'state' | 'isLive'> &
  Partial<
    Pick<
      LiveStateChangeEvent,
      'reason' | 'targetEpochMs' | 'title' | 'videoId' | 'message' | 'dvrEnabled'
    >
  >;

export function normalizeLiveStateEvent(
  event: LiveStateChangeEvent,
  platform: string,
): NormalizedLiveStateEvent {
  const { reason, targetEpochMs, title, videoId, message, dvrEnabled, ...required } = event;
  return {
    ...required,
    ...(reason && { reason }),
    ...(typeof targetEpochMs === 'number' && targetEpochMs > 0 && { targetEpochMs }),
    ...(title && { title }),
    ...(videoId && { videoId }),
    ...(message && { message }),
    ...(platform !== 'ios' && dvrEnabled !== undefined && { dvrEnabled }),
  };
}
