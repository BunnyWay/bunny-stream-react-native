import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlaybackPosition } from 'bunny-stream-react-native';

import { BUNNY_ACCESS_KEY } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  BunnyStreamApi,
  BunnyStreamPlayer,
  fold,
  sourceIdentityKey,
  useBunnyStreamPlayer,
  useResumePosition,
  type Video,
} from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { colors } from '../theme/colors';

type ResumePositionsScreenProps = NativeStackScreenProps<RootStackParamList, 'ResumePositions'>;

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

export function ResumePositionsScreen({ navigation, route }: ResumePositionsScreenProps) {
  const { videoId, libraryId } = route.params;
  const sourceKey = sourceIdentityKey({ type: 'vod', videoId, libraryId });
  const player = useBunnyStreamPlayer(undefined, sourceKey);
  const { state, progress, controls } = player;

  const [videoMeta, setVideoMeta] = React.useState<Video | null>(null);
  const [allPositions, setAllPositions] = React.useState<PlaybackPosition[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Android uses the native SDK; iOS uses the JS fallback.
  const resumeConfig = Platform.OS === 'android' ? {} : undefined;
  const resume = useResumePosition({
    playerRef: player.ref,
    videoId,
    videoTitle: videoMeta?.title,
    storage: Platform.OS === 'ios' ? AsyncStorage : undefined,
  });

  // Fetch video metadata.
  const loadMetadata = React.useCallback(async () => {
    const { token, expires } = BunnyStreamApi.signPlaybackToken(BUNNY_ACCESS_KEY, videoId);
    const result = await BunnyStreamApi.fetchVideoPlayData(libraryId, videoId, token, expires);
    fold(
      result,
      (playData) => setVideoMeta(playData.video ?? null),
      () => {},
    );
  }, [libraryId, videoId]);

  const refreshAllPositions = React.useCallback(async () => {
    if (Platform.OS === 'android') {
      // Android: positions are managed by the native SDK. The JS fallback
      // hook is a no-op, so we show an informational message instead.
      setAllPositions([]);
      return;
    }
    const positions = await resume.getAllPositions();
    setAllPositions(positions);
  }, [resume]);

  React.useEffect(() => {
    void (async () => {
      await loadMetadata();
      await refreshAllPositions();
      setLoading(false);
    })();
  }, [loadMetadata, refreshAllPositions]);

  // Auto-save on iOS when progress changes (throttled by the hook).
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (state.durationMs <= 0) return;
    if (state.playbackState !== 'playing' && state.playbackState !== 'paused') return;
    void resume.savePosition(progress.positionMs, state.durationMs);
  }, [progress.positionMs, state.durationMs, state.playbackState, resume]);

  const handleClear = async () => {
    await resume.clearPosition();
    await refreshAllPositions();
  };

  const handleClearAll = async () => {
    await resume.clearAllPositions();
    await refreshAllPositions();
  };

  const isAndroid = Platform.OS === 'android';

  return (
    <View style={styles.container}>
      <Header title="Resume Positions" onBack={() => navigation.goBack()} />
      <ScrollView>
        {/* Player */}
        <View style={styles.playerWrapper}>
          <BunnyStreamPlayer
            ref={player.ref}
            style={styles.player}
            source={{ type: 'vod', videoId, libraryId }}
            autoPlay
            resumeConfig={resumeConfig}
            onResumePositionAvailable={
              isAndroid
                ? (e) => {
                    const pos = e.nativeEvent.position;
                    // Auto-resume on Android: seek to the saved position.
                    controls.seekTo(pos.positionMs);
                  }
                : undefined
            }
            {...player.eventHandlers}
          />
        </View>

        <Text style={styles.status}>
          {state.playbackState}
          {progress.progress > 0 ? ` • ${formatTime(progress.positionMs)}` : ''}
        </Text>

        {/* Platform info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isAndroid
              ? 'Android — Native SDK'
              : 'iOS — JavaScript fallback (AsyncStorage)'}
          </Text>
          <Text style={styles.cardText}>
            {isAndroid
              ? 'Positions are persisted by the native PlaybackPositionManager. The resumeConfig prop enables auto-save. onResumePositionAvailable fires when a saved position is available.'
              : 'Positions are tracked in JS and persisted to AsyncStorage. The useResumePosition hook saves on progress (throttled) and restores on mount.'}
          </Text>
        </View>

        {/* Current video position */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current video</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Title</Text>
            <Text style={styles.value}>{videoMeta?.title ?? videoId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Position</Text>
            <Text style={styles.value}>{formatTime(progress.positionMs)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>{formatTime(state.durationMs)}</Text>
          </View>
          {resume.restoredPosition ? (
            <View style={styles.row}>
              <Text style={styles.label}>Restored from</Text>
              <Text style={styles.value}>{formatTime(resume.restoredPosition.positionMs)}</Text>
            </View>
          ) : null}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={handleClear}>
              <Text style={styles.buttonText}>Clear this video</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* All saved positions (iOS only) */}
        {!isAndroid ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>All saved positions</Text>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : allPositions.length === 0 ? (
              <Text style={styles.emptyText}>No saved positions yet.</Text>
            ) : (
              allPositions.map((pos) => (
                <View key={pos.videoId} style={styles.positionItem}>
                  <Text style={styles.positionTitle}>{pos.videoTitle || pos.videoId}</Text>
                  <Text style={styles.positionDetail}>
                    {formatTime(pos.positionMs)} / {formatTime(pos.durationMs)} (
                    {(pos.watchPercentage * 100).toFixed(0)}%)
                  </Text>
                  <Text style={styles.positionDate}>{formatDate(pos.timestamp)}</Text>
                </View>
              ))
            )}
            {allPositions.length > 0 ? (
              <TouchableOpacity style={styles.buttonDanger} onPress={handleClearAll}>
                <Text style={styles.buttonTextDanger}>Clear all positions</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>All saved positions</Text>
            <Text style={styles.emptyText}>
              On Android, positions are managed by the native SDK. Use the native player's
              resume UI or query the SDK directly.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  playerWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  player: { flex: 1 },
  status: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
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
  cardText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: { fontSize: 14, color: colors.onSurfaceVariant },
  value: { fontSize: 14, color: colors.onSurface, fontWeight: '500' },
  buttonRow: { marginTop: 12 },
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
  },
  positionItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(24, 61, 109, 0.1)',
  },
  positionTitle: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  positionDetail: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  positionDate: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2, opacity: 0.7 },
});
