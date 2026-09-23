import type { PlayerState } from '../hooks/useBunnyStreamPlayer.types';

import { DEFAULT_PLAYER_STATE } from './playerState';

// --- Reducer ---

export type PlayerAction =
  | { type: 'READY'; videoId: string; durationMs: number }
  | { type: 'STATE_CHANGE'; state: string }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'END' }
  | { type: 'BUFFERING'; isBuffering: boolean }
  | { type: 'ERROR'; error: { code: string; message: string; nativeCode?: string } }
  | { type: 'VOLUME'; volume: number; isMuted: boolean }
  | { type: 'PLAYBACK_RATE'; rate: number }
  | { type: 'VIDEO_SIZE'; width: number; height: number }
  | { type: 'PLAYBACK_ERROR'; message: string }
  | {
      type: 'LIVE_STATE';
      liveState: PlayerState['liveState'];
    }
  | { type: 'LIVE_ERROR'; message: string }
  | { type: 'RESET' };

type ActionHandler<K extends PlayerAction['type']> = (
  state: PlayerState,
  action: Extract<PlayerAction, { type: K }>,
) => PlayerState;

type HandlerMap = { [K in PlayerAction['type']]: ActionHandler<K> };

const handlers: HandlerMap = {
  READY: (state, action) => {
    // Auto-reset when the videoId changes: zero out stale fields first so
    // no leftover error/buffering/position/videoSize lingers between sources.
    if (state.videoId !== null && state.videoId !== action.videoId) {
      return {
        ...DEFAULT_PLAYER_STATE,
        videoId: action.videoId,
        durationMs: action.durationMs,
        playbackState: 'ready',
        isLoading: false,
      };
    }
    return {
      ...state,
      playbackState: 'ready',
      durationMs: action.durationMs,
      videoId: action.videoId,
      error: null,
      isLoading: false,
    };
  },
  STATE_CHANGE: (state, action) => {
    // Idempotent: skip if the state string is already the current value.
    // The native state machine emits both `onPlay` and
    // `onPlaybackStateChange('playing')` for the same transition.
    if (state.playbackState === action.state) {
      return state;
    }
    return { ...state, playbackState: action.state as PlayerState['playbackState'] };
  },
  PLAY: (state) => {
    if (state.isPlaying && state.playbackState === 'playing') {
      return state;
    }
    return { ...state, isPlaying: true, playbackState: 'playing', error: null };
  },
  PAUSE: (state) => {
    if (!state.isPlaying && state.playbackState === 'paused') {
      return state;
    }
    return { ...state, isPlaying: false, playbackState: 'paused' };
  },
  END: (state) => {
    if (!state.isPlaying && state.playbackState === 'ended') {
      return state;
    }
    return { ...state, isPlaying: false, playbackState: 'ended' };
  },
  BUFFERING: (state, action) => {
    if (state.isBuffering === action.isBuffering) {
      return state;
    }
    return { ...state, isBuffering: action.isBuffering };
  },
  ERROR: (state, action) => ({
    ...state,
    error: action.error,
    playbackState: 'error',
    isPlaying: false,
    isLoading: false,
  }),
  VOLUME: (state, action) => {
    if (state.volume === action.volume && state.isMuted === action.isMuted) {
      return state;
    }
    return { ...state, volume: action.volume, isMuted: action.isMuted };
  },
  PLAYBACK_RATE: (state, action) => {
    if (state.playbackRate === action.rate) {
      return state;
    }
    return { ...state, playbackRate: action.rate };
  },
  VIDEO_SIZE: (state, action) => {
    const next = { width: action.width, height: action.height };
    if (state.videoSize.width === next.width && state.videoSize.height === next.height) {
      return state;
    }
    return { ...state, videoSize: next, isLoading: false };
  },
  PLAYBACK_ERROR: (state) =>
    // Surface the SDK's human-readable error message without overwriting the
    // structured `error` from the state machine (onError still owns code/nativeCode).
    // Consumers can read `state.error` for the structured payload and subscribe to
    // `onPlaybackError` for the SDK message (e.g. live recovery signalling).
    state,
  LIVE_STATE: (state, action) => {
    // Clear isLoading when the live player reports a non-loading state
    // (live, vod, offline, countdown, trailer). On iOS, onVideoSizeChange
    // is not emitted for live streams, so this is the only signal that
    // content is ready.
    return {
      ...state,
      liveState: action.liveState,
      isLoading: action.liveState?.state === 'loading' ? state.isLoading : false,
    };
  },
  LIVE_ERROR: (state, action) => ({ ...state, liveError: action.message, isLoading: false }),
  RESET: () =>
    // Full reset to defaults — used when the source identity changes
    // (VOD → live, or a different VOD) so stale state doesn't linger.
    DEFAULT_PLAYER_STATE,
};

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  return handlers[action.type](state, action as never);
}
