import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  BunnyStreamApi,
  BunnyStreamUpload,
  fold,
  type BunnyError,
  type UploadEvent,
  type UploadMode,
} from '@bunny.net/stream-react-native';

import { Header } from '../../components/Header';
import { OutlineButton } from '../../components/OutlineButton';
import { ProgressBar } from '../../components/ProgressBar';
import { StatusBanner } from '../../components/StatusBanner';
import { StatusPill } from '../../components/StatusPill';
import { ToggleRow } from '../../components/ToggleRow';
import { pickVideo } from '../../media/picker';
import { loadLibraryConfig } from '../../storage/settings';
import { Black, colors } from '../../theme/colors';
import { styles } from '../../theme/styles';
import { formatBytes } from '../../utils/format';

type VideoUploadScreenProps = NativeStackScreenProps<RootStackParamList, 'VideoUpload'>;

/** Row state kept in a ref map, mirrored to a state array for rendering. */
interface UploadRow {
  uploadId: string;
  title: string;
  videoId: string | null;
  status: 'uploading' | 'paused' | 'completed' | 'cancelled' | 'failed';
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
  pauseSupported: 'supported' | 'unsupported';
  error: BunnyError | null;
  /** Saved to allow retry with the same file URI / library / mode. */
  retry: {
    libraryId: number;
    uri: string;
    mode: UploadMode;
  } | null;
}

export function VideoUploadScreen({ navigation }: VideoUploadScreenProps) {
  const [libraryId, setLibraryId] = React.useState<number | null>(null);
  const [useTus, setUseTus] = React.useState(true);
  const [rows, setRows] = React.useState<UploadRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Upload rows keyed by uploadId. Kept in a ref so the event listener (set
  // up once) always reads the latest rows without re-subscribing.
  const rowsRef = React.useRef<Map<string, UploadRow>>(new Map());

  // Persisted retry context keyed by uploadId — the file URI and mode needed to
  // restart an upload after a failure. Cleared on cancel/completed.
  const retryContextRef = React.useRef<
    Map<string, { libraryId: number; uri: string; mode: UploadMode; videoId: string | null }>
  >(new Map());

  // Rows removed locally. Any later native event for these ids (e.g. the
  // 'cancelled' event fired when a failed upload is evicted) must not
  // resurrect the row.
  const removedUploadIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    (async () => {
      const { libraryId: libId } = await loadLibraryConfig();
      if (libId != null) setLibraryId(libId);
    })();
  }, []);

  const syncRows = React.useCallback(() => {
    setRows(Array.from(rowsRef.current.values()));
  }, []);

  const upsertRow = React.useCallback(
    (uploadId: string, patch: Partial<UploadRow>) => {
      const existing = rowsRef.current.get(uploadId);
      const next: UploadRow = {
        uploadId,
        title: existing?.title ?? '',
        videoId: existing?.videoId ?? null,
        status: 'uploading',
        progress: 0,
        bytesUploaded: 0,
        totalBytes: 0,
        pauseSupported: 'unsupported',
        error: null,
        retry: existing?.retry ?? null,
        ...existing,
        ...patch,
      };
      rowsRef.current.set(uploadId, next);
      syncRows();
    },
    [syncRows],
  );

  // Subscribe to upload events once for the screen lifetime, then reattach
  // to uploads restored from a previous session (iOS TUS only; a no-op on
  // Android — restored entries arrive through the same listener).
  React.useEffect(() => {
    const unsubscribe = BunnyStreamUpload.addUploadListener((event: UploadEvent) => {
      handleEvent(event);
    });
    BunnyStreamUpload.restoreUploads();
    return unsubscribe;
  }, []);

  const handleEvent = React.useCallback(
    (event: UploadEvent) => {
      if (removedUploadIdsRef.current.has(event.uploadId)) return;
      switch (event.type) {
        case 'started':
          upsertRow(event.uploadId, {
            videoId: event.videoId,
            status: 'uploading',
            progress: 0,
          });
          break;
        case 'progress':
          upsertRow(event.uploadId, {
            videoId: event.videoId,
            status: 'uploading',
            progress: event.progress,
            bytesUploaded: event.bytesUploaded,
            totalBytes: event.totalBytes,
            pauseSupported: event.pauseSupported,
          });
          break;
        case 'paused':
          upsertRow(event.uploadId, { status: 'paused' });
          break;
        case 'completed':
          upsertRow(event.uploadId, {
            videoId: event.videoId,
            status: 'completed',
            progress: 1,
          });
          retryContextRef.current.delete(event.uploadId);
          break;
        case 'cancelled':
          upsertRow(event.uploadId, { status: 'cancelled' });
          retryContextRef.current.delete(event.uploadId);
          break;
        case 'failed': {
          upsertRow(event.uploadId, {
            videoId: event.videoId,
            status: 'failed',
            error: event.error,
          });
          break;
        }
      }
    },
    [upsertRow],
  );

  const handlePickVideos = async () => {
    if (libraryId == null) {
      setError('Library ID not configured. Set it in Settings.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const picked = await pickVideo(5);
      if (!picked || picked.length === 0) return;
      const mode: UploadMode = useTus ? 'tus' : 'basic';
      for (const file of picked) {
        const result = await BunnyStreamUpload.startUpload({
          libraryId,
          uri: file.uri,
          title: file.fileName ?? undefined,
          mode,
        });
        fold(
          result,
          (handle) => {
            rowsRef.current.set(handle.uploadId, {
              uploadId: handle.uploadId,
              title: file.fileName ?? file.uri,
              videoId: null,
              status: 'uploading',
              progress: 0,
              bytesUploaded: 0,
              totalBytes: 0,
              pauseSupported: pauseSupportFor(mode),
              error: null,
              retry: { libraryId, uri: file.uri, mode },
            });
            retryContextRef.current.set(handle.uploadId, {
              libraryId,
              uri: file.uri,
              mode,
              videoId: null,
            });
            syncRows();
          },
          (err) => setError(err.message),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePauseResume = async (row: UploadRow) => {
    if (row.status !== 'uploading' && row.status !== 'paused') return;
    const result =
      row.status === 'paused'
        ? await BunnyStreamUpload.resumeUpload(row.uploadId)
        : await BunnyStreamUpload.pauseUpload(row.uploadId);
    if (!result.ok) setError(result.error.message);
  };

  // startUpload creates an empty video entry before the transfer begins,
  // so an aborted upload would otherwise leave an orphaned video in the
  // library. Deletes it; a missing videoId just means no cleanup is needed.
  const deleteVideoEntry = async (row: UploadRow) => {
    if (libraryId == null || !row.videoId) return;
    const result = await BunnyStreamApi.deleteVideo(libraryId, row.videoId);
    if (!result.ok) setError(result.error.message);
  };

  const handleCancel = async (row: UploadRow) => {
    const result = await BunnyStreamUpload.cancelUpload(row.uploadId);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await deleteVideoEntry(row);
  };

  const handleRetry = async (row: UploadRow) => {
    const ctx = retryContextRef.current.get(row.uploadId);
    if (!ctx) {
      setError('Retry context lost for this upload.');
      return;
    }
    setError(null);
    // Remove the failed row; a new uploadId will be returned.
    rowsRef.current.delete(row.uploadId);
    retryContextRef.current.delete(row.uploadId);
    syncRows();

    const result =
      ctx.videoId != null
        ? await BunnyStreamUpload.continueUpload({
            libraryId: ctx.libraryId,
            videoId: ctx.videoId,
            uri: ctx.uri,
            mode: ctx.mode,
          })
        : await BunnyStreamUpload.startUpload({
            libraryId: ctx.libraryId,
            uri: ctx.uri,
            mode: ctx.mode,
          });
    fold(
      result,
      (handle) => {
        rowsRef.current.set(handle.uploadId, {
          uploadId: handle.uploadId,
          title: row.title,
          videoId: ctx.videoId,
          status: 'uploading',
          progress: 0,
          bytesUploaded: 0,
          totalBytes: 0,
          pauseSupported: pauseSupportFor(ctx.mode),
          error: null,
          retry: { libraryId: ctx.libraryId, uri: ctx.uri, mode: ctx.mode },
        });
        retryContextRef.current.set(handle.uploadId, { ...ctx });
        syncRows();
      },
      (err) => setError(err.message),
    );
  };

  const handleRemove = async (row: UploadRow) => {
    // Suppress late events for this id before deleting the row — a native
    // 'cancelled' event must not re-create it.
    removedUploadIdsRef.current.add(row.uploadId);
    // For paused/failed uploads the native tracker entry (and TUS cache on
    // iOS) still exists — cancel releases it. Unknown ids are a no-op.
    if (row.status === 'paused' || row.status === 'failed') {
      await BunnyStreamUpload.cancelUpload(row.uploadId);
    }
    // Aborted uploads leave an orphaned video entry — delete it. Completed
    // uploads keep their video.
    if (row.status !== 'completed') {
      await deleteVideoEntry(row);
    }
    rowsRef.current.delete(row.uploadId);
    retryContextRef.current.delete(row.uploadId);
    syncRows();
  };

  const handlePlay = (row: UploadRow) => {
    if (libraryId == null || !row.videoId) return;
    navigation.navigate('Player', { videoId: row.videoId, libraryId });
  };

  const isEmpty = rows.length === 0;

  return (
    <>
      <Header title="Video Upload" onBack={() => navigation.goBack()} />
      <FlatList
        style={styles.content}
        data={rows}
        keyExtractor={(row) => row.uploadId}
        renderItem={({ item }) => (
          <UploadRowCard
            row={item}
            onPauseResume={() => handlePauseResume(item)}
            onCancel={() => handleCancel(item)}
            onRetry={() => handleRetry(item)}
            onRemove={() => handleRemove(item)}
            onPlay={() => handlePlay(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View>
            <ToggleRow
              label="Use TUS resumable upload"
              subtitle="Pause/resume works on both platforms; basic uploader ignores pause on Android."
              value={useTus}
              onValueChange={setUseTus}
            />

            <TouchableOpacity
              style={[styles.addButton, busy && uploadStyles.buttonDisabled]}
              onPress={handlePickVideos}
              disabled={busy || libraryId == null}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.addButtonText}>Pick videos</Text>
              )}
            </TouchableOpacity>

            {error ? <StatusBanner message={error} style={uploadStyles.errorSpacing} /> : null}
          </View>
        }
        ListEmptyComponent={
          isEmpty ? (
            <Text style={styles.videoListEmpty}>
              No uploads yet. Pick a video to start uploading to the library.
            </Text>
          ) : null
        }
        contentContainerStyle={isEmpty ? uploadStyles.emptyList : uploadStyles.list}
      />
    </>
  );
}

/** Whether pause/resume is meaningful for a given upload mode on this platform. */
function pauseSupportFor(mode: UploadMode): 'supported' | 'unsupported' {
  // TUS pause/resume works on both platforms. On iOS the basic uploader
  // pauses via URLSessionTask.suspend; on Android basic pause is a no-op.
  return mode === 'tus' || Platform.OS === 'ios' ? 'supported' : 'unsupported';
}

function UploadRowCard({
  row,
  onPauseResume,
  onCancel,
  onRetry,
  onRemove,
  onPlay,
}: {
  row: UploadRow;
  onPauseResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onPlay: () => void;
}) {
  const percent = Math.round(row.progress * 100);
  const canControl = row.status === 'uploading' || row.status === 'paused';
  const canPause = canControl && row.pauseSupported === 'supported';
  const isTerminal =
    row.status === 'completed' || row.status === 'cancelled' || row.status === 'failed';

  return (
    <View style={uploadStyles.card}>
      <View style={uploadStyles.rowHeader}>
        <Text style={uploadStyles.rowTitle} numberOfLines={1}>
          {row.title || 'Untitled'}
        </Text>
        <StatusPill
          label={row.status}
          backgroundColor={STATUS_PILL_BG[row.status]}
          color={colors.onPrimary}
          textStyle={uploadStyles.statusPillText}
        />
      </View>

      {row.videoId ? (
        <Text style={uploadStyles.videoId} numberOfLines={1}>
          {row.videoId}
        </Text>
      ) : null}

      {row.status === 'uploading' || row.status === 'paused' ? (
        <View style={uploadStyles.progressBlock}>
          <ProgressBar progress={row.progress} />
          <Text style={uploadStyles.progressText}>
            {percent}%{' '}
            {row.totalBytes > 0
              ? `· ${formatBytes(row.bytesUploaded)} / ${formatBytes(row.totalBytes)}`
              : ''}
          </Text>
        </View>
      ) : null}

      {row.status === 'failed' && row.error ? (
        <Text style={uploadStyles.errorText} numberOfLines={2}>
          {row.error.message}
        </Text>
      ) : null}

      <View style={uploadStyles.actionsRow}>
        {canPause ? (
          <OutlineButton
            label={row.status === 'paused' ? 'Resume' : 'Pause'}
            onPress={onPauseResume}
          />
        ) : null}
        {canControl ? <OutlineButton label="Cancel" onPress={onCancel} danger /> : null}
        {row.status === 'failed' && row.error && !row.error.isTerminal ? (
          <OutlineButton label="Retry" onPress={onRetry} />
        ) : null}
        {row.status === 'completed' && row.videoId ? (
          <OutlineButton label="Play" onPress={onPlay} />
        ) : null}
        {isTerminal || row.status === 'paused' ? (
          <OutlineButton label="Remove" onPress={onRemove} danger />
        ) : null}
      </View>
    </View>
  );
}

const uploadStyles = StyleSheet.create({
  list: {
    paddingBottom: 48,
  },
  emptyList: {
    flexGrow: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorSpacing: {
    marginTop: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: Black,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    marginRight: 8,
  },
  videoId: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.onSurfaceVariant,
    marginBottom: 8,
  },
  statusPillText: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  progressBlock: {
    marginTop: 8,
  },
  progressText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
});

// Status pill background colors keyed by row status.
const STATUS_PILL_BG: Record<UploadRow['status'], string> = {
  uploading: colors.primary,
  paused: colors.neutral,
  completed: colors.success,
  cancelled: colors.neutralLight,
  failed: colors.error,
};
