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
