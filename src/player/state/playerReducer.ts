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

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'READY': {
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
    }
    case 'STATE_CHANGE': {
      // Idempotent: skip if the state string is already the current value.
      // The native state machine emits both `onPlay` and
      // `onPlaybackStateChange('playing')` for the same transition.
      if (state.playbackState === action.state) {
        return state;
      }
      return { ...state, playbackState: action.state as PlayerState['playbackState'] };
    }
    case 'PLAY':
      if (state.isPlaying && state.playbackState === 'playing') {
        return state;
      }
      return { ...state, isPlaying: true, playbackState: 'playing', error: null };
    case 'PAUSE':
      if (!state.isPlaying && state.playbackState === 'paused') {
        return state;
      }
      return { ...state, isPlaying: false, playbackState: 'paused' };
    case 'END':
      if (!state.isPlaying && state.playbackState === 'ended') {
        return state;
      }
      return { ...state, isPlaying: false, playbackState: 'ended' };
    case 'BUFFERING':
      if (state.isBuffering === action.isBuffering) {
        return state;
      }
      return { ...state, isBuffering: action.isBuffering };
    case 'ERROR':
      return {
        ...state,
        error: action.error,
        playbackState: 'error',
        isPlaying: false,
        isLoading: false,
      };
    case 'VOLUME':
      if (state.volume === action.volume && state.isMuted === action.isMuted) {
        return state;
      }
      return { ...state, volume: action.volume, isMuted: action.isMuted };
    case 'PLAYBACK_RATE':
      if (state.playbackRate === action.rate) {
        return state;
      }
      return { ...state, playbackRate: action.rate };
    case 'VIDEO_SIZE': {
      const next = { width: action.width, height: action.height };
      if (state.videoSize.width === next.width && state.videoSize.height === next.height) {
        return state;
      }
      return { ...state, videoSize: next, isLoading: false };
    }
    case 'PLAYBACK_ERROR':
      // Surface the SDK's human-readable error message without overwriting the
      // structured `error` from the state machine (onError still owns code/nativeCode).
      // Consumers can read `state.error` for the structured payload and subscribe to
      // `onPlaybackError` for the SDK message (e.g. live recovery signalling).
      return state;
    case 'LIVE_STATE':
      // Clear isLoading when the live player reports a non-loading state
      // (live, vod, offline, countdown, trailer). On iOS, onVideoSizeChange
      // is not emitted for live streams, so this is the only signal that
      // content is ready.
      return {
        ...state,
        liveState: action.liveState,
        isLoading: action.liveState?.state === 'loading' ? state.isLoading : false,
      };
    case 'LIVE_ERROR':
      return { ...state, liveError: action.message, isLoading: false };
    case 'RESET':
      // Full reset to defaults — used when the source identity changes
      // (VOD → live, or a different VOD) so stale state doesn't linger.
      return DEFAULT_PLAYER_STATE;
    default:
      return state;
  }
}
