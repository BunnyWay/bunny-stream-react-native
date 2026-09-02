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
  BunnyResult,
  CreateVideoRequestInput,
  LiveStream,
  LiveStreamCreateRequestInput,
  LiveStreamList,
  LiveStreamPlayData,
  PlayerSettings,
  UpdateVideoRequestInput,
  Video,
  VideoList,
  VideoPlayData,
} from './types';

import NativeBunnyStreamApi from '../specs/NativeBunnyStreamApi';

// Re-export the helpers and types so consumers can import everything from here.
export {
  errorOrNull,
  fold,
  getOrNull,
  liveStreamStatusLabel,
  map,
  videoStatusLabel,
} from './types';

export type {
  BunnyError,
  BunnyErrorKind,
  BunnyResult,
  Caption,
  Chapter,
  CreateVideoRequestInput,
  LiveStream,
  LiveStreamCreateRequestInput,
  LiveStreamList,
  LiveStreamPlayData,
  LiveStreamStatus,
  MetaTag,
  PlayerSettings,
  Moment,
  RtmpOutput,
  UpdateVideoRequestInput,
  Video,
  VideoList,
  VideoPlayData,
  VideoStatus,
} from './types';

export { LiveStreamStatusEnum, TRANSITIONAL_VIDEO_STATUSES, VideoStatusEnum } from './types';

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
    return NativeBunnyStreamApi.listVideos(
      libraryId,
      opts?.page ?? 1,
      opts?.itemsPerPage ?? 100,
      opts?.search ?? null,
      opts?.orderBy ?? null,
      opts?.collectionId ?? null,
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
    return NativeBunnyStreamApi.listLiveStreams(
      libraryId,
      opts?.page ?? null,
      opts?.itemsPerPage ?? null,
      opts?.search ?? null,
      opts?.orderBy ?? null,
      opts?.collectionId ?? null,
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
