/**
 * Normalizes the access key for `initialize`: `null`/`undefined` and blank
 * strings become `''` (playback-only mode — public videos need no key; the
 * management API, uploads, and broadcasting do).
 */
export function normalizeAccessKey(accessKey: string | null | undefined): string {
  return accessKey?.trim() ?? '';
}

export function validateLibraryId(libraryId: number): void {
  if (!Number.isFinite(libraryId) || libraryId <= 0 || libraryId % 1 !== 0) {
    throw new Error('initialize: libraryId must be a positive integer');
  }
}
