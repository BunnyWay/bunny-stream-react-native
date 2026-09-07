export interface UseBunnyImageResult {
  /**
   * Resolved data URI for Bunny CDN URLs or the original non-Bunny URL.
   * Undefined while loading or after an error.
   */
  uri: string | undefined;
  /** Whether the Bunny CDN image is being fetched. */
  loading: boolean;
  /** The fetch failure, when present. */
  error: Error | undefined;
}
