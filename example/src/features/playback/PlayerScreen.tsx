import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
  getPlaybackSpeeds,
  sourceIdentityKey,
  useBunnyStreamPlayer,
  useResumePosition,
  videoStatusLabel,
  type BunnyStreamSource,
  type PlaybackPosition,
  type PlayerType,
  type Video,
  type VideoStatus,
} from '@bunny.net/stream-react-native';

import { Header } from '../../components/Header';
import { ProgressBar } from '../../components/ProgressBar';
import { PropertiesCard } from '../../components/PropertiesCard';
import { ResumeDialog } from '../../components/ResumeDialog';
import { ToggleRow } from '../../components/ToggleRow';
import {
  DEFAULT_RESUME_SETTINGS,
  loadResumeSettings,
  toResumeConfig,
} from '../../storage/resumeSettings';
import { Black, colors } from '../../theme/colors';
import { styles } from '../../theme/styles';
import { formatBytes, formatDuration, formatTime } from '../../utils/format';

const FALLBACK_SPEEDS = [0.5, 1.0, 1.5, 2.0];
const SEEK_MS = 10_000;
const STATUS_POLL_INTERVAL_MS = 5_000;

type PlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'Player'>;

export function PlayerScreen({ navigation, route }: PlayerScreenProps) {
  const { videoId, libraryId } = route.params;
  const source: BunnyStreamSource = { type: 'vod', videoId, libraryId };
  const sourceKey = sourceIdentityKey(source);
  const player = useBunnyStreamPlayer(
    { onPlaybackRateChange: (e) => setCurrentSpeed(e.rate) },
    sourceKey,
  );

  const { state, progress, controls } = player;
  const loading = state.playbackState === 'idle' || state.playbackState === 'loading';

  const [currentSpeed, setCurrentSpeed] = React.useState(1.0);
  const [speedOptions, setSpeedOptions] = React.useState<number[]>(FALLBACK_SPEEDS);
  const [useCustomControls, setUseCustomControls] = React.useState(false);
  const [videoMeta, setVideoMeta] = React.useState<Video | null>(null);
  const [metaLoading, setMetaLoading] = React.useState(true);
  const [playerType, setPlayerType] = React.useState<PlayerType>('default');
  const [resumeSettings, setResumeSettings] = React.useState(DEFAULT_RESUME_SETTINGS);
  const [resumePosition, setResumePosition] = React.useState<PlaybackPosition | null>(null);
  // Remount key for the Retry action in the playback-error overlay.
  const [playbackAttempt, setPlaybackAttempt] = React.useState(0);

  const isAndroid = Platform.OS === 'android';

  // Debug logs — the source and any player error. Useful for diagnosing
  // platform-specific playback failures (e.g. token auth 403s).
  React.useEffect(() => {
    console.log('[PlayerScreen] playback source', {
      platform: Platform.OS,
      ...source,
      token: source.token ? 'signed' : 'none',
    });
  }, [videoId, libraryId]);

  React.useEffect(() => {
    if (state.error) {
      console.warn('[PlayerScreen] playback error', state.error);
    }
  }, [state.error]);

  // Load persisted resume settings (and refresh them when returning from the
  // settings screen).
  React.useEffect(() => {
    const refresh = () => void loadResumeSettings().then(setResumeSettings);
    refresh();
    return navigation.addListener('focus', refresh);
  }, [navigation]);

  // Query the speeds the player offers — native engine on Android, SDK's
  // hardcoded list on iOS.
  React.useEffect(() => {
    let cancelled = false;
    void getPlaybackSpeeds().then((speeds) => {
      if (!cancelled && speeds.length > 0) setSpeedOptions(speeds);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // iOS JS fallback resume — the native iOS SDK has no resume API, so the
  // hook tracks progress into AsyncStorage. `onPositionAvailable` returns
  // false to suppress the hook's auto-seek; the user decides in the dialog.
  const iosResume = useResumePosition({
    playerRef: player.ref,
    videoId,
    videoTitle: videoMeta?.title,
    config: resumeSettings.enabled ? toResumeConfig(resumeSettings) : undefined,
    storage: !isAndroid && resumeSettings.enabled ? AsyncStorage : undefined,
    onPositionAvailable: (pos) => {
      setResumePosition(pos);
      return false;
    },
  });

  // Auto-save on iOS while playing/paused (throttled by the hook).
  React.useEffect(() => {
    if (isAndroid || !resumeSettings.enabled) return;
    if (state.durationMs <= 0) return;
    if (state.playbackState !== 'playing' && state.playbackState !== 'paused') return;
    void iosResume.savePosition(progress.positionMs, state.durationMs);
  }, [
    isAndroid,
    resumeSettings.enabled,
    progress.positionMs,
    state.durationMs,
    state.playbackState,
    iosResume,
  ]);

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
      (error) => {
        console.warn('[PlayerScreen] fetchVideoPlayData failed:', error);
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

  const seekProgress =
    state.durationMs > 0 ? progress.positionMs / state.durationMs : progress.progress;

  const progressPct = `${(progress.progress * 100).toFixed(0)}%`;

  // Transitional video states (created/uploaded/processing/transcoding) get a
  // placeholder instead of the player — the metadata poll above reloads the
  // player automatically once encoding finishes.
  const isTransitional = videoMeta ? [0, 1, 2, 3].includes(videoMeta.status as VideoStatus) : false;

  // Build the metadata properties list (like Android demo's VideoPropertiesCard).
  const metaProperties: { label: string; value: string }[] = videoMeta
    ? [
        { label: 'Title', value: videoMeta.title || 'N/A' },
        { label: 'Duration', value: formatDuration(videoMeta.lengthSeconds) },
        { label: 'Views', value: String(videoMeta.views) },
        { label: 'Size', value: formatBytes(videoMeta.storageSizeBytes) },
        ...(videoMeta.status !== 4
          ? [{ label: 'Status', value: videoStatusLabel(videoMeta.status as VideoStatus) }]
          : []),
      ]
    : [];

  return (
    <View style={styles.playerContainer}>
      <Header title="Player" onBack={() => navigation.goBack()} />
      <View style={styles.playerWrapper}>
        {isTransitional ? (
          <View style={styles.transitionalOverlay}>
            <ActivityIndicator size="large" color={colors.onPrimary} />
            <Text style={styles.transitionalText}>
              {videoStatusLabel(videoMeta?.status as VideoStatus)} — playback starts automatically
              once encoding finishes.
            </Text>
          </View>
        ) : (
          <BunnyStreamPlayer
            key={playbackAttempt}
            ref={player.ref}
            style={styles.player}
            source={source}
            autoPlay
            controls={!useCustomControls}
            resumeConfig={
              isAndroid && resumeSettings.enabled ? toResumeConfig(resumeSettings) : undefined
            }
            onResumePositionAvailable={
              isAndroid ? (e) => setResumePosition(e.nativeEvent.position) : undefined
            }
            onPlayerTypeChange={(e) => setPlayerType(e.nativeEvent.playerType)}
            {...player.eventHandlers}
          />
        )}

        {loading && !isTransitional ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.onPrimary} />
          </View>
        ) : null}

        {playerType === 'cast' ? (
          <View style={playerScreenStyles.castChip}>
            <Text style={playerScreenStyles.castChipText}>Casting</Text>
          </View>
        ) : null}

        {state.error && !isTransitional ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>Playback Error</Text>
            <Text style={styles.errorMessage}>{state.error.message}</Text>
            <Text style={styles.errorVideoId} numberOfLines={1}>
              Video ID: {videoId}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setPlaybackAttempt((n) => n + 1)}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, playerScreenStyles.primaryButtonSecondary]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.primaryButtonText}>Go Back</Text>
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
        <ToggleRow
          label="Custom controls"
          value={useCustomControls}
          onValueChange={setUseCustomControls}
          style={playerScreenStyles.toggleRow}
        />

        {/* Custom JS controls — only rendered when built-in controls are off */}
        {useCustomControls ? (
          <View style={styles.controlsSection}>
            <ProgressBar progress={seekProgress} style={styles.positionBar} />
            <Text style={styles.positionText}>
              {formatTime(progress.positionMs)} / {formatTime(state.durationMs)}
            </Text>

            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => controls.skipBackward(SEEK_MS)}
              >
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

              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => controls.skipForward(SEEK_MS)}
              >
                <Text style={styles.controlButtonLabel}>+10s</Text>
              </TouchableOpacity>

              {Platform.OS === 'android' ? (
                <TouchableOpacity style={styles.controlButton} onPress={controls.enterPiP}>
                  <Text style={styles.controlButtonLabel}>PiP</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Speed picker — visible alongside custom controls */}
            <Text style={styles.speedTitle}>Playback Speed</Text>
            <View style={styles.speedRow}>
              {speedOptions.map((speed) => {
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
              {speedOptions.map((speed) => {
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
          <View style={metaStyles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primary} style={{ padding: 16 }} />
          </View>
        ) : metaProperties.length > 0 ? (
          <PropertiesCard rows={metaProperties} style={metaStyles.card} />
        ) : null}
      </ScrollView>

      {/* Resume confirmation — same semantics as the Android demo's
          ResumeDialog: Resume seeks, Start Over / dismiss leaves the saved
          position untouched. */}
      <ResumeDialog
        position={resumePosition}
        onResume={(pos) => {
          controls.seekTo(pos.positionMs);
          setResumePosition(null);
        }}
        onStartOver={() => setResumePosition(null)}
      />
    </View>
  );
}

const playerScreenStyles = StyleSheet.create({
  castChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.scrimDark,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  castChipText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButtonSecondary: {
    marginTop: 8,
    backgroundColor: colors.onPrimary15,
  },
  toggleRow: {
    paddingHorizontal: 16,
  },
});

const metaStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: Black,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
