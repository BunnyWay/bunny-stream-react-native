import type { Video } from 'bunny-stream-react-native';

import {
  BunnyStreamApi,
  errorOrNull,
  getOrNull,
  videoStatusLabel,
  VideoStatusEnum,
} from 'bunny-stream-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type UiState =
  { kind: 'loading' } | { kind: 'loaded'; videos: Video[] } | { kind: 'error'; message: string };

function isPlayable(video: Video): boolean {
  return (
    video.status === VideoStatusEnum.FINISHED ||
    video.status === VideoStatusEnum.JIT_PLAYLISTS_CREATED
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VideoListScreen({
  libraryId,
  onSelect,
}: {
  libraryId: number;
  onSelect: (video: Video) => void;
}) {
  const [uiState, setUiState] = useState<UiState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await BunnyStreamApi.listVideos(libraryId, {
      orderBy: 'date',
    });
    const list = getOrNull(result);
    if (list) {
      setUiState({ kind: 'loaded', videos: list.items });
    } else {
      const err = errorOrNull(result);
      setUiState({ kind: 'error', message: err?.message ?? 'Unknown error' });
    }
  }, [libraryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Bunny Stream</Text>
      {uiState.kind === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{uiState.message}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={uiState.kind === 'loaded' ? uiState.videos : []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || uiState.kind === 'loading'}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            uiState.kind === 'loaded' ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No videos in this library</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, !isPlayable(item) && styles.rowDisabled]}
              disabled={!isPlayable(item)}
              onPress={() => onSelect(item)}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatDuration(item.lengthSeconds)} · {videoStatusLabel(item.status)}
                </Text>
              </View>
              {isPlayable(item) && <Text style={styles.playIcon}>▶</Text>}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: { color: '#9a9aa5' },
  errorText: { color: '#ff6b6b', textAlign: 'center' },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2a2a35',
    borderRadius: 8,
  },
  retryLabel: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a35',
  },
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '500' },
  rowMeta: { color: '#9a9aa5', fontSize: 13 },
  playIcon: { color: '#f97316', fontSize: 14, marginLeft: 12 },
});
