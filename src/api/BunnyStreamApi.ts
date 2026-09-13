/**
 * Public Bunny Stream REST API surface for React Native.
 *
 * Wraps the {@link NativeBunnyStreamApi} TurboModule behind an idiomatic
 * TypeScript API: `number` instead of `Double`, optional request fields instead
 * of `null`-typed Codegen params, and the typed {@link BunnyResult} envelope.
 *
 * The module reaches the SDK through `BunnyStreamApi.getInstance()` — the same
 * instance that `initialize(accessKey, libraryId)` registered. Call
 * `initialize` (from `bunny-stream-react-native`) before any method here.
 *
 * Every method returns `Promise<BunnyResult<T>>` and never rejects — failures
 * arrive as `{ ok: false, error }` so the typed error taxonomy (terminal vs
 * transient, Auth vs NotFound vs Network) stays available to the caller.
 *
 * @example
 * ```ts
 * import { BunnyStreamApi, fold } from 'bunny-stream-react-native';
 *
 * const result = await BunnyStreamApi.listVideos(libraryId);
 * fold(
 *   result,
 *   (list) => console.log(`${list.items.length} videos`),
 *   (error) => console.error(error.message, error.isTerminal),
 * );
 * ```
 */

import type {
  CollectionListOptions,
  VideoCollection,
  VideoCollectionList,
} from './models/collections';
import type {
  LiveStream,
  LiveStreamIngestStatus,
  LiveStreamList,
  LiveStreamPlayData,
  LiveStreamThumbnail,
  LiveStreamThumbnailContentType,
  LiveStreamThumbnailListOptions,
} from './models/liveStream';
import type { PlayerSettings } from './models/playerSettings';
import type {
  AddCaptionRequestInput,
  CreateVideoRequestInput,
  DeleteResolutionsOptions,
  FetchNewVideoOptions,
  LiveStreamCreateRequestInput,
  RefetchVideoOptions,
  SmartGenerateRequestInput,
  TranscribeVideoOptions,
  UpdateVideoRequestInput,
  VideoCodec,
} from './models/requests';
import type { Video, VideoList, VideoPlayData } from './models/video';
import type {
  VideoHeatmap,
  VideoResolutionsInfo,
  VideoStatistics,
  VideoStatisticsOptions,
} from './models/videoInsights';
import type { BunnyResult } from './result/BunnyResult';

import NativeBunnyStreamApi from '../specs/NativeBunnyStreamApi';

// Re-export the helpers and types so consumers can import everything from here.
export type {
  CollectionListOptions,
  VideoCollection,
  VideoCollectionList,
} from './models/collections';
export { liveStreamStatusLabel } from './models/liveStream';
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
export { LiveStreamStatusEnum } from './models/liveStream';

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

export type { BunnyError, BunnyErrorKind, BunnyResult } from './result/BunnyResult';
export { errorOrNull, fold, getOrNull, map } from './result/resultHelpers';

/**
 * Common listing options shared by `listVideos` and `listLiveStreams`.
 */
export interface ListOptions {
  /** 1-based page index. Default `1`. */
  page?: number;
  /** Page size. Default `100` for videos, API default for live streams. */
  itemsPerPage?: number;
  /** Case-insensitive title substring filter. */
  search?: string;
  /** Sort field — `"date"`, `"title"` or any value the API accepts. */
  orderBy?: string;
  /** Restrict the listing to one collection. */
  collectionId?: string;
}

/**
 * Public Bunny Stream REST API. All methods are async and return
 * {@link BunnyResult}; none throw.
 */
export const BunnyStreamApi = {
  /**
   * Whether `initialize(accessKey, libraryId)` has registered a default SDK
   * instance. Methods on this object no-op (return `InvalidState` error) when
   * this is `false`.
   */
  isInitialized(): boolean {
    return NativeBunnyStreamApi.isInitialized();
  },

  // region — VideoRepository: reading —

  /**
   * Lists videos in a library.
   *
   * @example
   * ```ts
   * const r = await BunnyStreamApi.listVideos(libraryId, { orderBy: 'title' });
   * if (r.ok) render(r.value.items);
   * ```
   */
  async listVideos(libraryId: number, opts?: ListOptions): Promise<BunnyResult<VideoList>> {
    const {
      page = 1,
      itemsPerPage = 100,
      search = null,
      orderBy = null,
      collectionId = null,
    } = opts ?? {};
    return NativeBunnyStreamApi.listVideos(
      libraryId,
      page,
      itemsPerPage,
      search,
      orderBy,
      collectionId,
    ) as Promise<BunnyResult<VideoList>>;
  },

  /**
   * Fetches one video's metadata.
   */
  async getVideo(libraryId: number, videoId: string): Promise<BunnyResult<Video>> {
    return NativeBunnyStreamApi.getVideo(libraryId, videoId) as Promise<BunnyResult<Video>>;
  },

  /**
   * Fetches everything needed to play the video: URLs plus the library's player
   * configuration. `token`/`expires` are required when the library has token
   * authentication on.
   */
  async fetchVideoPlayData(
    libraryId: number,
    videoId: string,
    token?: string | null,
    expires?: number | null,
  ): Promise<BunnyResult<VideoPlayData>> {
    return NativeBunnyStreamApi.fetchVideoPlayData(
      libraryId,
      videoId,
      token ?? null,
      expires ?? null,
    ) as Promise<BunnyResult<VideoPlayData>>;
  },

  async fetchVideoHeatmap(libraryId: number, videoId: string): Promise<BunnyResult<VideoHeatmap>> {
    return NativeBunnyStreamApi.fetchVideoHeatmap(libraryId, videoId) as Promise<
      BunnyResult<VideoHeatmap>
    >;
  },

  async fetchVideoStatistics(
    libraryId: number,
    options?: VideoStatisticsOptions,
  ): Promise<BunnyResult<VideoStatistics>> {
    return NativeBunnyStreamApi.fetchVideoStatistics(
      libraryId,
      options?.videoId ?? null,
      options?.dateFrom ?? null,
      options?.dateTo ?? null,
      options?.hourly ?? false,
    ) as Promise<BunnyResult<VideoStatistics>>;
  },

  async fetchVideoResolutions(
    libraryId: number,
    videoId: string,
  ): Promise<BunnyResult<VideoResolutionsInfo>> {
    return NativeBunnyStreamApi.fetchVideoResolutions(libraryId, videoId) as Promise<
      BunnyResult<VideoResolutionsInfo>
    >;
  },

  // endregion

  // region — VideoRepository: creating and changing —

  /**
   * Creates an empty video record that bytes are then uploaded into. Most
   * callers should use the upload module (planned) instead.
   */
  async createVideo(
    libraryId: number,
    request: CreateVideoRequestInput,
  ): Promise<BunnyResult<Video>> {
    return NativeBunnyStreamApi.createVideo(libraryId, request) as Promise<BunnyResult<Video>>;
  },

  /**
   * Applies metadata changes; `null`/`undefined` fields are left as they are.
   */
  async updateVideo(
    libraryId: number,
    videoId: string,
    request: UpdateVideoRequestInput,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.updateVideo(libraryId, videoId, request) as Promise<
      BunnyResult<void>
    >;
  },

  /**
   * Deletes the video and everything derived from it. Irreversible.
   */
  async deleteVideo(libraryId: number, videoId: string): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.deleteVideo(libraryId, videoId) as Promise<BunnyResult<void>>;
  },

  /**
   * Sets the video's thumbnail from a remote URL. Both platforms support this.
   */
  async setThumbnail(
    libraryId: number,
    videoId: string,
    thumbnailUrl: string,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.setThumbnail(libraryId, videoId, thumbnailUrl) as Promise<
      BunnyResult<void>
    >;
  },

  /**
   * Uploads a thumbnail from a local file URI (`file://` or `content://`).
   *
   * **Platform note:** Android supports this natively (writes the URI to a
   * temp file and calls `VideoRepository.uploadThumbnail`). iOS does not
   * expose a VOD `uploadThumbnail` in the generated OpenAPI client — the
   * bridge resolves with an `InvalidState` error on iOS. Use
   * {@link setThumbnail} with a remote URL on iOS.
   */
  async uploadThumbnail(
    libraryId: number,
    videoId: string,
    uri: string,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.uploadThumbnail(libraryId, videoId, uri) as Promise<
      BunnyResult<void>
    >;
  },

  /**
   * Imports a new video from a remote URL. The server starts an async fetch —
   * the returned `BunnyResult<void>` only indicates acceptance, not
   * completion. Poll {@link getVideo} for the resulting video's status.
   */
  async fetchNewVideo(options: FetchNewVideoOptions): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.fetchNewVideo(
      options.libraryId,
      options as unknown as Record<string, unknown>,
    ) as Promise<BunnyResult<void>>;
  },

  /**
   * Re-fetches an existing video's source from a remote URL.
   *
   * **Platform note:** Android supports this natively. iOS does not expose a
   * `refetchVideo` operation — the bridge falls back to `getVideo`
   * (metadata-only refresh). The `request`, `enabledResolutions`, and
   * `lowPriority` fields are ignored on iOS.
   */
  async refetchVideo(options: RefetchVideoOptions): Promise<BunnyResult<Video>> {
    return NativeBunnyStreamApi.refetchVideo(
      options.libraryId,
      options.videoId,
      options as unknown as Record<string, unknown>,
    ) as Promise<BunnyResult<Video>>;
  },

  // endregion

  // region — VideoRepository: captions —

  /**
   * Adds a caption track to a video. The caption file must be base64-encoded
   * SRT or VTT content.
   */
  async addCaption(
    libraryId: number,
    videoId: string,
    request: AddCaptionRequestInput,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.addCaption(libraryId, videoId, request) as Promise<
      BunnyResult<void>
    >;
  },

  /**
   * Deletes a caption track by language code.
   */
  async deleteCaption(
    libraryId: number,
    videoId: string,
    languageCode: string,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.deleteCaption(libraryId, videoId, languageCode) as Promise<
      BunnyResult<void>
    >;
  },

  // endregion

  // region — VideoRepository: encoding / storage —

  /**
   * Re-encodes a video using the default codec. Returns the updated video.
   */
  async reencodeVideo(libraryId: number, videoId: string): Promise<BunnyResult<Video>> {
    return NativeBunnyStreamApi.reencodeVideo(libraryId, videoId) as Promise<BunnyResult<Video>>;
  },

  /**
   * Re-encodes a video using a specific codec. Returns the updated video.
   */
  async reencodeUsingCodec(
    libraryId: number,
    videoId: string,
    codec: VideoCodec,
  ): Promise<BunnyResult<Video>> {
    return NativeBunnyStreamApi.reencodeUsingCodec(libraryId, videoId, codec) as Promise<
      BunnyResult<Video>
    >;
  },

  /**
   * Repackages a video. Returns the updated video.
   */
  async repackageVideo(
    libraryId: number,
    videoId: string,
    keepOriginalFiles = true,
  ): Promise<BunnyResult<Video>> {
    return NativeBunnyStreamApi.repackageVideo(libraryId, videoId, keepOriginalFiles) as Promise<
      BunnyResult<Video>
    >;
  },

  /**
   * Deletes resolutions from a video. **Destructive operation.**
   *
   * Callers should set `dryRun: true` on the first call to preview what would
   * be deleted before committing.
   */
  async deleteResolutions(options: DeleteResolutionsOptions): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.deleteResolutions(
      options.libraryId,
      options.videoId,
      options as unknown as Record<string, unknown>,
    ) as Promise<BunnyResult<void>>;
  },

  // endregion

  // region — VideoRepository: AI —

  /**
   * Triggers AI smart generation for a video.
   *
   * **Platform note:** Android supports this natively. iOS does not expose a
   * `smartGenerate` operation — the bridge resolves with an `InvalidState`
   * error on iOS.
   */
  async smartGenerate(
    libraryId: number,
    videoId: string,
    request: SmartGenerateRequestInput,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.smartGenerate(
      libraryId,
      videoId,
      request as unknown as Record<string, unknown>,
    ) as Promise<BunnyResult<void>>;
  },

  /**
   * Transcribes a video and optionally generates metadata (title, description,
   * chapters, moments).
   *
   * **Platform note:** `generateChapters` and `generateMoments` are
   * Android-only; they are silently ignored on iOS.
   */
  async transcribeVideo(options: TranscribeVideoOptions): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.transcribeVideo(
      options.libraryId,
      options.videoId,
      options as unknown as Record<string, unknown>,
    ) as Promise<BunnyResult<void>>;
  },

  // endregion

  // region — CollectionRepository —

  async listCollections(
    libraryId: number,
    options?: CollectionListOptions,
  ): Promise<BunnyResult<VideoCollectionList>> {
    const {
      page = 1,
      itemsPerPage = 100,
      search = null,
      orderBy = 'date',
      includeThumbnails = false,
    } = options ?? {};
    return NativeBunnyStreamApi.listCollections(
      libraryId,
      page,
      itemsPerPage,
      search,
      orderBy,
      includeThumbnails,
    ) as Promise<BunnyResult<VideoCollectionList>>;
  },

  async getCollection(
    libraryId: number,
    collectionId: string,
    includeThumbnails: boolean = false,
  ): Promise<BunnyResult<VideoCollection>> {
    return NativeBunnyStreamApi.getCollection(
      libraryId,
      collectionId,
      includeThumbnails,
    ) as Promise<BunnyResult<VideoCollection>>;
  },

  async createCollection(libraryId: number, name: string): Promise<BunnyResult<VideoCollection>> {
    return NativeBunnyStreamApi.createCollection(libraryId, name) as Promise<
      BunnyResult<VideoCollection>
    >;
  },

  async updateCollection(
    libraryId: number,
    collectionId: string,
    name: string,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.updateCollection(libraryId, collectionId, name) as Promise<
      BunnyResult<void>
    >;
  },

  async deleteCollection(libraryId: number, collectionId: string): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.deleteCollection(libraryId, collectionId) as Promise<
      BunnyResult<void>
    >;
  },

  // endregion

  // region — LiveStreamRepository: reading —

  /**
   * Lists live streams in a library. Pagination/filtering parameters are
   * optional; omit them to use the server defaults.
   */
  async listLiveStreams(
    libraryId: number,
    opts?: ListOptions,
  ): Promise<BunnyResult<LiveStreamList>> {
    const {
      page = null,
      itemsPerPage = null,
      search = null,
      orderBy = null,
      collectionId = null,
    } = opts ?? {};
    return NativeBunnyStreamApi.listLiveStreams(
      libraryId,
      page,
      itemsPerPage,
      search,
      orderBy,
      collectionId,
    ) as Promise<BunnyResult<LiveStreamList>>;
  },

  /**
   * Fetches details of a single live stream by its GUID.
   */
  async getLiveStream(libraryId: number, streamId: string): Promise<BunnyResult<LiveStream>> {
    return NativeBunnyStreamApi.getLiveStream(libraryId, streamId) as Promise<
      BunnyResult<LiveStream>
    >;
  },

  /**
   * Fetches playback data (HLS URL, controls, DRM, etc.) for a live stream.
   * `token`/`expires` are forwarded for token-authenticated libraries.
   */
  async fetchLiveStreamPlayData(
    libraryId: number,
    streamId: string,
    token?: string | null,
    expires?: number | null,
  ): Promise<BunnyResult<LiveStreamPlayData>> {
    return NativeBunnyStreamApi.fetchLiveStreamPlayData(
      libraryId,
      streamId,
      token ?? null,
      expires ?? null,
    ) as Promise<BunnyResult<LiveStreamPlayData>>;
  },

  // endregion

  // region — LiveStreamRepository: creating and changing —

  /**
   * Creates a new live stream. Returns the freshly-created stream so the caller
   * can surface the assigned `id`/`streamKey` without a follow-up `get`.
   */
  async createLiveStream(
    libraryId: number,
    request: LiveStreamCreateRequestInput,
  ): Promise<BunnyResult<LiveStream>> {
    return NativeBunnyStreamApi.createLiveStream(libraryId, request) as Promise<
      BunnyResult<LiveStream>
    >;
  },

  /**
   * Updates an existing live stream. Only non-null fields in `request` are sent
   * to the server; the API treats missing fields as "leave unchanged".
   */
  async updateLiveStream(
    libraryId: number,
    streamId: string,
    request: LiveStreamCreateRequestInput,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.updateLiveStream(libraryId, streamId, request) as Promise<
      BunnyResult<void>
    >;
  },

  /**
   * Permanently deletes a live stream. The stream cannot be recovered, but any
   * recorded VOD remains in the library.
   */
  async deleteLiveStream(libraryId: number, streamId: string): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.deleteLiveStream(libraryId, streamId) as Promise<BunnyResult<void>>;
  },

  /**
   * Marks the stream as started (PREVIEW → RUNNING). Call once the RTMP encoder
   * is connected and the stream is in `PREVIEW`. Pure REST call — does not
   * capture or publish video from the device camera.
   */
  async startLiveStream(libraryId: number, streamId: string): Promise<BunnyResult<LiveStream>> {
    return NativeBunnyStreamApi.startLiveStream(libraryId, streamId) as Promise<
      BunnyResult<LiveStream>
    >;
  },

  /**
   * Stops the stream (RUNNING → ENDED). The ingest server cuts the publish, and
   * with `recordVod` enabled the stream is converted to a VOD. Cannot be undone.
   */
  async stopLiveStream(libraryId: number, streamId: string): Promise<BunnyResult<LiveStream>> {
    return NativeBunnyStreamApi.stopLiveStream(libraryId, streamId) as Promise<
      BunnyResult<LiveStream>
    >;
  },

  async getLiveStreamStatus(
    libraryId: number,
    streamId: string,
  ): Promise<BunnyResult<LiveStreamIngestStatus>> {
    return NativeBunnyStreamApi.getLiveStreamStatus(libraryId, streamId) as Promise<
      BunnyResult<LiveStreamIngestStatus>
    >;
  },

  async setLiveStreamThumbnail(
    libraryId: number,
    streamId: string,
    thumbnailUrl: string,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.setLiveStreamThumbnail(
      libraryId,
      streamId,
      thumbnailUrl,
    ) as Promise<BunnyResult<void>>;
  },

  /**
   * Uploads a local image without moving its bytes through JavaScript. File URIs
   * are supported on both platforms; Android also accepts content URIs. Images
   * larger than 20 MB are rejected by the native bridge.
   */
  async uploadLiveStreamThumbnail(
    libraryId: number,
    streamId: string,
    uri: string,
    contentType: LiveStreamThumbnailContentType = 'image/jpeg',
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.uploadLiveStreamThumbnail(
      libraryId,
      streamId,
      uri,
      contentType,
    ) as Promise<BunnyResult<void>>;
  },

  async listLiveStreamThumbnails(
    libraryId: number,
    streamId: string,
    options?: LiveStreamThumbnailListOptions,
  ): Promise<BunnyResult<LiveStreamThumbnail[]>> {
    return NativeBunnyStreamApi.listLiveStreamThumbnails(
      libraryId,
      streamId,
      options?.limit ?? null,
      options?.from ?? null,
      options?.to ?? null,
    ) as Promise<BunnyResult<LiveStreamThumbnail[]>>;
  },

  async deleteLiveStreamThumbnail(
    libraryId: number,
    streamId: string,
    restoreLibraryDefault: boolean = false,
  ): Promise<BunnyResult<void>> {
    return NativeBunnyStreamApi.deleteLiveStreamThumbnail(
      libraryId,
      streamId,
      restoreLibraryDefault,
    ) as Promise<BunnyResult<void>>;
  },

  // endregion

  // region — Player settings —

  /**
   * Fetches the library's player configuration for one video, including any
   * per-video overrides. Used to enrich a video list with thumbnail URLs —
   * `thumbnailUrl` on the result is the CDN URL of the video's poster image.
   *
   * `token`/`expires` are required when the library has token authentication on.
   */
  async fetchPlayerSettings(
    libraryId: number,
    videoId: string,
    token?: string | null,
    expires?: number | null,
  ): Promise<BunnyResult<PlayerSettings>> {
    return NativeBunnyStreamApi.fetchPlayerSettings(
      libraryId,
      videoId,
      token ?? null,
      expires ?? null,
    ) as Promise<BunnyResult<PlayerSettings>>;
  },

  // endregion

  // region — Token auth —

  /**
   * Generates a Bunny Stream embed / play-data token for token-authenticated
   * libraries: `SHA256_HEX(tokenAuthKey + videoId + expires)`.
   *
   * `expires` is a UNIX timestamp in **seconds**. For a live stream, pass the
   * stream GUID as `videoId`.
   *
   * DEBUG / demo helper only. Bunny's docs are explicit that the token security
   * key must never be embedded in a client app — generate tokens server-side in
   * production. This exists so the sample app can play token-authenticated
   * streams without standing up a backend.
   */
  generateEmbedToken(tokenAuthKey: string, videoId: string, expires: number): string {
    return NativeBunnyStreamApi.generateEmbedToken(tokenAuthKey, videoId, expires);
  },

  /**
   * Convenience: when `tokenAuthKey` is non-blank, signs a token expiring
   * `ttlSeconds` from now and returns `{ token, expires }`. Returns
   * `{ token: null, expires: null }` when token auth is off (blank key).
   */
  signPlaybackToken(
    tokenAuthKey: string,
    videoId: string,
    ttlSeconds: number = 3600,
  ): { token: string | null; expires: number | null } {
    if (!tokenAuthKey) return { token: null, expires: null };
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    return { token: BunnyStreamApi.generateEmbedToken(tokenAuthKey, videoId, expires), expires };
  },

  // endregion
};
