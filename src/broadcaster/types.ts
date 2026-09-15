import type { ViewStyle } from 'react-native';

/**
 * Broadcast quality configuration.
 *
 * **Platform note:** On iOS this maps to `BroadcastQuality` and is fully
 * configurable. On Android the SDK hard-codes 1080p30 (~9.3 Mbps video,
 * 64 kbps audio) — these fields are accepted but ignored.
 */
export interface BroadcastQuality {
  /** Target resolution preset. */
  resolution: BroadcastResolution;
  /** Frame rate in frames per second (e.g. 30, 60). */
  frameRate: number;
  /** Video bitrate in bits per second. */
  videoBitrate: number;
  /** Audio bitrate in bits per second. */
  audioBitrate?: number;
}

/** Resolution presets for broadcast quality. */
export type BroadcastResolution = 'sd480' | 'hd720' | 'fullHd1080';

/** Camera position for broadcast. */
export type CameraPosition = 'front' | 'back';

/**
 * Source for the broadcaster. A `new` recording uploads a new VOD to the
 * library. A `live` source broadcasts to an existing live stream.
 */
export type BroadcastSource =
  | { type: 'new'; libraryId: number }
  | { type: 'live'; libraryId: number; streamId: string; ingestEndpoint?: string };

/**
 * Props for the `BunnyStreamBroadcaster` Fabric component.
 */
export interface BunnyStreamBroadcasterProps {
  /** Access key for the Bunny Stream API. */
  accessKey: string;
  /** The broadcast source — new VOD recording or existing live stream. */
  source: BroadcastSource;
  /** Broadcast quality. iOS-only; ignored on Android. */
  quality?: BroadcastQuality;
  /** Initial camera position. Defaults to `back`. */
  cameraPosition?: CameraPosition;
  /** Whether to hide the SDK's built-in controls. Defaults to `false`. */
  hideDefaultControls?: boolean;
  /** Publish to both primary and backup ingest endpoints simultaneously. */
  dualPublish?: boolean;
  /** Whether to automatically start the broadcast when the view mounts. */
  autoStart?: boolean;
  /** Style prop. */
  style?: ViewStyle;
  /**
   * Called when the broadcast state changes.
   */
  onStateChange?: (event: BroadcastStateChangeEvent) => void;
  /**
   * Called when the elapsed time updates (approximately once per second).
   */
  onElapsedTime?: (event: BroadcastElapsedTimeEvent) => void;
  /**
   * Called when the camera position changes.
   */
  onCameraChange?: (event: BroadcastCameraChangeEvent) => void;
  /**
   * Called when the mute state changes.
   */
  onMuteChange?: (event: BroadcastMuteChangeEvent) => void;
  /**
   * Called when an ingest endpoint state changes (primary/backup).
   */
  onIngestStateChange?: (event: BroadcastIngestStateEvent) => void;
  /**
   * Called when the broadcaster is reconnecting.
   */
  onReconnecting?: (event: BroadcastReconnectingEvent) => void;
  /**
   * Called when reconnection attempts are exhausted.
   */
  onReconnectFailed?: () => void;
  /**
   * Called when the broadcaster fails over to the backup ingest endpoint.
   */
  onFailover?: (event: BroadcastFailoverEvent) => void;
  /**
   * Called when a terminal error occurs.
   */
  onError?: (event: BroadcastErrorEvent) => void;
}

/** Broadcast state: idle → preparing → live. */
export type BroadcastState = 'idle' | 'preparing' | 'live';

/** Event payload for `onStateChange`. */
export interface BroadcastStateChangeEvent {
  state: BroadcastState;
}

/** Event payload for `onElapsedTime`. */
export interface BroadcastElapsedTimeEvent {
  /** Elapsed time in milliseconds. */
  elapsedMs: number;
  /** Formatted elapsed time (HH:MM:SS). */
  formatted: string;
}

/** Event payload for `onCameraChange`. */
export interface BroadcastCameraChangeEvent {
  position: CameraPosition;
}

/** Event payload for `onMuteChange`. */
export interface BroadcastMuteChangeEvent {
  muted: boolean;
}

/** Ingest endpoint identifier. */
export type IngestEndpoint = 'primary' | 'backup';

/** Ingest endpoint state. */
export type IngestState = 'connecting' | 'live' | 'offline';

/** Event payload for `onIngestStateChange`. */
export interface BroadcastIngestStateEvent {
  endpoint: IngestEndpoint;
  state: IngestState;
}

/** Event payload for `onReconnecting`. */
export interface BroadcastReconnectingEvent {
  attempt: number;
  usingBackup: boolean;
}

/** Event payload for `onFailover`. */
export interface BroadcastFailoverEvent {
  usingBackup: boolean;
}

/** Event payload for `onError`. */
export interface BroadcastErrorEvent {
  message: string;
}

/**
 * Ref commands for the `BunnyStreamBroadcaster` component.
 *
 * **Platform note:** `startBroadcast` is supported on iOS. On Android the
 * SDK does not expose a public start method — the bridge simulates the
 * built-in start button when `hideDefaultControls` is `false`, and
 * resolves with an `InvalidState` error when controls are hidden.
 */
export interface BunnyStreamBroadcasterRef {
  /** Starts the broadcast. */
  startBroadcast: () => void;
  /** Stops the broadcast. */
  stopBroadcast: () => void;
  /** Switches between front and back camera. */
  switchCamera: () => void;
  /** Mutes or unmutes the audio. */
  setMuted: (muted: boolean) => void;
  /** Toggles the mute state. */
  toggleMute: () => void;
}
