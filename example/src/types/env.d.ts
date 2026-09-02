declare module '@env' {
  export const BUNNY_ACCESS_KEY: string;
  export const BUNNY_LIBRARY_ID: string;
  // Comma-separated list of video IDs (e.g. "id1,id2,id3")
  export const BUNNY_VIDEO_IDS: string;
  // Legacy single video ID (kept for backwards compatibility)
  export const BUNNY_VIDEO_ID: string;
  // Token authentication key (optional — only for token-authenticated libraries)
  // Reuses BUNNY_ACCESS_KEY for token signing when token auth is enabled.
}
