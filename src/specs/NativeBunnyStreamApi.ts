/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the upper-cased `Object` type for ReadableMap-typed Promise returns; the lowercase `object` is rejected by the RN codegen parser. */
import type { TurboModule } from 'react-native';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';

import { TurboModuleRegistry } from 'react-native';

/**
 * TurboModule bridging the Bunny Stream REST API (`net.bunny:api`) to JS.
 *
 * Every method returns a Promise that resolves with a {@link BunnyResult}-shaped
 * envelope (`{ ok: true, value }` on success, `{ ok: false, error }` on failure)
 * rather than throwing — the typed error taxonomy (terminal vs transient, Auth
 * vs NotFound vs Network) is first-class information for the caller and would be
 * lost behind a `catch (e)` if the bridge threw.
 *
 * The module reaches the SDK through `BunnyStreamApi.getInstance()`, the same
 * instance that {@link NativeBunnyStreamPlayer.initialize} registered. Call
 * `initialize(accessKey, libraryId)` before any API method.
 *
 * Codegen limitation: sealed result types and nullable primitives are mapped to
 * plain `Object` here; the idiomatic TypeScript surface lives in
 * `src/api/models`, `src/api/result`, and `src/api/BunnyStreamApi.ts`.
 */
export interface Spec extends TurboModule {
  // — SDK status —
  isInitialized(): boolean;

  // — VideoRepository: reading —
  listVideos(
    libraryId: Double,
    page: Double,
    itemsPerPage: Double,
    search: string | null,
    orderBy: string | null,
    collectionId: string | null,
  ): Promise<Object>;

  getVideo(libraryId: Double, videoId: string): Promise<Object>;

  fetchVideoPlayData(
    libraryId: Double,
    videoId: string,
    token: string | null,
    expires: Double | null,
  ): Promise<Object>;

  fetchVideoHeatmap(libraryId: Double, videoId: string): Promise<Object>;

  fetchVideoStatistics(
    libraryId: Double,
    videoId: string | null,
    dateFrom: string | null,
    dateTo: string | null,
    hourly: boolean,
  ): Promise<Object>;

  fetchVideoResolutions(libraryId: Double, videoId: string): Promise<Object>;

  // TODO(iOS SDK): Add heatmap play data and detailed storage-size methods after
  // both endpoints are exposed by the public generated or domain API.

  // — VideoRepository: creating and changing —
  createVideo(libraryId: Double, request: Object): Promise<Object>;

  updateVideo(libraryId: Double, videoId: string, request: Object): Promise<Object>;

  deleteVideo(libraryId: Double, videoId: string): Promise<Object>;

  // — CollectionRepository —
  listCollections(
    libraryId: Double,
    page: Double,
    itemsPerPage: Double,
    search: string | null,
    orderBy: string,
    includeThumbnails: boolean,
  ): Promise<Object>;

  getCollection(
    libraryId: Double,
    collectionId: string,
    includeThumbnails: boolean,
  ): Promise<Object>;

  createCollection(libraryId: Double, name: string): Promise<Object>;

  updateCollection(libraryId: Double, collectionId: string, name: string): Promise<Object>;

  deleteCollection(libraryId: Double, collectionId: string): Promise<Object>;

  // — LiveStreamRepository: reading —
  listLiveStreams(
    libraryId: Double,
    page: Double | null,
    itemsPerPage: Double | null,
    search: string | null,
    orderBy: string | null,
    collectionId: string | null,
  ): Promise<Object>;

  getLiveStream(libraryId: Double, streamId: string): Promise<Object>;

  fetchLiveStreamPlayData(
    libraryId: Double,
    streamId: string,
    token: string | null,
    expires: Double | null,
  ): Promise<Object>;

  // — LiveStreamRepository: creating and changing —
  createLiveStream(libraryId: Double, request: Object): Promise<Object>;

  updateLiveStream(libraryId: Double, streamId: string, request: Object): Promise<Object>;

  deleteLiveStream(libraryId: Double, streamId: string): Promise<Object>;

  // — LiveStreamRepository: lifecycle —
  // Marks the stream as started (PREVIEW → RUNNING). Call once the RTMP encoder
  // is connected. Pure REST call — does not capture or publish video.
  startLiveStream(libraryId: Double, streamId: string): Promise<Object>;

  // Stops the stream (RUNNING → ENDED). The ingest server cuts the publish, and
  // with `recordVod` the stream is converted to a VOD. Cannot be undone.
  stopLiveStream(libraryId: Double, streamId: string): Promise<Object>;

  // — LiveStreamRepository: operational state and thumbnails —
  getLiveStreamStatus(libraryId: Double, streamId: string): Promise<Object>;

  setLiveStreamThumbnail(
    libraryId: Double,
    streamId: string,
    thumbnailUrl: string,
  ): Promise<Object>;

  uploadLiveStreamThumbnail(
    libraryId: Double,
    streamId: string,
    uri: string,
    contentType: string,
  ): Promise<Object>;

  listLiveStreamThumbnails(
    libraryId: Double,
    streamId: string,
    limit: Double | null,
    from: string | null,
    to: string | null,
  ): Promise<Object>;

  deleteLiveStreamThumbnail(
    libraryId: Double,
    streamId: string,
    restoreLibraryDefault: boolean,
  ): Promise<Object>;

  // — Player settings (thumbnail enrichment) —
  fetchPlayerSettings(
    libraryId: Double,
    videoId: string,
    token: string | null,
    expires: Double | null,
  ): Promise<Object>;

  // — Token auth helper —
  // Synchronous: returns SHA256_HEX(tokenAuthKey + videoId + expires).
  // expires is a UNIX timestamp in seconds.
  generateEmbedToken(tokenAuthKey: string, videoId: string, expires: Double): string;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BunnyStreamApi');
