export const BUNNY_ACCESS_KEY = process.env.EXPO_PUBLIC_BUNNY_ACCESS_KEY ?? '';
export const BUNNY_LIBRARY_ID = Number(process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID ?? '') || 0;

export const isConfigured = BUNNY_ACCESS_KEY.length > 0 && BUNNY_LIBRARY_ID > 0;
