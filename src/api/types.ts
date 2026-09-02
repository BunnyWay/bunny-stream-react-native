/**
 * Domain types for the Bunny Stream REST API surface.
 *
 * Mirror the Android SDK's domain models (`net.bunny:api`) so a change to the
 * OpenAPI spec cannot break a React Native consumer's build. Nullability follows
 * what the API actually guarantees rather than what the generators emit.
 *
 * The result envelope {@link BunnyResult} and the typed error taxonomy
 * {@link BunnyError} mirror the native `BunnyResult`/`BunnyError` sealed classes
 * — see `bunny-stream-api/.../error/BunnyResult.kt` and `BunnyError.kt`.
 */

// region — enums (API integer codes) —

/**
 * Lifecycle state of a video in the upload → transcode → playable pipeline.
 *
 * Mirrors `net.bunny.api.model.VideoModelStatus`. `FINISHED` (4) means playable.
 */
export type VideoStatus = 0 | 1 | 2 | 3 | 4 | 6;

/**
 * Named constants for {@link VideoStatus}. Use `VideoStatusEnum.FINISHED` etc.
 */
export const VideoStatusEnum = {
  CREATED: 0,
  UPLOADED: 1,
  PROCESSING: 2,
  TRANSCODING: 3,
  FINISHED: 4,
  UPLOAD_FAILED: 6,
} as const satisfies Record<string, VideoStatus>;

/**
 * Statuses the server moves through before a video becomes playable.
 * Mirrors `VideoStatus.TRANSITIONAL` in the Android SDK — used by the list
 * screen's poll loop to decide whether to keep refreshing.
 */
export const TRANSITIONAL_VIDEO_STATUSES: ReadonlySet<VideoStatus> = new Set<VideoStatus>([
  VideoStatusEnum.CREATED,
  VideoStatusEnum.UPLOADED,
  VideoStatusEnum.PROCESSING,
  VideoStatusEnum.TRANSCODING,
]);

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
 * Human-readable label for a {@link VideoStatus} code, for pills/badges.
 */
export function videoStatusLabel(status: VideoStatus): string {
  switch (status) {
    case VideoStatusEnum.CREATED:
      return 'CREATED';
    case VideoStatusEnum.UPLOADED:
      return 'UPLOADED';
    case VideoStatusEnum.PROCESSING:
      return 'PROCESSING';
    case VideoStatusEnum.TRANSCODING:
      return 'TRANSCODING';
    case VideoStatusEnum.FINISHED:
      return 'FINISHED';
    case VideoStatusEnum.UPLOAD_FAILED:
      return 'UPLOAD_FAILED';
    default:
      return 'UNKNOWN';
  }
}

// endregion

// region — video models —

/**
 * A subtitle track attached to a video.
 */
export interface Caption {
  languageCode: string | null;
  label: string | null;
  version: number | null;
}

/**
 * A named section of a video, shown on the player's timeline.
 */
export interface Chapter {
  title: string;
  startSeconds: number | null;
  endSeconds: number | null;
}

/** A labelled point in time on the player's timeline. */
export interface Moment {
  label: string;
  timestampSeconds: number | null;
}

/** An arbitrary key/value pair stored alongside the video. */
export interface MetaTag {
  property: string | null;
  value: string | null;
}

/**
 * Domain representation of a video in a Bunny Stream library.
 *
 * Mirrors `net.bunny.api.video.domain.model.Video` but omits Android-specific
 * derived fields. Fields that are genuinely absent before transcoding finishes
 * stay nullable.
 */
export interface Video {
  id: string;
  videoLibraryId: number;
  title: string;
  description: string | null;
  collectionId: string | null;
  category: string | null;
  dateUploaded: string | null;
  isPublic: boolean;
  status: VideoStatus;

  // playback and media properties
  lengthSeconds: number;
  width: number | null;
  height: number | null;
  framerate: number | null;
  rotation: number | null;
  availableResolutions: string[];
  outputCodecs: string[];
  hasMp4Fallback: boolean;
  jitEncodingEnabled: boolean;

  // storage and processing
  storageSizeBytes: number;
  encodeProgress: number;
  hasOriginal: boolean;
  originalHash: string | null;
  hasHighQualityPreview: boolean;

  // thumbnails
  thumbnailCount: number;
  thumbnailFileName: string | null;
  thumbnailBlurhash: string | null;

  // analytics
  views: number;
  averageWatchTimeSeconds: number;
  totalWatchTimeSeconds: number;

  // content added on top of the video
  captions: Caption[];
  chapters: Chapter[];
  moments: Moment[];
  metaTags: MetaTag[];
}

/**
 * Paginated result of listing videos in a library.
 *
 * Mirrors `net.bunny.api.video.domain.model.VideoList`.
 */
export interface VideoList {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  items: Video[];
}

// endregion

// region — live stream models —

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

// endregion

// region — play data —

/**
 * Everything needed to play one video: URLs plus the library's player config.
 *
 * Mirrors `net.bunny.api.video.domain.model.VideoPlayData`. Color ints are kept
 * as numbers (ARGB); the `controls` string is a comma-separated list of enabled
 * control tokens (e.g. `"play,progress,mute,volume,fullscreen"`).
 */
export interface VideoPlayData {
  video: Video | null;
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
  viAiPublisherId: string | null;
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
  isPlayable: boolean;
  isPlaylistPlayable: boolean;
  preferredPlaybackSource: string | null;
  rememberPlayerPosition: boolean;
  customCss: string | null;
  exposeVideoMetadata: boolean;
  enableCompactControls: boolean;
}

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

// endregion

// region — player settings —

/**
 * The library's player configuration for one video, including any per-video
 * overrides. Mirrors `net.bunny.api.settings.domain.model.PlayerSettings`.
 *
 * Most callers want {@link BunnyStreamApi.fetchPlayerSettings} to enrich a
 * video list with thumbnail URLs — `thumbnailUrl` here is the CDN URL of the
 * video's current poster image.
 */
export interface PlayerSettings {
  thumbnailUrl: string;
  controls: string;
  keyColor: number;
  captionsFontSize: number;
  captionsFontColor: number | null;
  captionsBackgroundColor: number | null;
  uiLanguage: string;
  showHeatmap: boolean;
  fontFamily: string;
  playbackSpeeds: number[];
  drmEnabled: boolean;
  vastTagUrl: string | null;
  videoUrl: string;
  seekPath: string;
  captionsPath: string;
  resumePosition: number;
}

// endregion

// region — request shapes —

/**
 * Creates an empty video record that bytes are then uploaded into.
 *
 * Mirrors `net.bunny.api.video.domain.model.CreateVideoRequest`.
 */
export interface CreateVideoRequestInput {
  title: string;
  collectionId?: string | null;
  thumbnailTime?: number | null;
}

/**
 * Changes to apply to an existing video. `undefined`/`null` leaves a field as
 * it is; an empty list clears it. Mirrors `UpdateVideoRequest`.
 */
export interface UpdateVideoRequestInput {
  title?: string | null;
  collectionId?: string | null;
  chapters?: Chapter[] | null;
  moments?: Moment[] | null;
  metaTags?: MetaTag[] | null;
}

/**
 * Writable subset of {@link LiveStream} used to create or update live streams.
 *
 * All fields are nullable so callers can update only the fields they want —
 * `null`/`undefined` values are not sent to the server. Mirrors
 * `LiveStreamCreateRequest`.
 */
export interface LiveStreamCreateRequestInput {
  title?: string | null;
  description?: string | null;
  collectionId?: string | null;
  isPublic?: boolean | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  dvrEnabled?: boolean | null;
  dvrWindowSeconds?: number | null;
  recordVod?: boolean | null;
  enableCountdown?: boolean | null;
  preStreamTrailerVideoId?: string | null;
  rtmpOutputs?: RtmpOutput[] | null;
}

// endregion

// region — result envelope + error taxonomy —

/**
 * The seven error cases the SDK collapses every failure into.
 *
 * Mirrors the sealed class `net.bunny.api.error.BunnyError`. The `kind` string
 * is the bridge's discriminant — native maps each `BunnyError` subclass to one
 * of these so JS can pattern-match without `instanceof`.
 */
export type BunnyErrorKind =
  'Network' | 'Http' | 'Auth' | 'NotFound' | 'Decode' | 'LocalFile' | 'InvalidState';

/**
 * Typed error carried by {@link BunnyResult} when a call fails.
 *
 * `httpStatus` is `0` when no usable HTTP response existed (Network, Decode,
 * LocalFile, InvalidState). `isTerminal` is `true` for `401`/`403`/`404`/`410`
 * and for LocalFile/InvalidState — retrying can never succeed; everything else
 * (5xx, Network, Decode) is transient.
 */
export interface BunnyError {
  kind: BunnyErrorKind;
  httpStatus: number;
  message: string;
  isTerminal: boolean;
}

/**
 * The result envelope for the SDK's management calls: either `Ok` carrying the
 * value, or `Err` carrying a typed {@link BunnyError}.
 *
 * Mirrors `net.bunny.api.error.BunnyResult`. The bridge never throws — it
 * resolves the Promise with one of these two shapes so the caller can branch on
 * `result.ok` and keep the typed error.
 */
export type BunnyResult<T> = { ok: true; value: T } | { ok: false; error: BunnyError };

// endregion

// region — result helpers (mirror Kotlin ext in BunnyResult.kt) —

/**
 * The value when this is `Ok`, `null` otherwise. Mirrors `BunnyResult.getOrNull`.
 */
export function getOrNull<T>(result: BunnyResult<T>): T | null {
  return result.ok ? result.value : null;
}

/**
 * The error when this is `Err`, `null` otherwise. Mirrors `BunnyResult.errorOrNull`.
 */
export function errorOrNull<T>(result: BunnyResult<T>): BunnyError | null {
  return result.ok ? null : result.error;
}

/**
 * Collapses the result into a single value by applying the matching side.
 * Mirrors `BunnyResult.fold`.
 */
export function fold<T, R>(
  result: BunnyResult<T>,
  onOk: (value: T) => R,
  onErr: (error: BunnyError) => R,
): R {
  return result.ok ? onOk(result.value) : onErr(result.error);
}

/**
 * Transforms the value of an `Ok` result; an `Err` passes through unchanged.
 * Mirrors `BunnyResult.map`.
 */
export function map<T, R>(result: BunnyResult<T>, transform: (value: T) => R): BunnyResult<R> {
  return result.ok ? { ok: true, value: transform(result.value) } : result;
}

// endregion
