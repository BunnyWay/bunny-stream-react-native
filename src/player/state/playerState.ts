import type { PlayerProgress, PlayerState } from '../hooks/useBunnyStreamPlayer.types';

// --- Defaults ---

export const DEFAULT_PLAYER_STATE: PlayerState = {
  playbackState: 'idle',
  isPlaying: false,
  isBuffering: false,
  durationMs: 0,
  error: null,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  videoId: null,
  videoSize: { width: 0, height: 0 },
  isLoading: true,
  liveState: null,
  liveError: null,
};

export const DEFAULT_PROGRESS: PlayerProgress = {
  positionMs: 0,
  durationMs: 0,
  progress: 0,
};
