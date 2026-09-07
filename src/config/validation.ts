export function validateAccessKey(accessKey: string): void {
  if (!accessKey || accessKey.trim().length === 0) {
    throw new Error('initialize: accessKey must be a non-empty string (SDK 4.0.0 requirement)');
  }
}

export function validateLibraryId(libraryId: number): void {
  if (!Number.isFinite(libraryId) || libraryId <= 0 || libraryId % 1 !== 0) {
    throw new Error('initialize: libraryId must be a positive integer');
  }
}
