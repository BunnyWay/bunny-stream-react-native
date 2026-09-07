/**
 * Shared types that are referenced from multiple modules without creating
 * import cycles. Kept separate from {@link ./index} so that
 * `./useBunnyStreamPlayer` can import `BunnyStreamPlayerRef` without
 * pulling in the component module.
 */

/**
 * Discriminated union describing the playback source for
 * {@link BunnyStreamPlayer}.
 *
 * The union prevents passing `videoId` and `streamId` at the same time.
 * For `live`, `libraryId` is required (matching the native SDK composable);
 * for `vod` it falls back to the library passed to {@link initialize}.
 *
 * The public component selects the internal native host (VOD view vs live
 * Compose host) based on `source.type`. A change of `type` or the source
 * identity id triggers a controlled remount of the native host so the SDK
 * ViewModel / player engine is cleanly torn down and recreated.
 */
export type BunnyStreamSource =
  | {
      type: 'vod';
      /** Bunny Stream video GUID to play. */
      videoId: string;
      /** Library ID. Falls back to the library passed to {@link initialize}. */
      libraryId?: number;
      /** Embed view token for token-secured pull zones. */
      token?: string;
      /** Token expiration timestamp (Unix seconds). */
      expires?: number;
    }
  | {
      type: 'live';
      /** Bunny Stream live stream GUID to play. */
      streamId: string;
      /** Library ID. Required for live (the native composable requires it). */
      libraryId: number;
      /** Embed view token for token-secured live streams. */
      token?: string;
      /** Token expiration timestamp (Unix seconds). */
      expires?: number;
    };

/**
 * Imperative commands available for VOD playback through
 * {@link BunnyStreamPlayer}. Commands issued before `STATE_READY` are queued
 * natively and drained when the VOD player becomes ready.
 *
 * Do not call these commands for a `live` source. The native SDKs do not expose
 * public live controllers yet, so the component ignores VOD commands while its
 * active source is live.
 */
export type BunnyVodPlayerRef = {
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
  /** Mute audio. */
  mute: () => void;
  /** Unmute audio. */
  unmute: () => void;
};

/**
 * Backward-compatible name for the VOD-only imperative player API.
 * Prefer {@link BunnyVodPlayerRef} in new code so live command limitations are
 * visible at the call site.
 */
export type BunnyStreamPlayerRef = BunnyVodPlayerRef;
