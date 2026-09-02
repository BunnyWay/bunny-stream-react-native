import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_ACCESS_KEY } from '@env';
import * as React from 'react';
import {
  ActivityIndicator,
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
  videoStatusLabel,
  type Video,
  type VideoStatus,
} from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { colors } from '../theme/colors';
import { styles } from '../theme/styles';

const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0];
const SEEK_MS = 10_000;
const STATUS_POLL_INTERVAL_MS = 5_000;

function formatTime(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

type PlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'Player'>;

export function PlayerScreen({ navigation, route }: PlayerScreenProps) {
  const { videoId, libraryId } = route.params;
  const sourceKey = sourceIdentityKey({ type: 'vod', videoId, libraryId });
  const player = useBunnyStreamPlayer(undefined, sourceKey);

  const { state, progress, controls } = player;
  const loading = state.playbackState === 'idle' || state.playbackState === 'loading';

  const [currentSpeed, setCurrentSpeed] = React.useState(1.0);
  const [useCustomControls, setUseCustomControls] = React.useState(false);
  const [videoMeta, setVideoMeta] = React.useState<Video | null>(null);
  const [metaLoading, setMetaLoading] = React.useState(true);

  // Fetch video metadata via fetchVideoPlayData (like the Android demo's
  // PlayerViewModel.fetchVideo). The play data carries the video object with
  // title, duration, status, size, views — shown in a properties card below
  // the player, identical to the Android demo's VideoPropertiesCard.
  const loadMetadata = React.useCallback(async () => {
    const { token, expires } = BunnyStreamApi.signPlaybackToken(BUNNY_ACCESS_KEY, videoId);
    const result = await BunnyStreamApi.fetchVideoPlayData(libraryId, videoId, token, expires);
    fold(
      result,
      (playData) => {
        setVideoMeta(playData.video ?? null);
        setMetaLoading(false);
      },
      () => {
        setMetaLoading(false);
      },
    );
  }, [libraryId, videoId]);

  React.useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Poll metadata while the video is in a transitional state, so playback
  // starts by itself once encoding finishes (like PlayerViewModel.onStatusPollTick).
  React.useEffect(() => {
    if (!videoMeta) return;
    const status = videoMeta.status as VideoStatus;
    const isTransitional = [0, 1, 2, 3].includes(status);
    if (!isTransitional) return;

    const id = setInterval(loadMetadata, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [videoMeta, loadMetadata]);

  const handleSpeedChange = (speed: number) => {
    setCurrentSpeed(speed);
    controls.setPlaybackRate(speed);
  };

  const handleSeek = (deltaMs: number) => {
    const target = Math.max(0, Math.min(progress.positionMs + deltaMs, state.durationMs));
    controls.seekTo(target);
  };

  const seekProgress =
    state.durationMs > 0 ? progress.positionMs / state.durationMs : progress.progress;

  const progressPct = `${(progress.progress * 100).toFixed(0)}%`;

  // Build the metadata properties list (like Android demo's VideoPropertiesCard).
  const metaProperties: { label: string; value: string }[] = videoMeta
    ? [
        { label: 'Title', value: videoMeta.title || 'N/A' },
        { label: 'Duration', value: formatDuration(videoMeta.lengthSeconds) },
        { label: 'Views', value: String(videoMeta.views) },
        { label: 'Size', value: formatSize(videoMeta.storageSizeBytes) },
        ...(videoMeta.status !== 4
          ? [{ label: 'Status', value: videoStatusLabel(videoMeta.status as VideoStatus) }]
          : []),
      ]
    : [];

  return (
    <View style={styles.playerContainer}>
      <Header title="Player" onBack={() => navigation.goBack()} />
      <View style={styles.playerWrapper}>
        <BunnyStreamPlayer
          ref={player.ref}
          style={styles.player}
          source={{ type: 'vod', videoId, libraryId }}
          autoPlay
          controls={!useCustomControls}
          {...player.eventHandlers}
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : null}

        {state.error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>Playback Error</Text>
            <Text style={styles.errorMessage}>{state.error.message}</Text>
            <Text style={styles.errorVideoId} numberOfLines={1}>
              Video ID: {videoId}
            </Text>
            <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ScrollView>
        <Text style={styles.status}>
          {state.playbackState}
          {progress.progress > 0 ? ` • progress ${progressPct}` : ''}
        </Text>

        {/* Toggle: built-in native controls ↔ custom JS controls */}
        <View style={toggleStyles.row}>
          <Text style={toggleStyles.label}>Custom controls</Text>
          <TouchableOpacity
            style={[toggleStyles.switch, useCustomControls && toggleStyles.switchOn]}
            onPress={() => setUseCustomControls((v) => !v)}
          >
            <View style={[toggleStyles.knob, useCustomControls && toggleStyles.knobOn]} />
          </TouchableOpacity>
        </View>

        {/* Custom JS controls — only rendered when built-in controls are off */}
        {useCustomControls ? (
          <View style={styles.controlsSection}>
            <View style={styles.positionBar}>
              <View style={[styles.positionBarFill, { width: `${seekProgress * 100}%` }]} />
            </View>
            <Text style={styles.positionText}>
              {formatTime(progress.positionMs)} / {formatTime(state.durationMs)}
            </Text>

            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.controlButton} onPress={() => handleSeek(-SEEK_MS)}>
                <Text style={styles.controlButtonLabel}>-10s</Text>
              </TouchableOpacity>

              {state.isPlaying ? (
                <TouchableOpacity style={styles.controlButtonPrimary} onPress={controls.pause}>
                  <PauseIcon />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.controlButtonPrimary} onPress={controls.play}>
                  <PlayIcon />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.controlButton} onPress={() => handleSeek(SEEK_MS)}>
                <Text style={styles.controlButtonLabel}>+10s</Text>
              </TouchableOpacity>
            </View>

            {/* Speed picker — visible alongside custom controls */}
            <Text style={styles.speedTitle}>Playback Speed</Text>
            <View style={styles.speedRow}>
              {SPEED_OPTIONS.map((speed) => {
                const isActive = speed === currentSpeed;
                return (
                  <TouchableOpacity
                    key={speed}
                    style={[styles.speedButton, isActive && styles.speedButtonActive]}
                    onPress={() => handleSpeedChange(speed)}
                  >
                    <Text
                      style={[styles.speedButtonText, isActive && styles.speedButtonTextActive]}
                    >
                      {speed}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          /* Speed picker — shown with native controls too */
          <View style={styles.speedSection}>
            <Text style={styles.speedTitle}>Playback Speed</Text>
            <View style={styles.speedRow}>
              {SPEED_OPTIONS.map((speed) => {
                const isActive = speed === currentSpeed;
                return (
                  <TouchableOpacity
                    key={speed}
                    style={[styles.speedButton, isActive && styles.speedButtonActive]}
                    onPress={() => handleSpeedChange(speed)}
                  >
                    <Text
                      style={[styles.speedButtonText, isActive && styles.speedButtonTextActive]}
                    >
                      {speed}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Video metadata card — like Android demo's VideoPropertiesCard */}
        {metaLoading ? (
          <View style={metaStyles.card}>
            <ActivityIndicator size="small" color={colors.primary} style={{ padding: 16 }} />
          </View>
        ) : metaProperties.length > 0 ? (
          <View style={metaStyles.card}>
            {metaProperties.map((prop, idx) => (
              <View key={prop.label}>
                <View style={metaStyles.row}>
                  <Text style={metaStyles.label}>{prop.label}</Text>
                  <Text style={metaStyles.value}>{prop.value}</Text>
                </View>
                {idx < metaProperties.length - 1 ? <View style={metaStyles.divider} /> : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    color: colors.onSurface,
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(24, 61, 109, 0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: {
    backgroundColor: colors.primary,
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
});

const metaStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    color: colors.onSurface,
  },
  value: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(24, 61, 109, 0.18)',
    marginHorizontal: 16,
  },
});

// --- Vector icons drawn with pure Views (no icon library dependency) ---

/** Filled right-pointing triangle — play. */
function PlayIcon() {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: 11,
        borderBottomWidth: 11,
        borderLeftWidth: 17,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: colors.onPrimary,
        marginLeft: 3,
      }}
    />
  );
}

/** Two vertical bars — pause. */
function PauseIcon() {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      <View style={{ width: 5, height: 22, backgroundColor: colors.onPrimary, borderRadius: 1 }} />
      <View style={{ width: 5, height: 22, backgroundColor: colors.onPrimary, borderRadius: 1 }} />
    </View>
  );
}
