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

export function createPlayerEventHandlers(
  dispatch: Dispatch<PlayerAction>,
  setProgress: Dispatch<SetStateAction<PlayerProgress>>,
  optionsRef: CurrentOptionsRef,
): PlayerEventHandlers {
  return {
    onReady: (e) => {
      const { videoId, durationMs } = e.nativeEvent;
      dispatch({ type: 'READY', videoId, durationMs });
      optionsRef.current?.onReady?.({ videoId, durationMs });
    },
    onPlaybackStateChange: (e) => {
      const { state: pbState, positionMs } = e.nativeEvent;
      dispatch({ type: 'STATE_CHANGE', state: pbState });
      optionsRef.current?.onPlaybackStateChange?.({ state: pbState, positionMs });
    },
    onProgress: (e) => {
      const { positionMs, durationMs, progress: prog } = e.nativeEvent;
      // High-frequency: bypass the reducer entirely.
      setProgress({ positionMs, durationMs, progress: prog });
      optionsRef.current?.onProgress?.({ positionMs, durationMs, progress: prog });
    },
    onError: (e) => {
      const { code, message, nativeCode } = e.nativeEvent;
      const error = { code, message, nativeCode };
      dispatch({ type: 'ERROR', error });
      optionsRef.current?.onError?.({ code, message, nativeCode });
    },
    onBuffering: (e) => {
      const { isBuffering } = e.nativeEvent;
      dispatch({ type: 'BUFFERING', isBuffering });
      optionsRef.current?.onBuffering?.({ isBuffering });
    },
    onPlay: (e) => {
      const { positionMs, durationMs } = e.nativeEvent;
      dispatch({ type: 'PLAY' });
      optionsRef.current?.onPlay?.({ positionMs, durationMs });
    },
    onPause: (e) => {
      const { positionMs, durationMs } = e.nativeEvent;
      dispatch({ type: 'PAUSE' });
      optionsRef.current?.onPause?.({ positionMs, durationMs });
    },
    onEnd: (e) => {
      const { positionMs, durationMs } = e.nativeEvent;
      dispatch({ type: 'END' });
      optionsRef.current?.onEnd?.({ positionMs, durationMs });
    },
    onVolumeChange: (e) => {
      const { volume, isMuted } = e.nativeEvent;
      dispatch({ type: 'VOLUME', volume, isMuted });
      optionsRef.current?.onVolumeChange?.({ volume, isMuted });
    },
    onPlaybackRateChange: (e) => {
      const { rate } = e.nativeEvent;
      dispatch({ type: 'PLAYBACK_RATE', rate });
      optionsRef.current?.onPlaybackRateChange?.({ rate });
    },
    onVideoSizeChange: (e) => {
      const { width, height } = e.nativeEvent;
      dispatch({ type: 'VIDEO_SIZE', width, height });
      optionsRef.current?.onVideoSizeChange?.({ width, height });
    },
    onPlaybackError: (e) => {
      const { message } = e.nativeEvent;
      dispatch({ type: 'PLAYBACK_ERROR', message });
      optionsRef.current?.onPlaybackError?.({ message });
    },
    onLiveStateChange: (e) => {
      const {
        state: liveState,
        isLive,
        reason,
        targetEpochMs,
        title,
        videoId,
        message,
        dvrEnabled,
      } = e.nativeEvent;
      const payload = {
        state: liveState,
        isLive,
        ...(reason !== undefined && { reason }),
        ...(targetEpochMs !== undefined && { targetEpochMs }),
        ...(title !== undefined && { title }),
        ...(videoId !== undefined && { videoId }),
        ...(message !== undefined && { message }),
        ...(dvrEnabled !== undefined && { dvrEnabled }),
      };
      dispatch({ type: 'LIVE_STATE', liveState: payload });
      optionsRef.current?.onLiveStateChange?.(payload);
    },
    onLiveError: (e) => {
      const { message } = e.nativeEvent;
      dispatch({ type: 'LIVE_ERROR', message });
      optionsRef.current?.onLiveError?.({ message });
    },
  };
}
