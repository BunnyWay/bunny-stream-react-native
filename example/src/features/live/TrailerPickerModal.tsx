import * as React from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BunnyStreamApi,
  TRANSITIONAL_VIDEO_STATUSES,
  fold,
  videoStatusLabel,
  type Video,
  type VideoStatus,
} from '@bunny.net/stream-react-native';

import { ListStateView } from '../../components/ListStateView';
import { Black, colors, Orange40 } from '../../theme/colors';

type UiState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; videos: Video[] }
  | { kind: 'error'; message: string };

/**
 * In-modal video picker for choosing a pre-stream trailer. Rendered nested
 * inside `LiveStreamEditorModal` so the user never leaves the editor —
 * picking a row calls `onPick` and the parent closes the modal.
 */
export function TrailerPickerModal({
  visible,
  libraryId,
  onPick,
  onClose,
}: {
  visible: boolean;
  libraryId: number;
  onPick: (videoId: string) => void;
  onClose: () => void;
}) {
  const [uiState, setUiState] = React.useState<UiState>({ kind: 'loading' });
  const insets = useSafeAreaInsets();

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

  // Reload every time the modal opens so the list reflects the current library.
  React.useEffect(() => {
    if (visible) loadVideos();
  }, [visible, loadVideos]);

  const videos = uiState.kind === 'loaded' ? uiState.videos : [];
  const isEmpty = uiState.kind === 'empty' || uiState.kind === 'error';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[pickerStyles.container, { paddingTop: insets.top }]}>
        <View style={pickerStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={pickerStyles.closeButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={pickerStyles.headerTitle}>Pick trailer</Text>
          {/* Spacer keeps the title centered like in the editor header. */}
          <View style={pickerStyles.closeButtonSpacer} />
        </View>
        <FlatList
          style={pickerStyles.content}
          data={videos}
          keyExtractor={(video) => video.id}
          renderItem={({ item }) => <TrailerRow video={item} onPick={() => onPick(item.id)} />}
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
      </View>
    </Modal>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairlineStrong,
  },
  closeButton: {
    fontSize: 16,
    color: colors.primary,
  },
  closeButtonSpacer: {
    width: 50,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
  },
  content: {
    flex: 1,
    padding: 16,
  },
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
