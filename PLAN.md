# Plan: `useBunnyStreamPlayer` hook — aggregated player state

Add a React hook that subscribes to all native player events and exposes a single aggregated `PlayerState` + `PlayerProgress`, eliminating the per-screen `useState` boilerplate currently duplicated across `PlayerScreen.tsx` and `CustomControlsPlayerScreen.tsx`.

## Summary

A `useBunnyStreamPlayer()` hook that internally wires all 10 event handlers (`onReady`, `onPlaybackStateChange`, `onProgress`, `onError`, `onBuffering`, `onPlay`, `onPause`, `onEnd`, `onVolumeChange`, `onPlaybackRateChange`) into a `useReducer` (low-frequency state) + `useState` (high-frequency progress), and returns `{ ref, state, progress, controls, eventHandlers }`. The user spreads `eventHandlers` onto `<BunnyStreamPlayer>` and reads `state` / `progress` / `controls` in their UI. No Context/Provider. No lodash.

## Motivation

`CustomControlsPlayerScreen.tsx` (lines 27-32) has 6 `useState` calls just to track player state. `PlayerScreen.tsx` duplicates most of the same wiring. A third custom-controls screen would copy it again. The hook consolidates this into one call.

Unlike rn-player's `useDeepPlayerState` (which uses `lodash.isequal` deep-compare on every field), bunny-stream's events carry only primitives (numbers, booleans, strings) — `===` equality suffices, so no deep-compare is needed.

Unlike rn-player's single `PlayerState` object (where `currentTime` updates 4×/s force all context consumers to re-render), this hook splits state into **low-frequency** (`playbackState`, `isPlaying`, `isBuffering`, `error`, `volume`, `isMuted`, `playbackRate`, `durationMs`, `videoId`) and **high-frequency** (`positionMs`, `durationMs`, `progress`) so consumers that only read `state` don't re-render on every progress tick.

## Design

### State shapes

```ts
// Low-frequency — updated only on state transitions, errors, volume/rate changes
interface PlayerState {
  playbackState: PlayerPlaybackState;  // 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error'
  isPlaying: boolean;
  isBuffering: boolean;
  durationMs: number;          // set by onReady, stable thereafter
  error: { code: string; message: string; nativeCode?: string } | null;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  videoId: string | null;      // from onReady payload
}

// High-frequency — updated ~4×/s by onProgress
interface PlayerProgress {
  positionMs: number;
  durationMs: number;
  progress: number;            // 0–1, pre-computed natively
}
```

### Hook API

```ts
interface UseBunnyStreamPlayerOptions {
  // Optional user handlers — fire alongside internal state updates
  onReady?: (e: { videoId: string; durationMs: number }) => void;
  onPlaybackStateChange?: (e: { state: string; positionMs: number }) => void;
  onProgress?: (e: { positionMs: number; durationMs: number; progress: number }) => void;
  onError?: (e: { code: string; message: string; nativeCode?: string }) => void;
  onBuffering?: (e: { isBuffering: boolean }) => void;
  onPlay?: (e: { positionMs: number; durationMs: number }) => void;
  onPause?: (e: { positionMs: number; durationMs: number }) => void;
  onEnd?: (e: { positionMs: number; durationMs: number }) => void;
  onVolumeChange?: (e: { volume: number; isMuted: boolean }) => void;
  onPlaybackRateChange?: (e: { rate: number }) => void;
}

interface UseBunnyStreamPlayerResult {
  ref: React.RefObject<BunnyStreamPlayerRef | null>;
  state: PlayerState;
  progress: PlayerProgress;
  controls: BunnyStreamPlayerRef;        // stable imperative API (play/pause/seekTo/setVolume/setPlaybackRate)
  eventHandlers: {                       // spread onto <BunnyStreamPlayer>
    onReady, onPlaybackStateChange, onProgress, onError,
    onBuffering, onPlay, onPause, onEnd, onVolumeChange, onPlaybackRateChange
  };
}

function useBunnyStreamPlayer(options?: UseBunnyStreamPlayerOptions): UseBunnyStreamPlayerResult;
```

### Usage in example screens

```tsx
const player = useBunnyStreamPlayer();
const loading = player.state.playbackState === 'idle' || player.state.playbackState === 'loading';

<BunnyStreamPlayer
  ref={player.ref}
  style={styles.player}
  videoId={videoId}
  libraryId={libraryId}
  autoPlay
  controls={false}
  {...player.eventHandlers}
/>

{loading && <LoadingOverlay />}
{player.state.error && <ErrorOverlay error={player.state.error} />}

<ProgressBar
  positionMs={player.progress.positionMs}
  durationMs={player.state.durationMs}
  progress={player.progress.progress}
/>
<PlayPauseButton
  isPlaying={player.state.isPlaying}
  onPlay={player.controls.play}
  onPause={player.controls.pause}
/>
```

### Internal implementation

1. **`ref`**: `useRef<BunnyStreamPlayerRef | null>(null)` — attached to `<BunnyStreamPlayer>`.
2. **`controls`**: `useMemo(() => ({ play: () => ref.current?.play(), pause: () => ref.current?.pause(), seekTo: (ms) => ref.current?.seekTo(ms), setVolume: (v) => ref.current?.setVolume(v), setPlaybackRate: (r) => ref.current?.setPlaybackRate(r) }), [])` — stable identity, safe to pass to memoized children.
3. **`state`**: `useReducer(stateReducer, DEFAULT_PLAYER_STATE)` — low-frequency.
4. **`progress`**: `useState(DEFAULT_PROGRESS)` — high-frequency, simple replacement.
5. **`eventHandlers`**: `useMemo` of 10 `useCallback` handlers. Each handler:
   - Extracts `nativeEvent` from the RN event wrapper.
   - Dispatches to the reducer / sets progress.
   - Calls the user's optional handler (from `options`) if provided.
   - User handlers are stored in a `useRef` to avoid re-creating the memoized handlers when user callbacks change identity.

### Reducer actions

| Action | Trigger | State fields updated |
| -------- | --------- | --------------------- |
| `READY` | `onReady` | `playbackState='ready'`, `durationMs`, `videoId`, `error=null` |
| `STATE_CHANGE` | `onPlaybackStateChange` | `playbackState` |
| `PLAY` | `onPlay` | `isPlaying=true`, `playbackState='playing'`, `error=null` |
| `PAUSE` | `onPause` | `isPlaying=false`, `playbackState='paused'` |
| `END` | `onEnd` | `isPlaying=false`, `playbackState='ended'` |
| `BUFFERING` | `onBuffering` | `isBuffering` |
| `ERROR` | `onError` | `error`, `playbackState='error'`, `isPlaying=false` |
| `VOLUME` | `onVolumeChange` | `volume`, `isMuted` |
| `PLAYBACK_RATE` | `onPlaybackRateChange` | `playbackRate` |
| `RESET` | `onReady` with new `videoId` | all fields back to defaults, then apply `READY` |

`onProgress` does NOT dispatch to the reducer — it calls `setProgress` directly (separate state, high-frequency).

Note: `onPlaybackStateChange` and `onPlay`/`onPause`/`onEnd` can fire for the same transition (the native state machine emits both — see `PlaybackState.kt` lines 171-178). The reducer handles this idempotently: `PLAY` sets `playbackState='playing'` and `STATE_CHANGE` with `state='playing'` is a no-op if already `'playing'`.

### VideoId reset (auto, no option needed)

The hook does NOT take `videoId` as an option — the consumer passes `videoId` only to `<BunnyStreamPlayer>`. Reset is detected automatically from `onReady`'s payload: the `READY` reducer action compares the incoming `videoId` with the previous one stored in state. If they differ, the reducer first zeroes `error`/`isBuffering`/`playbackState`/`positionMs`/`progress`, then applies the new `durationMs`/`videoId`/`playbackState='ready'`. This avoids stale state lingering between a `videoId` change and the first event of the new source, with zero redundancy — `videoId` is declared in exactly one place.

## Implementation Steps

1. **Create `src/useBunnyStreamPlayer.ts`** — the hook, state types, reducer, defaults. All in one file (~150 lines).
2. **Export from `src/index.tsx`** — add `export { useBunnyStreamPlayer } from './useBunnyStreamPlayer'` and export `PlayerState`, `PlayerProgress`, `UseBunnyStreamPlayerOptions`, `UseBunnyStreamPlayerResult` types.
3. **Refactor `example/src/screens/CustomControlsPlayerScreen.tsx`** — replace 6 `useState` + 6 event handlers with `useBunnyStreamPlayer()`. Keep the same UI.
4. **Refactor `example/src/screens/PlayerScreen.tsx`** — same refactor. Keep speed controls using `player.controls.setPlaybackRate`.
5. **Write tests `src/__tests__/useBunnyStreamPlayer.test.tsx`** — test reducer transitions, test that user handlers are called, test that `controls` is stable, test auto-reset on `onReady` with new `videoId`.

## Files to Modify

- `src/useBunnyStreamPlayer.ts` — **new file**: hook + types + reducer + defaults
- `src/index.tsx` — add exports for the hook and its types
- `example/src/screens/CustomControlsPlayerScreen.tsx` — refactor to use hook
- `example/src/screens/PlayerScreen.tsx` — refactor to use hook
- `src/__tests__/useBunnyStreamPlayer.test.tsx` — **new file**: unit tests

## Verification

- [ ] `yarn typecheck` passes (root + example)
- [ ] `yarn lint` passes
- [ ] `yarn test` passes (new tests for reducer + hook)
- [ ] `yarn example:android` builds and installs
- [ ] Manual: play a video in `PlayerScreen` — speed controls, progress, play/pause all work
- [ ] Manual: play a video in `CustomControlsPlayerScreen` — custom controls, seek, progress bar all work
- [ ] Manual: navigate back and forth between screens — no stale state, no crashes

## Risks / Considerations

- **Redundant events**: The native state machine emits both `onPlay` and `onPlaybackStateChange('playing')` for the same transition. The reducer handles this idempotently — no double updates.
- **High-frequency re-renders**: `progress` updates 4×/s. The component calling the hook re-renders 4×/s. This is unavoidable (something must subscribe to progress). Consumers should pass only `state.*` primitives to `React.memo`-ized children that don't need position. The split makes this explicit.
- **No lodash dependency**: Unlike rn-player, no deep-compare is needed. All event payloads are primitives. `useReducer` with functional updates is sufficient.
- **Backwards compatibility**: The hook is additive. `<BunnyStreamPlayer>` and its direct event-handler props remain unchanged. Users who prefer manual wiring can ignore the hook.
- **`eventHandlers` identity**: Memoized with `useMemo` keyed on user-handler refs (stored in a `useRef`, so stable). The spread `{...player.eventHandlers}` won't cause unnecessary re-renders of the native component.
