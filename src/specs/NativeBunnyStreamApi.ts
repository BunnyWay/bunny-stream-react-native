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
 * `src/api/types.ts` and `src/api/BunnyStreamApi.ts`.
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

  // — VideoRepository: creating and changing —
  createVideo(libraryId: Double, request: Object): Promise<Object>;

  updateVideo(libraryId: Double, videoId: string, request: Object): Promise<Object>;

  deleteVideo(libraryId: Double, videoId: string): Promise<Object>;

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
