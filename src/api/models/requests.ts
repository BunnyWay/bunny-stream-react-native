import type { RtmpOutput } from './liveStream';
import type { Chapter, MetaTag, Moment } from './video';

/**
 * Creates an empty video record that bytes are then uploaded into.
 *
 * Mirrors `net.bunny.api.video.domain.model.CreateVideoRequest`.
 */
export interface CreateVideoRequestInput {
  title: string;
  collectionId?: string | null;
  thumbnailTime?: number | null;
}

/**
 * Changes to apply to an existing video. `undefined`/`null` leaves a field as
 * it is; an empty list clears it. Mirrors `UpdateVideoRequest`.
 */
export interface UpdateVideoRequestInput {
  title?: string | null;
  collectionId?: string | null;
  chapters?: Chapter[] | null;
  moments?: Moment[] | null;
  metaTags?: MetaTag[] | null;
}

/**
 * Request to fetch (import) a video from a remote URL.
 *
 * The server downloads the video from `url` and creates a new video entry.
 * Optional `headers` are sent with the server's download request.
 * Mirrors `net.bunny.api.video.domain.model.FetchVideoRequest`.
 */
export interface FetchVideoRequestInput {
  url: string;
  headers?: Record<string, string> | null;
  title?: string | null;
}

/**
 * Options for `fetchNewVideo`. The server starts an async fetch from the
 * remote URL — the returned `BunnyResult<void>` only indicates that the
 * fetch was accepted, not that it completed. Poll `getVideo` for the
 * resulting video's status.
 */
export interface FetchNewVideoOptions {
  libraryId: number;
  request: FetchVideoRequestInput;
  collectionId?: string | null;
  thumbnailTime?: number | null;
}

/**
 * Options for `refetchVideo`. Re-downloads an existing video's source from
 * the remote URL. Android supports this natively; iOS falls back to
 * `getVideo` (metadata-only refresh) because the generated OpenAPI client
 * does not expose a `refetchVideo` operation.
 */
export interface RefetchVideoOptions {
  libraryId: number;
  videoId: string;
  request: FetchVideoRequestInput;
  collectionId?: string | null;
  enabledResolutions?: string[] | null;
  lowPriority?: boolean | null;
  thumbnailTime?: number | null;
}

/**
 * Writable subset of {@link LiveStream} used to create or update live streams.
 *
 * All fields are nullable so callers can update only the fields they want —
 * `null`/`undefined` values are not sent to the server. Mirrors
 * `LiveStreamCreateRequest`.
 */
export interface LiveStreamCreateRequestInput {
  title?: string | null;
  description?: string | null;
  collectionId?: string | null;
  isPublic?: boolean | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  dvrEnabled?: boolean | null;
  dvrWindowSeconds?: number | null;
  recordVod?: boolean | null;
  enableCountdown?: boolean | null;
  preStreamTrailerVideoId?: string | null;
  rtmpOutputs?: RtmpOutput[] | null;
}

// region — Captions

/**
 * Request to add a caption track to a video.
 *
 * `captionsFileBase64` must be a base64-encoded SRT or VTT file. On iOS the
 * bridge maps this to `CaptionModelAdd.captionsFile`; on Android it maps to
 * `AddCaptionRequest.captionsFileBase64`.
 *
 * Mirrors `net.bunny.api.video.domain.model.AddCaptionRequest`.
 */
export interface AddCaptionRequestInput {
  /** BCP-47 language code (e.g. `"en"`, `"es"`). */
  languageCode: string;
  /** Human-readable label shown in the player's caption picker. */
  label: string;
  /** Base64-encoded SRT or VTT caption file content. */
  captionsFileBase64: string;
}

// endregion

// region — Encoding / Storage

/** Codec identifier for `reencodeUsingCodec`. */
export type VideoCodec = 'h264' | 'vp9' | 'hevc' | 'av1';

/**
 * Options for `deleteResolutions`.
 *
 * **Destructive operation.** `dryRun` defaults to `false` on the native side;
 * callers should explicitly set `dryRun: true` on the first call to preview
 * what would be deleted.
 */
export interface DeleteResolutionsOptions {
  libraryId: number;
  videoId: string;
  /** Resolution identifiers to delete (e.g. `["720p", "1080p"]`). */
  resolutions: string[];
  /** Also delete resolutions not in the library's configured set. */
  deleteNonConfiguredResolutions?: boolean | null;
  /** Delete the MP4 render files for the selected resolutions. */
  deleteMp4Files?: boolean | null;
  /** Delete the original uploaded source file. */
  deleteOriginal?: boolean | null;
  /**
   * Delete all resolutions. Android-only; iOS does not expose this flag.
   * Ignored on iOS.
   */
  deleteAllResolutions?: boolean | null;
  /**
   * Preview what would be deleted without actually deleting. Callers should
   * set this to `true` on the first call to verify before committing.
   */
  dryRun?: boolean | null;
}

// endregion

// region — AI

/**
 * Request to trigger AI smart generation for a video.
 *
 * **Platform note:** Android supports this natively. iOS does not expose a
 * `smartGenerate` operation in the generated OpenAPI client — the bridge
 * resolves with an `InvalidState` error on iOS.
 *
 * Mirrors `net.bunny.api.video.domain.model.SmartGenerateRequest`.
 */
export interface SmartGenerateRequestInput {
  generateTitle?: boolean | null;
  generateDescription?: boolean | null;
  generateChapters?: boolean | null;
  generateMoments?: boolean | null;
  sourceLanguage?: string | null;
}

/**
 * Request to transcribe a video and optionally generate metadata.
 *
 * Mirrors `net.bunny.api.video.domain.model.TranscribeVideoRequest`.
 * On iOS, `generateChapters` and `generateMoments` are not part of the
 * generated `TranscribeSettings` schema and are silently ignored.
 */
export interface TranscribeVideoRequestInput {
  targetLanguages?: string[] | null;
  generateTitle?: boolean | null;
  generateDescription?: boolean | null;
  /** Android-only; ignored on iOS. */
  generateChapters?: boolean | null;
  /** Android-only; ignored on iOS. */
  generateMoments?: boolean | null;
  sourceLanguage?: string | null;
}

/**
 * Options for `transcribeVideo`.
 */
export interface TranscribeVideoOptions {
  libraryId: number;
  videoId: string;
  request: TranscribeVideoRequestInput;
  /** Force re-transcription even if a transcript already exists. */
  force?: boolean | null;
}

// endregion
