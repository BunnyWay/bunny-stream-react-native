import type { BunnyResult } from '../api/result/BunnyResult';
import type {
  ContinueUploadOptions,
  StartUploadOptions,
  UploadEvent,
  UploadHandle,
  UploadMode,
  UploadState,
} from './types';

import { NativeEventEmitter } from 'react-native';

import NativeBunnyStreamUpload from '../specs/NativeBunnyStreamUpload';

/**
 * Public video upload API.
 *
 * Uploads are identified by an `uploadId` string returned from
 * {@link startUpload} and {@link continueUpload}. Progress and lifecycle
 * events are delivered through {@link addUploadListener} — the native side
 * emits `bunnyStreamUploadEvent` events via `RCTDeviceEventEmitter`.
 *
 * Platform notes:
 *
 * - **Android basic**: pause/resume are no-ops; `continueUpload` returns
 *   `InvalidState`. The SDK does not run a foreground service — uploads
 *   survive navigation but not process death.
 * - **Android TUS**: pause/resume/cancel work; `continueUpload` resumes.
 *   Progress is persisted per-library but the upload still does not survive
 *   process death without a host foreground service.
 * - **iOS basic**: pause/resume work via `URLSessionTask.suspend/resume`.
 *   Uploads do not survive process death.
 * - **iOS TUS**: pause/resume/cancel work. Uploads survive process death via
 *   a background `URLSession`; call {@link restoreUploads} after app launch
 *   to reattach to in-flight TUS uploads.
 *
 * All control methods resolve with a {@link BunnyResult} envelope
 * (`{ ok: true, value }` / `{ ok: false, error }`) rather than throwing.
 */
export const BunnyStreamUpload = {
  /**
   * Starts a new upload. The native SDK creates the video entry internally
   * and returns an `uploadId`.
   *
   * @param options Library, local file URI, optional title/collection/mode.
   * @returns `BunnyResult<UploadHandle>` — the `uploadId` identifies this
   *   upload for pause/resume/cancel and event correlation.
   */
  async startUpload(options: StartUploadOptions): Promise<BunnyResult<UploadHandle>> {
    return NativeBunnyStreamUpload.startUpload(
      options.libraryId,
      options.uri,
      options.title ?? null,
      options.collectionId ?? null,
      options.mode ?? 'basic',
    ) as Promise<BunnyResult<UploadHandle>>;
  },

  /**
   * Continues a previously interrupted TUS upload. On the basic uploader
   * this resolves with an `InvalidState` error.
   *
   * @param options Library, existing `videoId`, local file URI, optional mode.
   * @returns `BunnyResult<UploadHandle>` — a new `uploadId` for the resumed
   *   transfer.
   */
  async continueUpload(options: ContinueUploadOptions): Promise<BunnyResult<UploadHandle>> {
    return NativeBunnyStreamUpload.continueUpload(
      options.libraryId,
      options.videoId,
      options.uri,
      options.mode ?? 'tus',
    ) as Promise<BunnyResult<UploadHandle>>;
  },

  /** Pauses an in-flight upload. No-op on Android basic. */
  async pauseUpload(uploadId: string): Promise<BunnyResult<void>> {
    return NativeBunnyStreamUpload.pauseUpload(uploadId) as Promise<BunnyResult<void>>;
  },

  /** Resumes a paused upload. No-op on Android basic. */
  async resumeUpload(uploadId: string): Promise<BunnyResult<void>> {
    return NativeBunnyStreamUpload.resumeUpload(uploadId) as Promise<BunnyResult<void>>;
  },

  /** Cancels an upload and releases its native resources. */
  async cancelUpload(uploadId: string): Promise<BunnyResult<void>> {
    return NativeBunnyStreamUpload.cancelUpload(uploadId) as Promise<BunnyResult<void>>;
  },

  /**
   * Returns the current snapshot state of an upload, or `null` when the
   * `uploadId` is unknown or already evicted.
   */
  async getUploadState(uploadId: string): Promise<BunnyResult<UploadState | null>> {
    return NativeBunnyStreamUpload.getUploadState(uploadId) as Promise<
      BunnyResult<UploadState | null>
    >;
  },

  /**
   * Subscribes to upload lifecycle events. Returns an unsubscribe function.
   *
   * Events are emitted by the native side as `bunnyStreamUploadEvent` and
   * carry the {@link UploadEvent} payload.
   *
   * @example
   * ```ts
   * const unsubscribe = BunnyStreamUpload.addUploadListener((event) => {
   *   if (event.type === 'progress') {
   *     console.log(`${event.uploadId}: ${Math.round(event.progress * 100)}%`);
   *   }
   * });
   * ```
   */
  addUploadListener(listener: (event: UploadEvent) => void): () => void {
    const emitter = new NativeEventEmitter(NativeBunnyStreamUpload);
    const subscription = emitter.addListener('bunnyStreamUploadEvent', listener);
    return () => subscription.remove();
  },

  /**
   * Reattaches to in-flight TUS uploads after an app relaunch.
   *
   * On iOS TUS, the background `URLSession` persists uploads across process
   * death. Call this once during app startup (after `initialize`) to restore
   * the tracker and resume pending transfers. On Android and on the basic
   * uploader this is a no-op.
   */
  restoreUploads(): void {
    // Android is a native no-op (in-process uploads can't survive process
    // death). Kept platform-agnostic so callers don't need a Platform check.
    NativeBunnyStreamUpload.restoreUploads();
  },
};

/** Re-exported for callers who want to narrow the mode at the type level. */
export type { UploadMode };
