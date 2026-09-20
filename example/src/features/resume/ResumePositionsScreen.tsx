import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlaybackPosition } from 'bunny-stream-react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  cleanupExpiredResumePositions,
  clearAllResumePositions,
  clearResumePosition,
  exportResumePositions,
  getAllResumePositions,
  importResumePositions,
} from 'bunny-stream-react-native';

import { Header } from '../../components/Header';
import { loadResumeSettings } from '../../storage/resumeSettings';
import { colors } from '../../theme/colors';

type ResumePositionsScreenProps = NativeStackScreenProps<RootStackParamList, 'ResumePositions'>;

/** AsyncStorage satisfies the library's ResumePositionStorage contract. */
const iosStorage = Platform.OS === 'ios' ? AsyncStorage : undefined;

function formatTime(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Manage Resume Positions — list-only screen matching the Android demo's
 * ResumePositionManagementScreen. Tapping a position opens the Player, which
 * shows the resume confirmation dialog.
 */
export function ResumePositionsScreen({ navigation, route }: ResumePositionsScreenProps) {
  const { libraryId } = route.params;

  const [allPositions, setAllPositions] = React.useState<PlaybackPosition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [retentionDays, setRetentionDays] = React.useState(7);
  const [exportedJson, setExportedJson] = React.useState<string | null>(null);
  const [importVisible, setImportVisible] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  const refreshAllPositions = React.useCallback(async () => {
    setAllPositions(await getAllResumePositions(iosStorage));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const settings = await loadResumeSettings();
      const positions = await getAllResumePositions(iosStorage);
      if (cancelled) return;
      setRetentionDays(settings.retentionDays);
      setAllPositions(positions);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh when returning from the Player (positions may have changed).
  React.useEffect(
    () => navigation.addListener('focus', () => void refreshAllPositions()),
    [navigation, refreshAllPositions],
  );

  const handlePositionPress = (pos: PlaybackPosition) => {
    navigation.navigate('Player', { videoId: pos.videoId, libraryId });
  };

  const handleDelete = async (pos: PlaybackPosition) => {
    await clearResumePosition(pos.videoId, iosStorage);
    await refreshAllPositions();
  };

  const handleClearAll = async () => {
    await clearAllResumePositions(iosStorage);
    await refreshAllPositions();
    setActionMessage('All positions cleared.');
  };

  const handleExport = async () => {
    setExportedJson(await exportResumePositions(iosStorage));
  };

  const handleImport = async () => {
    const ok = await importResumePositions(importText, iosStorage);
    setImportVisible(false);
    setImportText('');
    setActionMessage(ok ? 'Positions imported.' : 'Import failed — invalid JSON payload.');
    await refreshAllPositions();
  };

  const handleCleanup = async () => {
    await cleanupExpiredResumePositions(iosStorage, retentionDays);
    await refreshAllPositions();
    setActionMessage('Expired positions cleaned up.');
  };

  return (
    <View style={styles.container}>
      <Header title="Resume Positions" onBack={() => navigation.goBack()} />
      <ScrollView>
        {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}

        {/* All saved positions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saved positions</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : allPositions.length === 0 ? (
            <Text style={styles.emptyText}>
              No saved positions yet. Play a video — the player saves your position and asks whether
              to resume on the next visit.
            </Text>
          ) : (
            allPositions.map((pos) => (
              <TouchableOpacity
                key={pos.videoId}
                style={styles.positionItem}
                onPress={() => handlePositionPress(pos)}
              >
                <View style={styles.positionInfo}>
                  <Text style={styles.positionTitle}>{pos.videoTitle || pos.videoId}</Text>
                  <Text style={styles.positionDetail}>
                    {formatTime(pos.positionMs)} / {formatTime(pos.durationMs)} (
                    {(pos.watchPercentage * 100).toFixed(0)}%)
                  </Text>
                  <Text style={styles.positionDate}>{formatDate(pos.timestamp)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => void handleDelete(pos)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => void handleExport()}
              disabled={allPositions.length === 0}
            >
              <Text style={styles.actionButtonText}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setImportVisible(true)}>
              <Text style={styles.actionButtonText}>Import</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => void handleCleanup()}>
              <Text style={styles.actionButtonText}>Cleanup</Text>
            </TouchableOpacity>
          </View>
          {allPositions.length > 0 ? (
            <TouchableOpacity style={styles.buttonDanger} onPress={() => void handleClearAll()}>
              <Text style={styles.buttonTextDanger}>Clear all positions</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      {/* Export dialog — selectable JSON payload */}
      <Modal
        visible={exportedJson !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExportedJson(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Export positions</Text>
            <TextInput
              style={styles.jsonInput}
              value={exportedJson ?? ''}
              multiline
              editable={false}
            />
            <TouchableOpacity style={styles.button} onPress={() => setExportedJson(null)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Import dialog — paste a JSON array of PlaybackPosition */}
      <Modal
        visible={importVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Import positions</Text>
            <TextInput
              style={styles.jsonInput}
              value={importText}
              onChangeText={setImportText}
              multiline
              placeholder='[{"videoId":"…","positionMs":…,"durationMs":…,"timestamp":…}]'
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => setImportVisible(false)}>
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => void handleImport()}>
                <Text style={styles.actionButtonText}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  actionMessage: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 13,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
  buttonDanger: {
    backgroundColor: 'rgba(176, 0, 32, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonTextDanger: { color: '#B00020', fontSize: 14, fontWeight: '600' },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  positionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(24, 61, 109, 0.1)',
  },
  positionInfo: { flex: 1 },
  positionTitle: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  positionDetail: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  positionDate: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2, opacity: 0.7 },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(176, 0, 32, 0.1)',
  },
  deleteButtonText: { color: '#B00020', fontSize: 13, fontWeight: '600' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(24, 61, 109, 0.1)',
  },
  actionButtonText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 12,
  },
  jsonInput: {
    borderWidth: 1,
    borderColor: 'rgba(24, 61, 109, 0.2)',
    borderRadius: 8,
    padding: 10,
    minHeight: 120,
    maxHeight: 220,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.onSurface,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
});
