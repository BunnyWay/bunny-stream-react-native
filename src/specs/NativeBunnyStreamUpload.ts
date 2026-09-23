/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the upper-cased `Object` type for ReadableMap-typed Promise returns; the lowercase `object` is rejected by the RN codegen parser. */
import type { TurboModule } from 'react-native';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';

import { TurboModuleRegistry } from 'react-native';

/**
 * TurboModule bridging the Bunny Stream video uploader to JS.
 *
 * Uploads are identified by an `uploadId` string returned from
 * {@link startUpload} / {@link continueUpload}. Progress, completion, and
 * failure are delivered as events through the React Native device event
 * emitter under the `bunnyStreamUploadEvent` name. Each event payload carries
 * the `uploadId` so JS can correlate it with the handle returned at start.
 *
 * Control methods ({@link pauseUpload}, {@link resumeUpload},
 * {@link cancelUpload}) resolve with a `BunnyResult`-shaped envelope
 * (`{ ok: true, value: null }` / `{ ok: false, error }`) rather than
 * rejecting — the typed error taxonomy stays available to the JS caller.
 *
 * Codegen limitation: sealed result types and structured payloads are mapped
 * to plain `Object` here; the idiomatic TypeScript surface lives in
 * `src/api/models/upload.ts` and `src/api/BunnyStreamUpload.ts`.
 */
export interface Spec extends TurboModule {
  // — Upload lifecycle —

  /**
   * Starts a new upload. Returns `{ ok: true, value: { uploadId } }` or
   * `{ ok: false, error }`.
   *
   * `mode` is `"basic"` or `"tus"`. `title` and `collectionId` are optional;
   * when omitted, the native SDK derives the title from the file name.
   */
  startUpload(
    libraryId: Double,
    uri: string,
    title: string | null,
    collectionId: string | null,
    mode: string,
  ): Promise<Object>;

  /**
   * Continues a previously interrupted TUS upload. Returns a new `uploadId`.
   * On the basic uploader this resolves with an `InvalidState` error.
   */
  continueUpload(libraryId: Double, videoId: string, uri: string, mode: string): Promise<Object>;

  /** Pauses an in-flight upload. No-op on the basic uploader (Android). */
  pauseUpload(uploadId: string): Promise<Object>;

  /** Resumes a paused upload. No-op on the basic uploader (Android). */
  resumeUpload(uploadId: string): Promise<Object>;

  /** Cancels an upload and releases its resources. */
  cancelUpload(uploadId: string): Promise<Object>;

  /**
   * Returns the current snapshot state of an upload, or `null` when the
   * `uploadId` is unknown / already completed and evicted.
   */
  getUploadState(uploadId: string): Promise<Object>;

  // — Event subscription —

  /**
   * Adds a JS listener for upload events. The native side emits events
   * through `RCTDeviceEventEmitter` with name `bunnyStreamUploadEvent`.
   * Returns the number of active listeners (for cleanup).
   */
  addListener(eventName: string): void;

  /** Removes a JS listener. */
  removeListeners(count: Double): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BunnyStreamUpload');
