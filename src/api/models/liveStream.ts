/**
 * Lifecycle state of a live stream, carried as an integer (0..7) by the API.
 *
 * Mirrors `net.bunny.api.model.LiveStreamStatus`. Usual life:
 * `CREATED`/`SCHEDULED` → `PREVIEW` (encoder connected) → `RUNNING` → `ENDED`,
 * with `VOD_PROCESSING` in between when the stream records a VOD.
 */
export type LiveStreamStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Named constants for {@link LiveStreamStatus}.
 */
export const LiveStreamStatusEnum = {
  UNKNOWN: 0,
  CREATED: 1,
  SCHEDULED: 2,
  PREVIEW: 3,
  RUNNING: 4,
  ENDED: 5,
  VOD_PROCESSING: 6,
  ERROR: 7,
} as const satisfies Record<string, LiveStreamStatus>;

/**
 * Human-readable label for a {@link LiveStreamStatus} code, for pills/badges.
 */
export function liveStreamStatusLabel(status: LiveStreamStatus): string {
  switch (status) {
    case LiveStreamStatusEnum.UNKNOWN:
      return 'UNKNOWN';
    case LiveStreamStatusEnum.CREATED:
      return 'CREATED';
    case LiveStreamStatusEnum.SCHEDULED:
      return 'SCHEDULED';
    case LiveStreamStatusEnum.PREVIEW:
      return 'PREVIEW';
    case LiveStreamStatusEnum.RUNNING:
      return 'RUNNING';
    case LiveStreamStatusEnum.ENDED:
      return 'ENDED';
    case LiveStreamStatusEnum.VOD_PROCESSING:
      return 'VOD_PROCESSING';
    case LiveStreamStatusEnum.ERROR:
      return 'ERROR';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Optional RTMP forwarding endpoint that the incoming live stream is relayed to.
 */
export interface RtmpOutput {
  endpoint: string | null;
  streamKey: string | null;
}

/**
 * Domain representation of a Bunny Stream live stream.
 *
 * Mirrors `net.bunny.api.livestream.domain.model.LiveStream`.
 */
export interface LiveStream {
  id: string;
  videoLibraryId: number;
  title: string;
  description: string | null;
  category: string | null;
  collectionId: string | null;
  isPublic: boolean;
  status: LiveStreamStatus;
  dateCreated: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  streamKey: string | null;
  playbackUrlHls: string | null;
  dvrEnabled: boolean;
  dvrWindowSeconds: number | null;
  recordVod: boolean;
  availableResolutions: string | null;
  width: number | null;
  height: number | null;
  framerate: number | null;
  ingestRegion: string | null;
  peakConcurrentViewers: number | null;
  totalViewerSeconds: number | null;
  thumbnailFileName: string | null;
  thumbnailUpdatedAt: string | null;
  enableCountdown: boolean | null;
  rtmpOutputs: RtmpOutput[];
  preStreamTrailerVideoId: string | null;
  /** Primary RTMP ingest URL the broadcaster publishes to. */
  primaryIngestUrl: string | null;
  /** Backup RTMP ingest URL, used for failover. */
  backupIngestUrl: string | null;
}

/**
 * Paginated result of listing live streams in a video library.
 *
 * Mirrors `net.bunny.api.livestream.domain.model.LiveStreamList`.
 */
export interface LiveStreamList {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  items: LiveStream[];
}

export interface LiveStreamThumbnail {
  url: string | null;
  timestamp: string | null;
}

export interface LiveStreamIngestStatus {
  readyToStart: boolean;
  primaryLive: boolean | null;
  backupLive: boolean | null;
  isLive: boolean;
  lastPingAgoMs: number | null;
  durationSeconds: number | null;
  statusTime: string | null;
}

export interface LiveStreamThumbnailListOptions {
  limit?: number;
  from?: string;
  to?: string;
}

export type LiveStreamThumbnailContentType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/**
 * Playback data for a live stream, sourced from the Manage Live Streams
 * `/play` endpoint. Mirrors `LiveStreamPlayData`.
 */
export interface LiveStreamPlayData {
  liveStream: LiveStream | null;
  libraryName: string | null;
  captionsPath: string | null;
  seekPath: string | null;
  thumbnailUrl: string | null;
  fallbackUrl: string | null;
  videoPlaylistUrl: string | null;
  originalUrl: string | null;
  previewUrl: string | null;
  controls: string;
  enableDRM: boolean;
  drmVersion: number;
  keyColor: number;
  vastTagUrl: string | null;
  captionsFontSize: number;
  captionsFontColor: number | null;
  captionsBackgroundColor: number | null;
  uiLanguage: string | null;
  allowEarlyPlay: boolean;
  tokenAuthEnabled: boolean;
  enableMP4Fallback: boolean;
  showHeatmap: boolean;
  fontFamily: string | null;
  playbackSpeeds: number[];
  widevineMinClientSecurityLevel: number | null;
  zoneTier: number | null;
  rememberPlayerPosition: boolean;
  enableCompactControls: boolean;
}
