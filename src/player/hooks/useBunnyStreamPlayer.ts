/**
 * `useBunnyStreamPlayer` — a React hook that subscribes to all native
 * {@link BunnyStreamPlayer} events and exposes a single aggregated
 * `PlayerState` (low-frequency) + `PlayerProgress` (high-frequency),
 * eliminating the per-screen `useState` boilerplate.
 *
 * The hook is purely additive: it returns `eventHandlers` that the consumer
 * spreads onto `<BunnyStreamPlayer {...player.eventHandlers} />`, plus a
 * stable `controls` object that proxies the imperative ref API.
 *
 * State is split so that consumers reading only `state.*` (e.g. play/pause
 * buttons) do NOT re-render on every `onProgress` tick (~4×/s).
 */

import type { BunnyVodPlayerRef } from '../BunnyStreamPlayer.types';
import type {
  PlayerEventHandlers,
  PlayerProgress,
  UseBunnyStreamPlayerOptions,
  UseBunnyStreamPlayerResult,
} from './useBunnyStreamPlayer.types';

import * as React from 'react';

import { createPlayerEventHandlers } from '../state/playerEventHandlers';
import { playerReducer } from '../state/playerReducer';
import { DEFAULT_PLAYER_STATE, DEFAULT_PROGRESS } from '../state/playerState';

export type {
  PlayerEventHandlers,
  PlayerProgress,
  PlayerState,
  UseBunnyStreamPlayerOptions,
  UseBunnyStreamPlayerResult,
} from './useBunnyStreamPlayer.types';

/**
 * Subscribes to all {@link BunnyStreamPlayer} events and aggregates them into
 * a single `PlayerState` + `PlayerProgress`. See the file docstring for
 * usage.
 *
 * @param options  Optional user-supplied event handlers.
 * @param sourceKey  Identity key for the current source (e.g. from
 *   `sourceIdentityKey`). When this changes, the hook resets `state` and
 *   `progress` to defaults — this prevents stale VOD state (videoId,
 *   duration, progress, playback state) from lingering after a VOD → live
 *   transition or a source change. Pass `undefined` to opt out of resets
 *   (legacy behaviour).
 */
export function useBunnyStreamPlayer(
  options?: UseBunnyStreamPlayerOptions,
  sourceKey?: string | number,
): UseBunnyStreamPlayerResult {
  const ref = React.useRef<BunnyVodPlayerRef | null>(null);

  const [state, dispatch] = React.useReducer(playerReducer, DEFAULT_PLAYER_STATE);
  const [progress, setProgress] = React.useState<PlayerProgress>(DEFAULT_PROGRESS);

  // Reset state + progress when the source identity changes. This clears
  // stale VOD state (videoId, duration, progress, playback state) when
  // switching to live (which doesn't emit onReady) or between VOD sources.
  // Uses a ref to track the previous key so the reset only fires on actual
  // changes, not on every render.
  const prevSourceKey = React.useRef<string | number | undefined>(sourceKey);
  React.useEffect(() => {
    if (prevSourceKey.current !== sourceKey) {
      prevSourceKey.current = sourceKey;
      // Reset state + progress to defaults so stale VOD state (videoId,
      // duration, progress, playback state) doesn't linger after a source
      // change (e.g. VOD → live, which doesn't emit onReady).
      dispatch({ type: 'RESET' });
      setProgress(DEFAULT_PROGRESS);
    }
  }, [sourceKey]);

  // Store user handlers in a ref so the memoised event handlers below have a
  // stable identity even when the user passes inline callbacks.
  const optionsRef = React.useRef<UseBunnyStreamPlayerOptions | undefined>(options);
  optionsRef.current = options;

  // Stable imperative API — proxies the ref so consumers can call
  // `player.controls.play()` without touching the ref directly.
  const controls = React.useMemo<BunnyVodPlayerRef>(
    () => ({
      play: () => ref.current?.play(),
      pause: () => ref.current?.pause(),
      seekTo: (positionMs: number) => ref.current?.seekTo(positionMs),
      skipForward: (offsetMs?: number) => ref.current?.skipForward(offsetMs),
      skipBackward: (offsetMs?: number) => ref.current?.skipBackward(offsetMs),
      setVolume: (volume: number) => ref.current?.setVolume(volume),
      setPlaybackRate: (rate: number) => ref.current?.setPlaybackRate(rate),
      mute: () => ref.current?.mute(),
      unmute: () => ref.current?.unmute(),
      enterPiP: () => ref.current?.enterPiP(),
    }),
    [],
  );

  const eventHandlers = React.useMemo<PlayerEventHandlers>(
    () => createPlayerEventHandlers(dispatch, setProgress, optionsRef),
    [],
  );

  return { ref, state, progress, controls, eventHandlers };
}
