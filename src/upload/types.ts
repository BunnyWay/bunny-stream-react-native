import type { BunnyError } from '../api/result/BunnyResult';

/** Upload transport strategy. */
export type UploadMode = 'basic' | 'tus';

/** Normalized pause/resume capability reported per upload. */
export type UploadPauseSupport = 'unsupported' | 'supported';

/** Discriminated union of all upload lifecycle events. */
export type UploadEvent =
  | { type: 'started'; uploadId: string; videoId: string }
  | {
      type: 'progress';
      uploadId: string;
      videoId: string;
      bytesUploaded: number;
      totalBytes: number;
      /** 0..1 */
      progress: number;
      pauseSupported: UploadPauseSupport;
    }
  | { type: 'paused'; uploadId: string; videoId: string }
  | { type: 'completed'; uploadId: string; videoId: string }
  | { type: 'cancelled'; uploadId: string; videoId: string }
  | { type: 'failed'; uploadId: string; videoId: string | null; error: BunnyError };

/** Snapshot of an upload's current state, returned by `getUploadState`. */
export type UploadState =
  | {
      status: 'uploading';
      videoId: string;
      bytesUploaded: number;
      totalBytes: number;
      progress: number;
    }
  | {
      status: 'paused';
      videoId: string;
      bytesUploaded: number;
      totalBytes: number;
      progress: number;
    }
  | { status: 'completed'; videoId: string }
  | { status: 'cancelled'; videoId: string }
  | { status: 'failed'; videoId: string | null; error: BunnyError };

/** Options for starting a new upload. */
export interface StartUploadOptions {
  libraryId: number;
  /** Local file URI (`file://` or `content://` on Android, `file://` on iOS). */
  uri: string;
  title?: string;
  collectionId?: string;
  mode?: UploadMode;
}

/** Options for continuing a TUS upload after interruption. */
export interface ContinueUploadOptions {
  libraryId: number;
  videoId: string;
  uri: string;
  mode?: UploadMode;
}

/** Result of starting or continuing an upload. */
export interface UploadHandle {
  uploadId: string;
}
