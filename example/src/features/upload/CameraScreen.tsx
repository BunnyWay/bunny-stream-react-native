import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
  BunnyStreamBroadcaster,
  type BroadcastQuality,
  type BroadcastState,
  type BunnyStreamBroadcasterRef,
  type CameraPosition,
  type IngestEndpoint,
  type IngestState,
} from '@bunny.net/stream-react-native';

import { Header } from '../../components/Header';
import { OutlineButton } from '../../components/OutlineButton';
import { StatusBanner } from '../../components/StatusBanner';
import { ToggleRow } from '../../components/ToggleRow';
import { requestBroadcastPermissions } from '../../media/permissions';
import { loadLibraryConfig } from '../../storage/settings';
import { Black, colors } from '../../theme/colors';

type CameraScreenProps = NativeStackScreenProps<RootStackParamList, 'Camera'>;

/** Quality presets mirroring iOS `BroadcastQuality` (BroadcastQuality.swift:82-103). */
const QUALITY_PRESETS: { label: string; value: BroadcastQuality }[] = [
  {
    label: '480p · 30fps · 1.2 Mbps',
    value: {
      resolution: 'sd480',
      frameRate: 30,
      videoBitrate: 1_200_000,
      audioBitrate: 128_000,
    },
  },
  {
    label: '720p · 30fps · 2.5 Mbps',
    value: {
      resolution: 'hd720',
      frameRate: 30,
      videoBitrate: 2_500_000,
      audioBitrate: 128_000,
    },
  },
  {
    label: '1080p · 30fps · 4.5 Mbps',
    value: {
      resolution: 'fullHd1080',
      frameRate: 30,
      videoBitrate: 4_500_000,
      audioBitrate: 128_000,
    },
  },
  {
    label: '1080p · 60fps · 6 Mbps',
    value: {
      resolution: 'fullHd1080',
      frameRate: 60,
      videoBitrate: 6_000_000,
      audioBitrate: 128_000,
    },
  },
];

export function CameraScreen({ navigation, route }: CameraScreenProps) {
  const { mode, libraryId } = route.params;
  const streamId = mode === 'live' ? route.params.streamId : undefined;
  const isLive = mode === 'live';

  const [accessKey, setAccessKey] = React.useState<string>('');
  const [permissionsGranted, setPermissionsGranted] = React.useState<boolean | null>(null);
  const [qualityIndex, setQualityIndex] = React.useState(2); // default 1080p30
  const [dualPublish, setDualPublish] = React.useState(false);
  const [cameraPosition, setCameraPosition] = React.useState<CameraPosition>('back');
  const [muted, setMuted] = React.useState(false);
  const [broadcastState, setBroadcastState] = React.useState<BroadcastState>('idle');
  const [elapsed, setElapsed] = React.useState<string>('');
  const [primaryIngest, setPrimaryIngest] = React.useState<IngestState | null>(null);
  const [backupIngest, setBackupIngest] = React.useState<IngestState | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const broadcasterRef = React.useRef<BunnyStreamBroadcasterRef>(null);

  React.useEffect(() => {
    (async () => {
      const { accessKey } = await loadLibraryConfig();
      setAccessKey(accessKey);
      const granted = await requestBroadcastPermissions();
      setPermissionsGranted(granted);
    })();
  }, []);

  const handleStateChange = React.useCallback((event: { state: BroadcastState }) => {
    setBroadcastState(event.state);
  }, []);

  const handleElapsedTime = React.useCallback((event: { elapsedMs: number; formatted: string }) => {
    setElapsed(event.formatted);
  }, []);

  const handleCameraChange = React.useCallback((event: { position: CameraPosition }) => {
    setCameraPosition(event.position);
  }, []);

  const handleMuteChange = React.useCallback((event: { muted: boolean }) => {
    setMuted(event.muted);
  }, []);

  const handleIngestStateChange = React.useCallback(
    (event: { endpoint: IngestEndpoint; state: IngestState }) => {
      if (event.endpoint === 'primary') setPrimaryIngest(event.state);
      else setBackupIngest(event.state);
    },
    [],
  );

  const handleError = React.useCallback((event: { message: string }) => {
    setErrorMsg(event.message);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      try {
        broadcasterRef.current?.stopBroadcast();
      } catch {
        // ignore
      }
    };
  }, []);

  if (permissionsGranted === null) {
    return (
      <>
        <Header title={isLive ? 'Go Live' : 'Camera'} onBack={() => navigation.goBack()} />
        <View style={cameraStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={cameraStyles.loadingText}>Requesting permissions…</Text>
        </View>
      </>
    );
  }

  if (!permissionsGranted) {
    return (
      <>
        <Header title={isLive ? 'Go Live' : 'Camera'} onBack={() => navigation.goBack()} />
        <View style={cameraStyles.permissionContainer}>
          <Text style={cameraStyles.permissionTitle}>Permissions required</Text>
          <Text style={cameraStyles.permissionText}>
            Camera and microphone permissions are required to record and broadcast. Grant them in
            Settings and reopen this screen.
          </Text>
        </View>
      </>
    );
  }

  if (!accessKey) {
    return (
      <>
        <Header title={isLive ? 'Go Live' : 'Camera'} onBack={() => navigation.goBack()} />
        <View style={cameraStyles.permissionContainer}>
          <Text style={cameraStyles.permissionTitle}>Not configured</Text>
          <Text style={cameraStyles.permissionText}>
            Set your access key and library ID in Settings first.
          </Text>
        </View>
      </>
    );
  }

  const source =
    mode === 'live'
      ? { type: 'live' as const, libraryId, streamId: streamId! }
      : { type: 'new' as const, libraryId };

  const quality = Platform.OS === 'ios' ? QUALITY_PRESETS[qualityIndex].value : undefined;
  // On Android, startBroadcast only works when the built-in controls are
  // visible (it simulates pressing the native start button). On iOS,
  // startBroadcast is a native command, so we can hide controls.
  const hideDefaultControls = Platform.OS === 'ios';

  return (
    <View style={cameraStyles.container}>
      <Header title={isLive ? 'Go Live' : 'Camera'} onBack={() => navigation.goBack()} />

      {/* Camera preview */}
      <View style={cameraStyles.previewContainer}>
        <BunnyStreamBroadcaster
          ref={broadcasterRef}
          accessKey={accessKey}
          source={source}
          quality={quality}
          cameraPosition={cameraPosition}
          hideDefaultControls={hideDefaultControls}
          dualPublish={dualPublish}
          onStateChange={handleStateChange}
          onElapsedTime={handleElapsedTime}
          onCameraChange={handleCameraChange}
          onMuteChange={handleMuteChange}
          onIngestStateChange={handleIngestStateChange}
          onError={handleError}
          style={cameraStyles.preview}
        />

        {/* Status overlay */}
        <View style={cameraStyles.statusBar}>
          <View
            style={[
              cameraStyles.stateBadge,
              broadcastState === 'live' && cameraStyles.stateBadgeLive,
              broadcastState === 'preparing' && cameraStyles.stateBadgePreparing,
            ]}
          >
            <Text style={cameraStyles.stateBadgeText}>
              {broadcastState === 'live'
                ? 'LIVE'
                : broadcastState === 'preparing'
                  ? 'PREPARING'
                  : 'IDLE'}
            </Text>
          </View>
          {elapsed ? <Text style={cameraStyles.elapsedText}>{elapsed}</Text> : null}
          {isLive ? (
            <View style={cameraStyles.ingestBadges}>
              <IngestBadge label="P" state={primaryIngest} />
              <IngestBadge label="B" state={backupIngest} />
            </View>
          ) : null}
        </View>
      </View>

      {/* Controls */}
      <ScrollView
        style={cameraStyles.controls}
        contentContainerStyle={cameraStyles.controlsContent}
      >
        {errorMsg ? <StatusBanner message={errorMsg} style={cameraStyles.errorSpacing} /> : null}

        {/* Quality picker (iOS only) */}
        {Platform.OS === 'ios' ? (
          <View style={cameraStyles.section}>
            <Text style={cameraStyles.sectionLabel}>Quality</Text>
            <View style={cameraStyles.qualityRow}>
              {QUALITY_PRESETS.map((preset, i) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    cameraStyles.qualityButton,
                    i === qualityIndex && cameraStyles.qualityButtonActive,
                  ]}
                  onPress={() => setQualityIndex(i)}
                >
                  <Text
                    style={[
                      cameraStyles.qualityButtonText,
                      i === qualityIndex && cameraStyles.qualityButtonTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <Text style={cameraStyles.platformNote}>
            Quality is fixed by the Android SDK (1080p30, ~9.3 Mbps).
          </Text>
        )}

        {/* Dual publish toggle (live only) */}
        {isLive ? (
          <ToggleRow
            label="Dual publish (primary + backup)"
            value={dualPublish}
            onValueChange={setDualPublish}
            style={cameraStyles.toggleRow}
          />
        ) : null}

        {/* Action buttons */}
        <View style={cameraStyles.actionsRow}>
          {broadcastState === 'idle' || broadcastState === 'preparing' ? (
            <TouchableOpacity
              style={cameraStyles.actionPrimary}
              onPress={() => broadcasterRef.current?.startBroadcast()}
            >
              <Text style={cameraStyles.actionPrimaryText}>Start</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[cameraStyles.actionPrimary, cameraStyles.actionDanger]}
              onPress={() => broadcasterRef.current?.stopBroadcast()}
            >
              <Text style={cameraStyles.actionPrimaryText}>Stop</Text>
            </TouchableOpacity>
          )}
          <OutlineButton
            label="Switch camera"
            onPress={() => broadcasterRef.current?.switchCamera()}
          />
          <OutlineButton
            label={muted ? 'Unmute' : 'Mute'}
            onPress={() => broadcasterRef.current?.toggleMute()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function IngestBadge({ label, state }: { label: string; state: IngestState | null }) {
  const color =
    state === 'live' ? colors.success : state === 'connecting' ? colors.warning : colors.neutral;
  return (
    <View style={[cameraStyles.ingestBadge, { backgroundColor: color }]}>
      <Text style={cameraStyles.ingestBadgeText}>{label}</Text>
    </View>
  );
}

const cameraStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.onSurfaceVariant,
    marginTop: 12,
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  preview: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.neutralDark,
  },
  stateBadgeLive: {
    backgroundColor: colors.error,
  },
  stateBadgePreparing: {
    backgroundColor: colors.warning,
  },
  stateBadgeText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  elapsedText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontFamily: 'monospace',
    textShadowColor: Black,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  ingestBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  ingestBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingestBadgeText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  controls: {
    maxHeight: 360,
    backgroundColor: colors.background,
  },
  controlsContent: {
    padding: 16,
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  platformNote: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  qualityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qualityButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  qualityButtonActive: {
    backgroundColor: colors.primary,
  },
  qualityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  qualityButtonTextActive: {
    color: colors.onPrimary,
  },
  toggleRow: {
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  actionDanger: {
    backgroundColor: colors.error,
  },
  actionPrimaryText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  errorSpacing: {
    marginBottom: 12,
  },
});
