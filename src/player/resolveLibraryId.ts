import type { PlayerErrorEvent } from './BunnyStreamPlayer.types';

import { getConfiguredLibraryId } from '../config/initialize';
import { validateLibraryId } from '../config/validation';

type LibraryIdResolution = { ok: true; libraryId: number } | { ok: false; error: PlayerErrorEvent };

export function resolveLibraryId(sourceLibraryId: number | undefined): LibraryIdResolution {
  const libraryId = sourceLibraryId ?? getConfiguredLibraryId();
  if (libraryId === undefined) {
    return {
      ok: false,
      error: {
        code: 'MISSING_LIBRARY_ID',
        message:
          'BunnyStreamPlayer: provide source.libraryId or call initialize() before mounting the player.',
      },
    };
  }

  try {
    validateLibraryId(libraryId);
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_LIBRARY_ID',
        message: `BunnyStreamPlayer: libraryId must be a positive integer; received ${String(libraryId)}.`,
      },
    };
  }

  return { ok: true, libraryId };
}
