import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BunnyStreamApi, fold, type LiveStreamThumbnail } from 'bunny-stream-react-native';

import { BunnyThumbnail } from '../../components/BunnyThumbnail';
import { Header } from '../../components/Header';
import { ListStateView } from '../../components/ListStateView';
import { Black, colors } from '../../theme/colors';
import { styles } from '../../theme/styles';

type ThumbnailPickerScreenProps = NativeStackScreenProps<RootStackParamList, 'ThumbnailPicker'>;

type UiState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; thumbnails: LiveStreamThumbnail[] }
  | { kind: 'error'; message: string };

/**
 * Lists auto-generated thumbnails for a live stream and lets the user pick one.
 * Mirrors iOS `LiveThumbnailPickerView` and Android `ThumbnailPickerScreen`.
 *
 * On selection, sets `pickedThumbnailUrl` on the `LiveStreams` route params
 * and pops back. `LiveStreamsScreen` forwards the value to the editor modal.
 */
export function ThumbnailPickerScreen({ navigation, route }: ThumbnailPickerScreenProps) {
  const { libraryId, streamId } = route.params;
  const [uiState, setUiState] = React.useState<UiState>({ kind: 'loading' });

  const loadThumbnails = React.useCallback(async () => {
    setUiState((prev) => (prev.kind === 'loaded' ? prev : { kind: 'loading' }));
    const result = await BunnyStreamApi.listLiveStreamThumbnails(libraryId, streamId);
    fold(
      result,
      (items) => {
        if (items.length === 0) setUiState({ kind: 'empty' });
        else setUiState({ kind: 'loaded', thumbnails: items });
      },
      (err) => setUiState({ kind: 'error', message: err.message }),
    );
  }, [libraryId, streamId]);

  React.useEffect(() => {
    loadThumbnails();
  }, [loadThumbnails]);

  const handlePick = (url: string) => {
    navigation.navigate('LiveStreams', { pickedThumbnailUrl: url });
  };

  const thumbnails = uiState.kind === 'loaded' ? uiState.thumbnails : [];
  const isEmpty = uiState.kind === 'empty' || uiState.kind === 'error';

  return (
    <>
      <Header title="Pick thumbnail" onBack={() => navigation.goBack()} />
      <FlatList
        style={styles.content}
        data={thumbnails}
        keyExtractor={(item, index) => item.url ?? `thumb-${index}`}
        numColumns={2}
        renderItem={({ item }) => (
          <ThumbnailTile item={item} onPick={() => item.url && handlePick(item.url)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={uiState.kind === 'loading'}
            onRefresh={loadThumbnails}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <ListStateView
            state={uiState}
            emptyMessage="No generated thumbnails yet. Start the stream once to generate them."
            onRetry={loadThumbnails}
          />
        }
        contentContainerStyle={isEmpty ? thumbStyles.emptyList : thumbStyles.list}
      />
    </>
  );
}

function ThumbnailTile({ item, onPick }: { item: LiveStreamThumbnail; onPick: () => void }) {
  const url = item.url ?? undefined;

  return (
    <TouchableOpacity style={thumbStyles.tile} onPress={onPick} disabled={!url} activeOpacity={0.7}>
      {url ? (
        <BunnyThumbnail url={url} style={thumbStyles.image} resizeMode="cover" />
      ) : (
        <View style={thumbStyles.placeholder}>
          <Text style={thumbStyles.placeholderText}>No preview</Text>
        </View>
      )}
      {item.timestamp ? (
        <Text style={thumbStyles.timestamp} numberOfLines={1}>
          {item.timestamp}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const thumbStyles = StyleSheet.create({
  list: {
    paddingBottom: 48,
  },
  emptyList: {
    flexGrow: 1,
  },
  tile: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: Black,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceDark,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.neutral,
    fontSize: 12,
  },
  timestamp: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    padding: 6,
  },
});
