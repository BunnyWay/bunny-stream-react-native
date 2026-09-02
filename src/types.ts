/**
 * Shared types that are referenced from multiple modules without creating
 * import cycles. Kept separate from {@link ./index} so that
 * `./useBunnyStreamPlayer` can import `BunnyStreamPlayerRef` without
 * pulling in the component module.
 */

/**
 * Imperative commands available via a ref to {@link BunnyStreamPlayer}.
 *
 * These map 1:1 to the Codegen `NativeCommands`. Commands issued before
 * `STATE_READY` are queued on the native side and drained when the player
 * becomes ready.
 */
export type BunnyStreamPlayerRef = {
  /** Resume playback. */
  play: () => void;
  /** Pause playback. */
  pause: () => void;
  /** Seek to [positionMs] (milliseconds, non-negative). */
  seekTo: (positionMs: number) => void;
  /** Set volume (0.0–1.0). */
  setVolume: (volume: number) => void;
  /** Set playback rate (must be > 0). */
  setPlaybackRate: (rate: number) => void;
};
