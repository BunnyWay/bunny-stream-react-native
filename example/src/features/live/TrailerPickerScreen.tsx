import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  BunnyStreamApi,
  TRANSITIONAL_VIDEO_STATUSES,
  fold,
  videoStatusLabel,
  type Video,
  type VideoStatus,
} from 'bunny-stream-react-native';

import { Header } from '../../components/Header';
import { ListStateView } from '../../components/ListStateView';
import { Black, colors, Orange40 } from '../../theme/colors';
import { styles } from '../../theme/styles';

type TrailerPickerScreenProps = NativeStackScreenProps<RootStackParamList, 'TrailerPicker'>;

type UiState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; videos: Video[] }
  | { kind: 'error'; message: string };

/**
 * Lists library videos and lets the user pick one as a live stream trailer.
 * Mirrors iOS `TrailerPickerView` and Android `TrailerPickerScreen`.
 *
 * On selection, sets `pickedTrailerVideoId` on the `LiveStreams` route params
 * and pops back. `LiveStreamsScreen` forwards the value to the editor modal.
 */
export function TrailerPickerScreen({ navigation, route }: TrailerPickerScreenProps) {
  const { libraryId } = route.params;
  const [uiState, setUiState] = React.useState<UiState>({ kind: 'loading' });

  const loadVideos = React.useCallback(async () => {
    setUiState((prev) => (prev.kind === 'loaded' ? prev : { kind: 'loading' }));
    const result = await BunnyStreamApi.listVideos(libraryId, { orderBy: 'date' });
    fold(
      result,
      (list) => {
        if (list.items.length === 0) setUiState({ kind: 'empty' });
        else setUiState({ kind: 'loaded', videos: list.items });
      },
      (err) => setUiState({ kind: 'error', message: err.message }),
    );
  }, [libraryId]);

  React.useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handlePick = (video: Video) => {
    // Hand the result to the LiveStreams route (the editor lives there as a
    // modal) and pop back. react-navigation merges params on navigate.
    navigation.navigate('LiveStreams', { pickedTrailerVideoId: video.id });
  };

  const videos = uiState.kind === 'loaded' ? uiState.videos : [];
  const isEmpty = uiState.kind === 'empty' || uiState.kind === 'error';

  return (
    <>
      <Header title="Pick trailer" onBack={() => navigation.goBack()} />
      <FlatList
        style={styles.content}
        data={videos}
        keyExtractor={(video) => video.id}
        renderItem={({ item }) => <TrailerRow video={item} onPick={() => handlePick(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={uiState.kind === 'loading'}
            onRefresh={loadVideos}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <ListStateView
            state={uiState}
            emptyMessage="No videos in this library to use as a trailer."
            onRetry={loadVideos}
          />
        }
        contentContainerStyle={isEmpty ? pickerStyles.emptyList : pickerStyles.list}
      />
    </>
  );
}

function TrailerRow({ video, onPick }: { video: Video; onPick: () => void }) {
  const isProcessing = TRANSITIONAL_VIDEO_STATUSES.has(video.status as VideoStatus);

  return (
    <TouchableOpacity style={pickerStyles.row} onPress={onPick} activeOpacity={0.7}>
      <View style={pickerStyles.meta}>
        <Text style={pickerStyles.title} numberOfLines={1}>
          {video.title || 'Untitled'}
        </Text>
        <Text style={pickerStyles.status}>{videoStatusLabel(video.status as VideoStatus)}</Text>
        {isProcessing ? (
          <Text style={pickerStyles.warning}>Processing — trailer may not play yet.</Text>
        ) : null}
      </View>
      <Text style={pickerStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const pickerStyles = StyleSheet.create({
  list: {
    paddingBottom: 48,
  },
  emptyList: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    shadowColor: Black,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  meta: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  chevron: {
    fontSize: 22,
    color: colors.onSurfaceVariant,
    marginLeft: 8,
  },
  warning: {
    fontSize: 11,
    color: Orange40,
    marginTop: 4,
  },
});
