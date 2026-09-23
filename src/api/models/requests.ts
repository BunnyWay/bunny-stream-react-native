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
