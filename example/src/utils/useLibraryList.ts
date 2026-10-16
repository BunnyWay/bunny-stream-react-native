import * as React from 'react';

import { fold, type BunnyResult } from '@bunny.net/stream-react-native';

import { loadLibraryConfig } from '../storage/settings';

type ListUiState<T> =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; items: T[] }
  | { kind: 'unconfigured' }
  | { kind: 'error'; message: string };

/**
 * Shared "list library content" flow for the VOD and live-stream list
 * screens: loads the stored library config (→ `unconfigured` when missing),
 * fetches the list, and maps the result to a UI state. The resolved library
 * credentials are returned alongside so the screen can sign playback tokens
 * or issue follow-up API calls.
 *
 * `fetchList` must be referentially stable (wrap it in `useCallback`) — it
 * feeds `reload`'s deps, and an unstable fetcher would re-arm the
 * focus/polling effects every render.
 */
export function useLibraryList<T>(
  fetchList: (libraryId: number) => Promise<BunnyResult<{ items: T[] }>>,
) {
  const [uiState, setUiState] = React.useState<ListUiState<T>>({ kind: 'loading' });
  const [libraryId, setLibraryId] = React.useState<number | null>(null);
  const [accessKey, setAccessKey] = React.useState('');

  const setError = React.useCallback(
    (message: string) => setUiState({ kind: 'error', message }),
    [],
  );

  const reload = React.useCallback(async () => {
    const { libraryId: libId, accessKey } = await loadLibraryConfig();
    if (libId == null || !accessKey.trim()) {
      setUiState({ kind: 'unconfigured' });
      return;
    }
    setLibraryId(libId);
    // The configured key doubles as the token-auth signing key in this demo.
    setAccessKey(accessKey);

    setUiState((prev) => (prev.kind === 'loaded' ? prev : { kind: 'loading' }));
    const result = await fetchList(libId);
    fold(
      result,
      (list) =>
        setUiState(
          list.items.length === 0 ? { kind: 'empty' } : { kind: 'loaded', items: list.items },
        ),
      (error) => setUiState({ kind: 'error', message: error.message }),
    );
  }, [fetchList]);

  return { uiState, setError, libraryId, accessKey, reload };
}
