import type { LiveStateChangeEvent } from '../BunnyStreamPlayer.types';
import type {
  PlayerEventHandlers,
  PlayerProgress,
  UseBunnyStreamPlayerOptions,
} from '../hooks/useBunnyStreamPlayer.types';
import type { PlayerAction } from './playerReducer';
import type { Dispatch, SetStateAction } from 'react';

interface CurrentOptionsRef {
  current: UseBunnyStreamPlayerOptions | undefined;
}

/**
 * Builds an event handler that unwraps `nativeEvent`, dispatches a reducer
 * action, and forwards the same payload to the matching user callback in
 * `optionsRef.current`. The callback is read at call time so option changes
 * between renders take effect without recreating the handler.
 */
function bindHandler<E>(
  dispatch: Dispatch<PlayerAction>,
  optionsRef: CurrentOptionsRef,
  key: keyof UseBunnyStreamPlayerOptions,
  toAction: (e: E) => PlayerAction,
): (event: { nativeEvent: E }) => void {
  return (event) => {
    const payload = event.nativeEvent;
    dispatch(toAction(payload));
    (optionsRef.current?.[key] as ((p: E) => void) | undefined)?.(payload);
  };
}

/** Builds the `onLiveStateChange` payload, dropping undefined optional fields. */
function buildLiveStatePayload(e: LiveStateChangeEvent) {
  const {
    state: liveState,
    isLive,
    reason,
    targetEpochMs,
    title,
    videoId,
    message,
    dvrEnabled,
  } = e;
  return {
    state: liveState,
    isLive,
    ...(reason !== undefined && { reason }),
    ...(targetEpochMs !== undefined && { targetEpochMs }),
    ...(title !== undefined && { title }),
    ...(videoId !== undefined && { videoId }),
    ...(message !== undefined && { message }),
    ...(dvrEnabled !== undefined && { dvrEnabled }),
  };
}

export function createPlayerEventHandlers(
  dispatch: Dispatch<PlayerAction>,
  setProgress: Dispatch<SetStateAction<PlayerProgress>>,
  optionsRef: CurrentOptionsRef,
): PlayerEventHandlers {
  return {
    onReady: bindHandler(dispatch, optionsRef, 'onReady', (e) => ({
      type: 'READY' as const,
      videoId: e.videoId,
      durationMs: e.durationMs,
    })),
    onPlaybackStateChange: bindHandler(dispatch, optionsRef, 'onPlaybackStateChange', (e) => ({
      type: 'STATE_CHANGE' as const,
      state: e.state,
    })),
    onProgress: (e) => {
      const { positionMs, durationMs, progress: prog } = e.nativeEvent;
      // High-frequency: bypass the reducer entirely.
      setProgress({ positionMs, durationMs, progress: prog });
      optionsRef.current?.onProgress?.({ positionMs, durationMs, progress: prog });
    },
    onError: bindHandler(dispatch, optionsRef, 'onError', (e) => ({
      type: 'ERROR' as const,
      error: { code: e.code, message: e.message, nativeCode: e.nativeCode },
    })),
    onBuffering: bindHandler(dispatch, optionsRef, 'onBuffering', (e) => ({
      type: 'BUFFERING' as const,
      isBuffering: e.isBuffering,
    })),
    onPlay: bindHandler(dispatch, optionsRef, 'onPlay', () => ({ type: 'PLAY' as const })),
    onPause: bindHandler(dispatch, optionsRef, 'onPause', () => ({ type: 'PAUSE' as const })),
    onEnd: bindHandler(dispatch, optionsRef, 'onEnd', () => ({ type: 'END' as const })),
    onVolumeChange: bindHandler(dispatch, optionsRef, 'onVolumeChange', (e) => ({
      type: 'VOLUME' as const,
      volume: e.volume,
      isMuted: e.isMuted,
    })),
    onPlaybackRateChange: bindHandler(dispatch, optionsRef, 'onPlaybackRateChange', (e) => ({
      type: 'PLAYBACK_RATE' as const,
      rate: e.rate,
    })),
    onVideoSizeChange: bindHandler(dispatch, optionsRef, 'onVideoSizeChange', (e) => ({
      type: 'VIDEO_SIZE' as const,
      width: e.width,
      height: e.height,
    })),
    onPlaybackError: bindHandler(dispatch, optionsRef, 'onPlaybackError', (e) => ({
      type: 'PLAYBACK_ERROR' as const,
      message: e.message,
    })),
    onLiveStateChange: (e) => {
      const payload = buildLiveStatePayload(e.nativeEvent);
      dispatch({ type: 'LIVE_STATE', liveState: payload });
      optionsRef.current?.onLiveStateChange?.(payload);
    },
    onLiveError: bindHandler(dispatch, optionsRef, 'onLiveError', (e) => ({
      type: 'LIVE_ERROR' as const,
      message: e.message,
    })),
  };
}
