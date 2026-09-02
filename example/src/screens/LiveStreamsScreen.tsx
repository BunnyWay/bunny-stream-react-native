import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_LIBRARY_ID } from '@env';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  BunnyStreamApi,
  LiveStreamStatusEnum,
  fold,
  liveStreamStatusLabel,
  type LiveStream,
  type LiveStreamStatus,
} from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { loadSettings } from '../storage/storage';
import { colors } from '../theme/colors';
import { styles } from '../theme/styles';

type LiveStreamsScreenProps = NativeStackScreenProps<RootStackParamList, 'LiveStreams'>;

type UiState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; streams: LiveStream[] }
  | { kind: 'error'; message: string };

export function LiveStreamsScreen({ navigation }: LiveStreamsScreenProps) {
  const [uiState, setUiState] = React.useState<UiState>({ kind: 'loading' });
  const [libraryId, setLibraryId] = React.useState<number | null>(null);

  const loadStreams = React.useCallback(async () => {
    const stored = await loadSettings();
    const libIdStr = stored?.libraryId ?? BUNNY_LIBRARY_ID ?? '';
    const libId = parseInt(libIdStr, 10);
    if (isNaN(libId)) {
      setUiState({ kind: 'error', message: 'Library ID not configured. Set it in Settings.' });
      return;
    }
    setLibraryId(libId);

    setUiState((prev) => (prev.kind === 'loaded' ? prev : { kind: 'loading' }));
    const result = await BunnyStreamApi.listLiveStreams(libId);
    fold(
      result,
      (list) => {
        if (list.items.length === 0) {
          setUiState({ kind: 'empty' });
        } else {
          setUiState({ kind: 'loaded', streams: list.items });
        }
      },
      (error) => setUiState({ kind: 'error', message: error.message }),
    );
  }, []);

  React.useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  const handleWatch = (stream: LiveStream) => {
    if (libraryId == null) return;
    navigation.navigate('LivePlayer', { streamId: stream.id, libraryId });
  };

  const renderItem = ({ item }: { item: LiveStream }) => {
    const status = item.status as LiveStreamStatus;
    const isLive = status === LiveStreamStatusEnum.RUNNING;
    const isPlayable =
      status === LiveStreamStatusEnum.RUNNING || status === LiveStreamStatusEnum.PREVIEW;

    return (
      <View style={streamCardStyles.card}>
        <View style={streamCardStyles.header}>
          <Text style={streamCardStyles.title} numberOfLines={1}>
            {item.title || 'Untitled stream'}
          </Text>
          {isLive ? <View style={streamCardStyles.liveDot} /> : null}
        </View>

        <View style={streamCardStyles.pillRow}>
          <View style={[streamCardStyles.pill, isLive && streamCardStyles.pillLive]}>
            <Text style={[streamCardStyles.pillText, isLive && streamCardStyles.pillTextLive]}>
              {liveStreamStatusLabel(status)}
            </Text>
          </View>
          {item.isPublic ? (
            <View style={streamCardStyles.pill}>
              <Text style={streamCardStyles.pillText}>Public</Text>
            </View>
          ) : null}
          {item.dvrEnabled ? (
            <View style={streamCardStyles.pill}>
              <Text style={streamCardStyles.pillText}>DVR</Text>
            </View>
          ) : null}
          {item.recordVod ? (
            <View style={streamCardStyles.pill}>
              <Text style={streamCardStyles.pillText}>Record</Text>
            </View>
          ) : null}
        </View>

        {item.scheduledStartTime ? (
          <Text style={streamCardStyles.scheduled}>
            Scheduled: {formatScheduled(item.scheduledStartTime)}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[
            streamCardStyles.watchButton,
            !isPlayable && streamCardStyles.watchButtonDisabled,
          ]}
          onPress={() => handleWatch(item)}
          disabled={!isPlayable}
        >
          <Text style={streamCardStyles.watchButtonText}>{isPlayable ? 'Watch' : 'Not live'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <Header title="Live Streams" onBack={() => navigation.goBack()} />
      <FlatList
        style={styles.content}
        data={uiState.kind === 'loaded' ? uiState.streams : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={uiState.kind === 'loading'}
            onRefresh={loadStreams}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          uiState.kind === 'loading' ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading live streams…</Text>
            </View>
          ) : uiState.kind === 'empty' ? (
            <Text style={styles.videoListEmpty}>No live streams in this library.</Text>
          ) : uiState.kind === 'error' ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.errorMessage}>{uiState.message}</Text>
              <TouchableOpacity style={styles.errorButton} onPress={loadStreams}>
                <Text style={styles.errorButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </>
  );
}

function formatScheduled(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

const streamCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e53935',
    marginLeft: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  pill: {
    backgroundColor: 'rgba(37, 88, 143, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillLive: {
    backgroundColor: '#e53935',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  pillTextLive: {
    color: '#FFFFFF',
  },
  scheduled: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginBottom: 10,
  },
  watchButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  watchButtonDisabled: {
    backgroundColor: 'rgba(24, 61, 109, 0.2)',
  },
  watchButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
