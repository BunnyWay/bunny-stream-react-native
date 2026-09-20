import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  BunnyStreamUpload,
  fold,
  type BunnyError,
  type UploadEvent,
  type UploadMode,
} from 'bunny-stream-react-native';

import { Header } from '../../components/Header';
import { pickVideo } from '../../media/picker';
import { loadLibraryConfig } from '../../storage/settings';
import { colors } from '../../theme/colors';
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

  // Subscribe to upload events once for the screen lifetime.
  React.useEffect(() => {
    const unsubscribe = BunnyStreamUpload.addUploadListener((event: UploadEvent) => {
      handleEvent(event);
    });
    return unsubscribe;
  }, []);

  const handleEvent = React.useCallback(
    (event: UploadEvent) => {
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
              pauseSupported: 'unsupported',
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

  const handleCancel = async (row: UploadRow) => {
    const result = await BunnyStreamUpload.cancelUpload(row.uploadId);
    if (!result.ok) setError(result.error.message);
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
          pauseSupported: 'unsupported',
          error: null,
          retry: { libraryId: ctx.libraryId, uri: ctx.uri, mode: ctx.mode },
        });
        retryContextRef.current.set(handle.uploadId, { ...ctx });
        syncRows();
      },
      (err) => setError(err.message),
    );
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
            onPlay={() => handlePlay(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View>
            <View style={uploadStyles.settingsRow}>
              <View style={uploadStyles.settingsText}>
                <Text style={uploadStyles.settingsLabel}>Use TUS resumable upload</Text>
                <Text style={uploadStyles.settingsHint}>
                  Pause/resume works on both platforms; basic uploader ignores pause on Android.
                </Text>
              </View>
              <Switch value={useTus} onValueChange={setUseTus} />
            </View>

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

            {error ? (
              <View style={uploadStyles.errorBox}>
                <Text style={uploadStyles.errorText}>{error}</Text>
              </View>
            ) : null}
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

function UploadRowCard({
  row,
  onPauseResume,
  onCancel,
  onRetry,
  onPlay,
}: {
  row: UploadRow;
  onPauseResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onPlay: () => void;
}) {
  const percent = Math.round(row.progress * 100);
  const canControl = row.status === 'uploading' || row.status === 'paused';
  const canPause = canControl && row.pauseSupported === 'supported';

  return (
    <View style={uploadStyles.card}>
      <View style={uploadStyles.rowHeader}>
        <Text style={uploadStyles.rowTitle} numberOfLines={1}>
          {row.title || 'Untitled'}
        </Text>
        <View style={[uploadStyles.statusPill, STATUS_PILL_BG[row.status]]}>
          <Text style={uploadStyles.statusPillText}>{row.status}</Text>
        </View>
      </View>

      {row.videoId ? (
        <Text style={uploadStyles.videoId} numberOfLines={1}>
          {row.videoId}
        </Text>
      ) : null}

      {row.status === 'uploading' || row.status === 'paused' ? (
        <View style={uploadStyles.progressBlock}>
          <View style={uploadStyles.progressTrack}>
            <View style={[uploadStyles.progressFill, { width: `${percent}%` }]} />
          </View>
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
          <TouchableOpacity style={uploadStyles.actionButton} onPress={onPauseResume}>
            <Text style={uploadStyles.actionButtonText}>
              {row.status === 'paused' ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
        ) : null}
        {canControl ? (
          <TouchableOpacity
            style={[uploadStyles.actionButton, uploadStyles.actionButtonDanger]}
            onPress={onCancel}
          >
            <Text style={uploadStyles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
        {row.status === 'failed' && row.error && !row.error.isTerminal ? (
          <TouchableOpacity style={uploadStyles.actionButton} onPress={onRetry}>
            <Text style={uploadStyles.actionButtonText}>Retry</Text>
          </TouchableOpacity>
        ) : null}
        {row.status === 'completed' && row.videoId ? (
          <TouchableOpacity style={uploadStyles.actionButton} onPress={onPlay}>
            <Text style={uploadStyles.actionButtonText}>Play</Text>
          </TouchableOpacity>
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
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingsText: {
    flex: 1,
    paddingRight: 12,
  },
  settingsLabel: {
    fontSize: 15,
    color: colors.onSurface,
  },
  settingsHint: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorBox: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
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
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  progressBlock: {
    marginTop: 8,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(24, 61, 109, 0.15)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
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
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonDanger: {
    borderColor: '#d32f2f',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});

// Status pill background colors keyed by row status. Kept outside
// StyleSheet.create because StyleSheet's return type doesn't allow arbitrary
// string-keyed lookups.
const STATUS_PILL_BG: Record<UploadRow['status'], { backgroundColor: string }> = {
  uploading: { backgroundColor: colors.primary },
  paused: { backgroundColor: '#888' },
  completed: { backgroundColor: '#2e7d32' },
  cancelled: { backgroundColor: '#aaa' },
  failed: { backgroundColor: '#d32f2f' },
};
