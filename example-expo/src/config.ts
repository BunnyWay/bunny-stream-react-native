export const BUNNY_ACCESS_KEY = (process.env.EXPO_PUBLIC_BUNNY_ACCESS_KEY ?? '').trim();
export const BUNNY_LIBRARY_ID = Number(process.env.EXPO_PUBLIC_BUNNY_LIBRARY_ID ?? '');

export const isConfigured =
  BUNNY_ACCESS_KEY.length > 0 && Number.isInteger(BUNNY_LIBRARY_ID) && BUNNY_LIBRARY_ID > 0;
