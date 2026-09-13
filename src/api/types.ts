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
 *
 * @deprecated Prefer the domain modules under `models/` and `result/`, or the
 * explicit feature barrel at `api/index.ts`. This file remains as a compatibility
 * barrel for existing imports.
 */

export type {
  CollectionListOptions,
  VideoCollection,
  VideoCollectionList,
} from './models/collections';
export { TRANSITIONAL_VIDEO_STATUSES, VideoStatusEnum, videoStatusLabel } from './models/video';
export type {
  Caption,
  Chapter,
  MetaTag,
  Moment,
  Video,
  VideoList,
  VideoPlayData,
  VideoStatus,
} from './models/video';
export type {
  CodecRenditionSize,
  ResolutionReference,
  StorageObject,
  VideoHeatmap,
  VideoResolutionsInfo,
  VideoStatistics,
  VideoStatisticsOptions,
  VideoStorageSize,
} from './models/videoInsights';

export { LiveStreamStatusEnum, liveStreamStatusLabel } from './models/liveStream';
export type {
  LiveStream,
  LiveStreamIngestStatus,
  LiveStreamList,
  LiveStreamPlayData,
  LiveStreamStatus,
  LiveStreamThumbnail,
  LiveStreamThumbnailContentType,
  LiveStreamThumbnailListOptions,
  RtmpOutput,
} from './models/liveStream';

export type { PlayerSettings } from './models/playerSettings';
export type {
  AddCaptionRequestInput,
  CreateVideoRequestInput,
  DeleteResolutionsOptions,
  FetchNewVideoOptions,
  FetchVideoRequestInput,
  LiveStreamCreateRequestInput,
  RefetchVideoOptions,
  SmartGenerateRequestInput,
  TranscribeVideoOptions,
  TranscribeVideoRequestInput,
  UpdateVideoRequestInput,
  VideoCodec,
} from './models/requests';

export type { BunnyError, BunnyErrorKind, BunnyResult } from './result/BunnyResult';
export { errorOrNull, fold, getOrNull, map } from './result/resultHelpers';
