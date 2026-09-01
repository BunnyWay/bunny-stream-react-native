import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID } from '@env';
import * as React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
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

  const renderItem = ({ item }: { item: LiveStream }) => (
    <LiveStreamCard stream={item} onWatch={() => handleWatch(item)} />
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
      <CreateLiveStreamModal
        visible={createOpen}
        libraryId={libraryId}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}

/**
 * Renders a single live stream card — mirrors the Android demo's
 * LiveStreamItem: a Row with text metadata + pills on the left, a play
 * button and overflow menu on the right. No thumbnail in the list.
 */
function LiveStreamCard({ stream, onWatch }: { stream: LiveStream; onWatch: () => void }) {
  const status = stream.status as LiveStreamStatus;
  const statusColor = STATUS_COLORS[status] ?? '#aaa';
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Watch is enabled only when the stream has an HLS playback URL.
  // Go live is disabled for terminal states (ENDED / VOD_PROCESSING) — the
  // SDK rejects re-publishing those. Edit and Delete are always enabled.
  // Mirrors the Android demo's LiveStreamsScreen.kt overflow menu logic.
  const canWatch = Boolean(stream.playbackUrlHls);
  const canGoLive =
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
      label: 'Go live',
      action: () => {
        setMenuOpen(false); /* TODO: GoLive */
      },
      disabled: !canGoLive,
    },
    {
      label: 'Edit',
      action: () => {
        setMenuOpen(false); /* TODO: Edit */
      },
    },
    {
      label: 'Delete',
      action: () => {
        setMenuOpen(false); /* TODO: Delete */
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
 * Create live stream modal — a simplified version of the Android demo's
 * LiveStreamEditorScreen. Only `title` is required; other fields are
 * optional toggles. On success, calls `onCreated` which closes the modal
 * and refreshes the list.
 */
function CreateLiveStreamModal({
  visible,
  libraryId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  libraryId: number | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isPublic, setIsPublic] = React.useState(true);
  const [recordVod, setRecordVod] = React.useState(false);
  const [dvrEnabled, setDvrEnabled] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setIsPublic(true);
      setRecordVod(false);
      setDvrEnabled(false);
      setSaving(false);
      setError(null);
    }
  }, [visible]);

  const canSubmit = title.trim().length > 0 && !saving && libraryId != null;

  const handleCreate = async () => {
    if (!canSubmit || libraryId == null) return;
    setSaving(true);
    setError(null);
    const result = await BunnyStreamApi.createLiveStream(libraryId, {
      title: title.trim(),
      description: description.trim() || null,
      isPublic,
      recordVod,
      dvrEnabled,
    });
    fold(
      result,
      () => onCreated(),
      (err) => {
        setError(err.message);
        setSaving(false);
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[createStyles.container, { paddingTop: insets.top }]}>
        <View style={createStyles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Text style={[createStyles.cancelButton, saving && createStyles.disabled]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={createStyles.headerTitle}>New live stream</Text>
          <TouchableOpacity onPress={handleCreate} disabled={!canSubmit}>
            <Text style={[createStyles.saveButton, !canSubmit && createStyles.disabled]}>
              {saving ? 'Creating…' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={createStyles.form}>
          <Text style={createStyles.label}>Title *</Text>
          <TextInput
            style={createStyles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Stream title"
            placeholderTextColor="#999"
            autoFocus
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
            <Text style={createStyles.toggleLabel}>Public</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>

          <View style={createStyles.toggleRow}>
            <Text style={createStyles.toggleLabel}>Record VOD</Text>
            <Switch value={recordVod} onValueChange={setRecordVod} />
          </View>

          <View style={createStyles.toggleRow}>
            <Text style={createStyles.toggleLabel}>DVR enabled</Text>
            <Switch value={dvrEnabled} onValueChange={setDvrEnabled} />
          </View>

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
        </View>
      </View>
    </Modal>
  );
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
  disabled: {
    color: '#bbb',
  },
  form: {
    padding: 16,
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
  toggleLabel: {
    fontSize: 15,
    color: colors.onSurface,
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
