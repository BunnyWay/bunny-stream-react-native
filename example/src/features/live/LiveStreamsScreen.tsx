import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LiveStream, LiveStreamStatus } from 'bunny-stream-react-native';

import { BUNNY_ACCESS_KEY } from '@env';
import * as React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BunnyStreamApi, LiveStreamStatusEnum, fold } from 'bunny-stream-react-native';

import { Dialog } from '../../components/Dialog';
import { Header } from '../../components/Header';
import { ListStateView } from '../../components/ListStateView';
import { loadLibraryConfig } from '../../storage/settings';
import { Black, colors } from '../../theme/colors';
import { styles } from '../../theme/styles';
import { LiveStreamCard } from './LiveStreamCard';
import { LiveStreamEditorModal } from './LiveStreamEditorModal';
import { RtmpIngestModal } from './RtmpIngestModal';

type LiveStreamsScreenProps = NativeStackScreenProps<RootStackParamList, 'LiveStreams'>;

type UiState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; streams: LiveStream[] }
  | { kind: 'error'; message: string };

export function LiveStreamsScreen({ navigation, route }: LiveStreamsScreenProps) {
  const [uiState, setUiState] = React.useState<UiState>({ kind: 'loading' });
  const [libraryId, setLibraryId] = React.useState<number | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editStream, setEditStream] = React.useState<LiveStream | null>(null);
  const [deleteStream, setDeleteStream] = React.useState<LiveStream | null>(null);
  const [rtmpStream, setRtmpStream] = React.useState<LiveStream | null>(null);

  // Results handed back from the TrailerPicker / ThumbnailPicker screens via
  // route params. Forwarded to the editor modal, then cleared once consumed.
  const [pickedTrailerVideoId, setPickedTrailerVideoId] = React.useState<string | null>(null);
  const [pickedThumbnailUrl, setPickedThumbnailUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (route.params?.pickedTrailerVideoId) {
      setPickedTrailerVideoId(route.params.pickedTrailerVideoId);
      // Clear the param so a re-mount doesn't re-apply a stale pick.
      navigation.setParams({ pickedTrailerVideoId: undefined });
    }
    if (route.params?.pickedThumbnailUrl) {
      setPickedThumbnailUrl(route.params.pickedThumbnailUrl);
      navigation.setParams({ pickedThumbnailUrl: undefined });
    }
  }, [route.params, navigation]);

  const loadStreams = React.useCallback(async () => {
    const { libraryId: libId } = await loadLibraryConfig();
    if (libId == null) {
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
    const { token, expires } = BunnyStreamApi.signPlaybackToken(BUNNY_ACCESS_KEY, stream.id);
    navigation.navigate('LivePlayer', {
      streamId: stream.id,
      libraryId,
      token: token ?? undefined,
      expires: expires ?? undefined,
    });
  };

  const handleCreated = () => {
    setCreateOpen(false);
    loadStreams();
  };

  const handleEditSaved = () => {
    setEditStream(null);
    loadStreams();
  };

  const handleDeleteConfirm = async () => {
    if (libraryId == null || deleteStream == null) return;
    const streamId = deleteStream.id;
    setDeleteStream(null);
    const result = await BunnyStreamApi.deleteLiveStream(libraryId, streamId);
    if (result.ok) {
      loadStreams();
    } else {
      setUiState({ kind: 'error', message: result.error.message });
    }
  };

  const handleToggleLive = async (stream: LiveStream) => {
    if (libraryId == null) return;
    const status = stream.status as LiveStreamStatus;
    const isRunning = status === LiveStreamStatusEnum.RUNNING;
    const result = isRunning
      ? await BunnyStreamApi.stopLiveStream(libraryId, stream.id)
      : await BunnyStreamApi.startLiveStream(libraryId, stream.id);
    if (result.ok) {
      loadStreams();
    } else {
      setUiState({ kind: 'error', message: result.error.message });
    }
  };

  const handleGoLive = (stream: LiveStream) => {
    if (libraryId == null) return;
    navigation.navigate('Camera', {
      mode: 'live',
      libraryId,
      streamId: stream.id,
    });
  };

  const renderItem = ({ item }: { item: LiveStream }) => (
    <LiveStreamCard
      stream={item}
      onWatch={() => handleWatch(item)}
      onEdit={() => setEditStream(item)}
      onDelete={() => setDeleteStream(item)}
      onRtmp={() => setRtmpStream(item)}
      onToggleLive={() => handleToggleLive(item)}
      onGoLive={() => handleGoLive(item)}
    />
  );

  const isEmpty = uiState.kind === 'empty' || uiState.kind === 'error';

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
          <ListStateView
            state={uiState}
            emptyMessage="No live streams in this library."
            onRetry={loadStreams}
          />
        }
        contentContainerStyle={[isEmpty ? listStyles.emptyList : listStyles.list]}
      />

      {/* FAB — mirrors the Android demo's FloatingActionButton */}
      <TouchableOpacity
        style={fabStyles.fab}
        onPress={() => setCreateOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={fabStyles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Create live stream modal */}
      <LiveStreamEditorModal
        visible={createOpen}
        libraryId={libraryId}
        stream={null}
        navigation={navigation}
        pickedTrailerVideoId={pickedTrailerVideoId}
        pickedThumbnailUrl={pickedThumbnailUrl}
        onConsumePickedTrailer={() => setPickedTrailerVideoId(null)}
        onConsumePickedThumbnail={() => setPickedThumbnailUrl(null)}
        onClose={() => setCreateOpen(false)}
        onDone={handleCreated}
      />

      {/* Edit live stream modal */}
      <LiveStreamEditorModal
        visible={editStream != null}
        libraryId={libraryId}
        stream={editStream}
        navigation={navigation}
        pickedTrailerVideoId={pickedTrailerVideoId}
        pickedThumbnailUrl={pickedThumbnailUrl}
        onConsumePickedTrailer={() => setPickedTrailerVideoId(null)}
        onConsumePickedThumbnail={() => setPickedThumbnailUrl(null)}
        onClose={() => setEditStream(null)}
        onDone={handleEditSaved}
      />

      {/* Delete confirmation modal */}
      <Dialog
        visible={deleteStream != null}
        title="Delete live stream?"
        subtitle={`"${deleteStream?.title}" will be permanently deleted. Recorded VODs remain in the library.`}
        onClose={() => setDeleteStream(null)}
      >
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1, marginRight: 8 }]}
            onPress={handleDeleteConfirm}
          >
            <Text style={styles.primaryButtonText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1, backgroundColor: colors.disabled }]}
            onPress={() => setDeleteStream(null)}
          >
            <Text style={styles.primaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Dialog>

      {/* RTMP ingest details modal */}
      <RtmpIngestModal stream={rtmpStream} onClose={() => setRtmpStream(null)} />
    </>
  );
}

const listStyles = StyleSheet.create({
  emptyList: {
    flexGrow: 1,
  },
  list: {
    paddingBottom: 48,
  },
});

const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: Black,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: {
    color: colors.onPrimary,
    fontSize: 28,
    fontWeight: '400',
    marginTop: -2,
  },
});
