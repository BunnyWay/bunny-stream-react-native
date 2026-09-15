/** Retention percentage keyed by the time offsets returned by Bunny Stream. */
export type VideoHeatmap = Record<string, number>;

/** Filters for video statistics. Dates use ISO-8601 strings. */
export interface VideoStatisticsOptions {
  videoId?: string;
  dateFrom?: string;
  dateTo?: string;
  hourly?: boolean;
}

/** Views, watch time, country totals, and engagement for a requested period. */
export interface VideoStatistics {
  viewsChart: Record<string, number>;
  watchTimeChart: Record<string, number>;
  countryViewCounts: Record<string, number>;
  countryWatchTime: Record<string, number>;
  engagementScore: number;
}

/** A rendition and its storage path. */
export interface ResolutionReference {
  resolution: string | null;
  path: string | null;
}

/** One object in the library storage zone. */
export interface StorageObject {
  id: string | null;
  storageZoneName: string | null;
  storageZoneId: number | null;
  path: string | null;
  objectName: string | null;
  lengthBytes: number;
  dateCreated: string | null;
  lastChanged: string | null;
  isDirectory: boolean;
  contentType: string | null;
  serverId: number | null;
  userId: string | null;
  checksum: string | null;
  replicatedZones: string | null;
}

/** Available, configured, playlist, and storage renditions for one video. */
export interface VideoResolutionsInfo {
  videoId: string;
  videoLibraryId: number;
  availableResolutions: string[];
  configuredResolutions: string[];
  playlistResolutions: ResolutionReference[];
  storageResolutions: ResolutionReference[];
  mp4Resolutions: ResolutionReference[];
  storageObjects: StorageObject[];
  oldResolutions: StorageObject[];
  hasBothOldAndNewResolutionFormat: boolean;
  hasOriginal: boolean;
}

/** Storage size of one encoded codec/rendition pair. */
export interface CodecRenditionSize {
  codec: string | null;
  resolution: string | null;
  sizeBytes: number;
}

/** Detailed storage breakdown returned by the Android SDK. */
export interface VideoStorageSize {
  encoded: Record<string, CodecRenditionSize>;
  thumbnailsBytes: number;
  previewsBytes: number;
  originalsBytes: number;
  mp4FallbackBytes: number;
  miscellaneousBytes: number;
  calculatedAt: string | null;
}
