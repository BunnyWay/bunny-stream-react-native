import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID } from '@env';
import Clipboard from '@react-native-clipboard/clipboard';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Status pill color mapping — mirrors the Android demo's LiveStatusCard. */
const STATUS_COLORS: Record<string, string> = {
  [LiveStreamStatusEnum.RUNNING]: '#e53935',
  [LiveStreamStatusEnum.SCHEDULED]: colors.primary,
  [LiveStreamStatusEnum.CREATED]: '#888',
  [LiveStreamStatusEnum.PREVIEW]: '#888',
  [LiveStreamStatusEnum.ENDED]: '#aaa',
  [LiveStreamStatusEnum.VOD_PROCESSING]: colors.primary,
  [LiveStreamStatusEnum.ERROR]: '#d32f2f',
  [LiveStreamStatusEnum.UNKNOWN]: '#aaa',
};

export function LiveStreamsScreen({ navigation }: LiveStreamsScreenProps) {
  const [uiState, setUiState] = React.useState<UiState>({ kind: 'loading' });
  const [libraryId, setLibraryId] = React.useState<number | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editStream, setEditStream] = React.useState<LiveStream | null>(null);
  const [deleteStream, setDeleteStream] = React.useState<LiveStream | null>(null);
  const [rtmpStream, setRtmpStream] = React.useState<LiveStream | null>(null);

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

  const renderItem = ({ item }: { item: LiveStream }) => (
    <LiveStreamCard
      stream={item}
      onWatch={() => handleWatch(item)}
      onEdit={() => setEditStream(item)}
      onDelete={() => setDeleteStream(item)}
      onRtmp={() => setRtmpStream(item)}
      onToggleLive={() => handleToggleLive(item)}
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
          uiState.kind === 'empty' ? (
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
        onClose={() => setCreateOpen(false)}
        onDone={handleCreated}
      />

      {/* Edit live stream modal */}
      <LiveStreamEditorModal
        visible={editStream != null}
        libraryId={libraryId}
        stream={editStream}
        onClose={() => setEditStream(null)}
        onDone={handleEditSaved}
      />

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteStream != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteStream(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete live stream?</Text>
            <Text style={styles.modalSubtitle}>
              "{deleteStream?.title}" will be permanently deleted. Recorded VODs remain in the
              library.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.errorButton, { flex: 1, marginRight: 8 }]}
                onPress={handleDeleteConfirm}
              >
                <Text style={styles.errorButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.errorButton, { flex: 1, backgroundColor: colors.disabled }]}
                onPress={() => setDeleteStream(null)}
              >
                <Text style={styles.errorButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RTMP ingest details modal */}
      <RtmpIngestModal stream={rtmpStream} onClose={() => setRtmpStream(null)} />
    </>
  );
}

/**
 * Renders a single live stream card — mirrors the Android demo's
 * LiveStreamItem: a Row with text metadata + pills on the left, a play
 * button and overflow menu on the right. No thumbnail in the list.
 */
function LiveStreamCard({
  stream,
  onWatch,
  onEdit,
  onDelete,
  onRtmp,
  onToggleLive,
}: {
  stream: LiveStream;
  onWatch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRtmp: () => void;
  onToggleLive: () => void;
}) {
  const status = stream.status as LiveStreamStatus;
  const statusColor = STATUS_COLORS[status] ?? '#aaa';
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Watch is enabled only when the stream has an HLS playback URL.
  // Start/End live is disabled for terminal states (ENDED / VOD_PROCESSING) —
  // the SDK rejects re-publishing those. Edit and Delete are always enabled.
  const canWatch = Boolean(stream.playbackUrlHls);
  const isRunning = status === LiveStreamStatusEnum.RUNNING;
  const canToggleLive =
    status !== LiveStreamStatusEnum.ENDED && status !== LiveStreamStatusEnum.VOD_PROCESSING;

  const menuItems: {
    label: string;
    action: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }[] = [
    {
      label: 'Watch',
      action: () => {
        setMenuOpen(false);
        onWatch();
      },
      disabled: !canWatch,
    },
    {
      label: isRunning ? 'End live' : 'Start live',
      action: () => {
        setMenuOpen(false);
        onToggleLive();
      },
      disabled: !canToggleLive,
      destructive: isRunning,
    },
    {
      label: 'Ingest',
      action: () => {
        setMenuOpen(false);
        onRtmp();
      },
    },
    {
      label: 'Edit',
      action: () => {
        setMenuOpen(false);
        onEdit();
      },
    },
    {
      label: 'Delete',
      action: () => {
        setMenuOpen(false);
        onDelete();
      },
      destructive: true,
    },
  ];

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        {/* Left column: title + pills + scheduled time */}
        <View style={cardStyles.metadata}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {stream.title || 'Untitled stream'}
          </Text>

          <View style={cardStyles.pillRow}>
            <View style={[cardStyles.pill, { backgroundColor: statusColor }]}>
              <Text style={cardStyles.pillTextLight}>{liveStreamStatusLabel(status)}</Text>
            </View>
            {stream.isPublic ? (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>Public</Text>
              </View>
            ) : null}
            {stream.dvrEnabled ? (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>DVR</Text>
              </View>
            ) : null}
            {stream.recordVod ? (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>VOD</Text>
              </View>
            ) : null}
          </View>

          {stream.scheduledStartTime ? (
            <Text style={cardStyles.scheduled}>
              Scheduled: {formatScheduled(stream.scheduledStartTime)}
            </Text>
          ) : null}
        </View>

        {/* Right: play button + overflow menu */}
        <TouchableOpacity
          onPress={onWatch}
          disabled={!canWatch}
          style={[cardStyles.playButton, !canWatch && cardStyles.playButtonDisabled]}
        >
          <Text style={cardStyles.playIcon}>▶</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuOpen(true)} style={cardStyles.menuButton}>
          <Text style={cardStyles.menuIcon}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Overflow menu — modal bottom sheet style */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity style={cardStyles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={cardStyles.menuSheet}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={cardStyles.menuItem}
                onPress={item.disabled ? undefined : item.action}
                disabled={item.disabled}
              >
                <Text
                  style={[
                    cardStyles.menuItemText,
                    item.destructive && cardStyles.menuItemTextDestructive,
                    item.disabled && cardStyles.menuItemTextDisabled,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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

const listStyles = StyleSheet.create({
  emptyList: {
    flexGrow: 1,
  },
  list: {
    paddingBottom: 48,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  metadata: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  pill: {
    backgroundColor: 'rgba(37, 88, 143, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 50,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  pillTextLight: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scheduled: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  playButtonDisabled: {
    backgroundColor: 'rgba(24, 61, 109, 0.2)',
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 2,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  menuIcon: {
    color: colors.onSurfaceVariant,
    fontSize: 22,
    fontWeight: '700',
  },
  // Overflow menu modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.onSurface,
  },
  menuItemTextDestructive: {
    color: '#d32f2f',
  },
  menuItemTextDisabled: {
    color: '#bbb',
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
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '400',
    marginTop: -2,
  },
});

/**
 * Live stream editor modal — mirrors the Android demo's
 * LiveStreamEditorScreen. Used for both create (stream=null) and edit
 * (stream=<existing>) flows. Fields are grouped into sections:
 *   Details (title, description, public, record VOD)
 *   Schedule (enable, start, end, countdown)
 *   DVR (enable, timeframe)
 *   Pre-stream trailer (enable, video ID)
 *   Thumbnail (enable, image URL)
 *   RTMP outputs (up to 4 rows of endpoint + stream key)
 *
 * Only `title` is required. On success, calls `onDone` which closes
 * the modal and refreshes the list.
 */
function LiveStreamEditorModal({
  visible,
  libraryId,
  stream,
  onClose,
  onDone,
}: {
  visible: boolean;
  libraryId: number | null;
  stream: LiveStream | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = stream != null;
  // Details
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isPublic, setIsPublic] = React.useState(true);
  const [recordVod, setRecordVod] = React.useState(false);

  // Schedule
  const [scheduleEnabled, setScheduleEnabled] = React.useState(false);
  const [scheduledStart, setScheduledStart] = React.useState('');
  const [scheduledEnd, setScheduledEnd] = React.useState('');
  const [enableCountdown, setEnableCountdown] = React.useState(false);

  // DVR
  const [dvrEnabled, setDvrEnabled] = React.useState(false);
  const [dvrWindow, setDvrWindow] = React.useState('12:00:00');

  // Trailer
  const [trailerEnabled, setTrailerEnabled] = React.useState(false);
  const [trailerVideoId, setTrailerVideoId] = React.useState('');

  // Thumbnail
  const [thumbnailEnabled, setThumbnailEnabled] = React.useState(false);
  const [thumbnailUrl, setThumbnailUrl] = React.useState('');

  // RTMP outputs
  const [rtmpOutputs, setRtmpOutputs] = React.useState<{ url: string; key: string }[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const MAX_RTMP = 4;

  // Reset/prefill form when modal opens
  React.useEffect(() => {
    if (visible) {
      if (stream) {
        setTitle(stream.title);
        setDescription(stream.description ?? '');
        setIsPublic(stream.isPublic);
        setRecordVod(stream.recordVod);
        const hasSchedule = stream.scheduledStartTime != null || stream.scheduledEndTime != null;
        setScheduleEnabled(hasSchedule);
        setScheduledStart(stream.scheduledStartTime ?? '');
        setScheduledEnd(stream.scheduledEndTime ?? '');
        setEnableCountdown(stream.enableCountdown ?? false);
        setDvrEnabled(stream.dvrEnabled);
        setDvrWindow(stream.dvrWindowSeconds ? formatHms(stream.dvrWindowSeconds) : '12:00:00');
        const hasTrailer = stream.preStreamTrailerVideoId != null;
        setTrailerEnabled(hasTrailer);
        setTrailerVideoId(stream.preStreamTrailerVideoId ?? '');
        setThumbnailEnabled(false);
        setThumbnailUrl('');
        setRtmpOutputs(
          (stream.rtmpOutputs ?? []).map((o) => ({
            url: o.endpoint ?? '',
            key: o.streamKey ?? '',
          })),
        );
      } else {
        setTitle('');
        setDescription('');
        setIsPublic(true);
        setRecordVod(false);
        setScheduleEnabled(false);
        setScheduledStart('');
        setScheduledEnd('');
        setEnableCountdown(false);
        setDvrEnabled(false);
        setDvrWindow('12:00:00');
        setTrailerEnabled(false);
        setTrailerVideoId('');
        setThumbnailEnabled(false);
        setThumbnailUrl('');
        setRtmpOutputs([]);
      }
      setSaving(false);
      setError(null);
    }
  }, [visible, stream]);

  const dvrWindowError = dvrEnabled ? validateHms(dvrWindow) : null;
  const canSubmit = title.trim().length > 0 && !saving && libraryId != null && !dvrWindowError;

  const handleSave = async () => {
    if (!canSubmit || libraryId == null) return;
    setSaving(true);
    setError(null);

    const rtmp = rtmpOutputs
      .map((o) => ({ endpoint: o.url.trim(), streamKey: o.key.trim() || null }))
      .filter((o) => o.endpoint.length > 0);
    const dvrSeconds = dvrEnabled ? parseHms(dvrWindow) : null;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      isPublic,
      recordVod,
      scheduledStartTime: scheduleEnabled && scheduledStart.trim() ? scheduledStart.trim() : null,
      scheduledEndTime: scheduleEnabled && scheduledEnd.trim() ? scheduledEnd.trim() : null,
      enableCountdown: scheduleEnabled ? enableCountdown : null,
      dvrEnabled,
      dvrWindowSeconds: dvrSeconds,
      preStreamTrailerVideoId:
        trailerEnabled && trailerVideoId.trim() ? trailerVideoId.trim() : null,
      rtmpOutputs: rtmp.length > 0 ? rtmp : null,
    };

    if (isEdit && stream) {
      const result = await BunnyStreamApi.updateLiveStream(libraryId, stream.id, payload);
      fold(
        result,
        () => onDone(),
        (err) => {
          setError(err.message);
          setSaving(false);
        },
      );
    } else {
      const result = await BunnyStreamApi.createLiveStream(libraryId, payload);
      fold(
        result,
        () => onDone(),
        (err) => {
          setError(err.message);
          setSaving(false);
        },
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[createStyles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={createStyles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Text style={[createStyles.cancelButton, saving && createStyles.textDisabled]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={createStyles.headerTitle}>
            {isEdit ? 'Edit live stream' : 'New live stream'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSubmit}>
            <Text style={[createStyles.saveButton, !canSubmit && createStyles.textDisabled]}>
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={createStyles.scroll} contentContainerStyle={createStyles.scrollContent}>
          {/* Details section */}
          <Text style={createStyles.sectionTitle}>Details</Text>

          <Text style={createStyles.label}>Title *</Text>
          <TextInput
            style={createStyles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Stream title"
            placeholderTextColor="#999"
          />

          <Text style={createStyles.label}>Description</Text>
          <TextInput
            style={[createStyles.input, createStyles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={createStyles.toggleRow}>
            <View style={createStyles.toggleText}>
              <Text style={createStyles.toggleLabel}>Public</Text>
            </View>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>

          <View style={createStyles.toggleRow}>
            <View style={createStyles.toggleText}>
              <Text style={createStyles.toggleLabel}>Video on demand</Text>
              <Text style={createStyles.toggleSubtitle}>
                Store the stream as a VOD after it ends
              </Text>
            </View>
            <Switch value={recordVod} onValueChange={setRecordVod} />
          </View>

          {/* Schedule section */}
          <Text style={createStyles.sectionTitle}>Schedule</Text>
          <View style={createStyles.toggleRow}>
            <View style={createStyles.toggleText}>
              <Text style={createStyles.toggleLabel}>Schedule start date and time</Text>
              <Text style={createStyles.toggleSubtitle}>Select when you want to go live</Text>
            </View>
            <Switch value={scheduleEnabled} onValueChange={setScheduleEnabled} />
          </View>

          {scheduleEnabled ? (
            <>
              <Text style={createStyles.label}>Scheduled start (ISO 8601)</Text>
              <TextInput
                style={createStyles.input}
                value={scheduledStart}
                onChangeText={setScheduledStart}
                placeholder="2026-01-15T18:00:00Z"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={createStyles.label}>Scheduled end (optional)</Text>
              <TextInput
                style={createStyles.input}
                value={scheduledEnd}
                onChangeText={setScheduledEnd}
                placeholder="2026-01-15T20:00:00Z"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={createStyles.toggleRow}>
                <View style={createStyles.toggleText}>
                  <Text style={createStyles.toggleLabel}>Enable countdown</Text>
                  <Text style={createStyles.toggleSubtitle}>
                    Show a countdown before the stream starts
                  </Text>
                </View>
                <Switch value={enableCountdown} onValueChange={setEnableCountdown} />
              </View>
            </>
          ) : null}

          {/* DVR section */}
          <Text style={createStyles.sectionTitle}>DVR</Text>
          <View style={createStyles.toggleRow}>
            <View style={createStyles.toggleText}>
              <Text style={createStyles.toggleLabel}>DVR</Text>
              <Text style={createStyles.toggleSubtitle}>
                Let viewers rewind behind the live point (30s - 12hrs)
              </Text>
            </View>
            <Switch value={dvrEnabled} onValueChange={setDvrEnabled} />
          </View>

          {dvrEnabled ? (
            <>
              <Text style={createStyles.label}>DVR timeframe (HH:MM:SS)</Text>
              <TextInput
                style={[createStyles.input, dvrWindowError && createStyles.inputError]}
                value={dvrWindow}
                onChangeText={setDvrWindow}
                placeholder="12:00:00"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {dvrWindowError ? (
                <Text style={createStyles.fieldError}>{dvrWindowError}</Text>
              ) : null}
            </>
          ) : null}

          {/* Pre-stream trailer section */}
          <Text style={createStyles.sectionTitle}>Pre-stream trailer</Text>
          <View style={createStyles.toggleRow}>
            <View style={createStyles.toggleText}>
              <Text style={createStyles.toggleLabel}>Pre-stream trailer</Text>
              <Text style={createStyles.toggleSubtitle}>
                Play a short video before the stream starts
              </Text>
            </View>
            <Switch value={trailerEnabled} onValueChange={setTrailerEnabled} />
          </View>

          {trailerEnabled ? (
            <>
              <Text style={createStyles.label}>Trailer video ID</Text>
              <TextInput
                style={createStyles.input}
                value={trailerVideoId}
                onChangeText={setTrailerVideoId}
                placeholder="Video GUID from your library"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : null}

          {/* Thumbnail section */}
          <Text style={createStyles.sectionTitle}>Thumbnail</Text>
          <View style={createStyles.toggleRow}>
            <View style={createStyles.toggleText}>
              <Text style={createStyles.toggleLabel}>Thumbnail</Text>
              <Text style={createStyles.toggleSubtitle}>Set a custom thumbnail image</Text>
            </View>
            <Switch value={thumbnailEnabled} onValueChange={setThumbnailEnabled} />
          </View>

          {thumbnailEnabled ? (
            <>
              <Text style={createStyles.label}>Image URL</Text>
              <TextInput
                style={createStyles.input}
                value={thumbnailUrl}
                onChangeText={setThumbnailUrl}
                placeholder="https://example.com/poster.jpg"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </>
          ) : null}

          {/* RTMP outputs section */}
          <Text style={createStyles.sectionTitle}>RTMP outputs</Text>
          <Text style={createStyles.sectionHint}>
            Forward the stream to external destinations (max {MAX_RTMP}).
          </Text>

          {rtmpOutputs.map((output, i) => (
            <View key={i} style={createStyles.rtmpRow}>
              <Text style={createStyles.label}>Stream URL</Text>
              <TextInput
                style={createStyles.input}
                value={output.url}
                onChangeText={(v) => updateRtmpRow(rtmpOutputs, setRtmpOutputs, i, { url: v })}
                placeholder="rtmp://live.example.com/app"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={createStyles.label}>Stream Key</Text>
              <TextInput
                style={createStyles.input}
                value={output.key}
                onChangeText={(v) => updateRtmpRow(rtmpOutputs, setRtmpOutputs, i, { key: v })}
                placeholder="Optional stream key"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={createStyles.removeButton}
                onPress={() => setRtmpOutputs(rtmpOutputs.filter((_, idx) => idx !== i))}
              >
                <Text style={createStyles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          {rtmpOutputs.length < MAX_RTMP ? (
            <TouchableOpacity
              style={createStyles.addButton}
              onPress={() => setRtmpOutputs([...rtmpOutputs, { url: '', key: '' }])}
            >
              <Text style={createStyles.addButtonText}>+ Add RTMP output</Text>
            </TouchableOpacity>
          ) : (
            <Text style={createStyles.maxNote}>Maximum of {MAX_RTMP} RTMP outputs reached.</Text>
          )}

          {error ? (
            <View style={createStyles.errorBox}>
              <Text style={createStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          {saving ? (
            <View style={createStyles.savingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function updateRtmpRow(
  rows: { url: string; key: string }[],
  setRows: (r: { url: string; key: string }[]) => void,
  index: number,
  patch: Partial<{ url: string; key: string }>,
) {
  setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

/** Parse HH:MM:SS to seconds. Returns null if invalid. */
function parseHms(hms: string): number | null {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(hms.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  if (min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

/** Inverse of parseHms — formats seconds as HH:MM:SS. */
function formatHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Validate HH:MM:SS format and range (30s - 43200s). Returns error message or null. */
function validateHms(hms: string): string | null {
  const seconds = parseHms(hms);
  if (seconds == null) return 'Use HH:MM:SS format (e.g. 12:00:00)';
  if (seconds < 30) return 'Minimum DVR window is 30 seconds';
  if (seconds > 43200) return 'Maximum DVR window is 12 hours (43200 seconds)';
  return null;
}

const createStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
  },
  cancelButton: {
    fontSize: 16,
    color: colors.primary,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  textDisabled: {
    color: '#bbb',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.onSurface,
  },
  inputError: {
    borderColor: '#d32f2f',
  },
  textArea: {
    minHeight: 80,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
  },
  toggleText: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    color: colors.onSurface,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  fieldError: {
    color: '#d32f2f',
    fontSize: 12,
    marginTop: 4,
  },
  rtmpRow: {
    marginTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  removeButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  removeButtonText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  addButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  maxNote: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 12,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
  },
  savingRow: {
    alignItems: 'center',
    marginTop: 16,
  },
});

// --- RTMP Ingest Modal ---

const rtmpStyles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    color: colors.onSurface,
    marginRight: 8,
  },
  copyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  unavailable: {
    fontSize: 13,
    color: colors.disabled,
    fontStyle: 'italic',
  },
});

/**
 * Modal showing RTMP ingest details (stream key + primary/backup URLs) for a
 * live stream, with copy-to-clipboard buttons. Mirrors the iOS demo's
 * `LiveStreamIngestDetailsView`.
 */
function RtmpIngestModal({ stream, onClose }: { stream: LiveStream | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = async (value: string, label: string) => {
    await Clipboard.setString(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const streamKey = stream?.streamKey;
  const primaryUrl = stream?.primaryIngestUrl;
  const backupUrl = stream?.backupIngestUrl;

  const copyableRow = (label: string, value: string | null) => {
    if (!value || value.length === 0) {
      return <Text style={rtmpStyles.unavailable}>Not provided by the API for this stream.</Text>;
    }
    return (
      <View style={rtmpStyles.row}>
        <Text style={rtmpStyles.rowText} numberOfLines={2}>
          {value}
        </Text>
        <TouchableOpacity style={rtmpStyles.copyButton} onPress={() => handleCopy(value, label)}>
          <Text style={rtmpStyles.copyButtonText}>{copied === label ? 'Copied!' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={stream != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>RTMP Ingest</Text>

          <View style={rtmpStyles.section}>
            <Text style={rtmpStyles.sectionTitle}>Stream key</Text>
            {copyableRow('Stream key', streamKey ?? null)}
          </View>

          <View style={rtmpStyles.section}>
            <Text style={rtmpStyles.sectionTitle}>Primary ingest URL</Text>
            {copyableRow('Primary URL', primaryUrl ?? null)}
          </View>

          <View style={rtmpStyles.section}>
            <Text style={rtmpStyles.sectionTitle}>Backup ingest URL</Text>
            {copyableRow('Backup URL', backupUrl ?? null)}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.errorButton, { flex: 1 }]} onPress={onClose}>
              <Text style={styles.errorButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
