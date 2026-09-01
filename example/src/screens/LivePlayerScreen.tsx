import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BunnyStreamApi,
  BunnyStreamPlayer,
  LiveStreamStatusEnum,
  getOrNull,
  liveStreamStatusLabel,
  sourceIdentityKey,
  useBunnyStreamPlayer,
  type LiveStream,
  type LiveStreamStatus,
} from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { colors } from '../theme/colors';
import { styles } from '../theme/styles';

type LivePlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'LivePlayer'>;

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

export function LivePlayerScreen({ navigation, route }: LivePlayerScreenProps) {
  const { streamId, libraryId, token, expires } = route.params;
  const [loading, setLoading] = React.useState(true);
  const [videoSize, setVideoSize] = React.useState<{ width: number; height: number } | null>(null);
  const [stream, setStream] = React.useState<LiveStream | null>(null);

  const source = { type: 'live' as const, streamId, libraryId, token, expires };
  const sourceKey = sourceIdentityKey(source);

  const { state, eventHandlers } = useBunnyStreamPlayer(undefined, sourceKey);

  const liveState = state.liveState;
  const isLive = liveState?.isLive ?? false;

  // Fetch live stream metadata for the properties card — mirrors the
  // Android demo's LiveStreamPropertiesCard.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await BunnyStreamApi.getLiveStream(libraryId, streamId);
      const data = getOrNull(result);
      if (!cancelled && data) {
        setStream(data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streamId, libraryId]);

  const status = stream?.status as LiveStreamStatus | undefined;
  const statusColor = status ? (STATUS_COLORS[status] ?? '#aaa') : '#aaa';

  return (
    <View style={styles.playerContainer}>
      <Header title={stream?.title || 'Live Player'} onBack={() => navigation.goBack()} />
      <View style={styles.playerWrapper}>
        <BunnyStreamPlayer
          style={styles.player}
          source={source}
          onVideoSizeChange={(e) => {
            setVideoSize(e.nativeEvent);
            setLoading(false);
          }}
          onLiveStateChange={(e) => {
            setLoading(false);
            eventHandlers.onLiveStateChange?.(e);
          }}
          onLiveError={(e) => {
            setLoading(false);
            eventHandlers.onLiveError?.(e);
          }}
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : null}

        {/* LIVE badge when stream is running */}
        {isLive ? (
          <View style={liveBadgeStyles.container}>
            <View style={liveBadgeStyles.dot} />
            <Text style={liveBadgeStyles.text}>LIVE</Text>
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.content}>
        {/* Countdown display */}
        {liveState?.state === 'countdown' && liveState.targetEpochMs ? (
          <CountdownDisplay targetEpochMs={liveState.targetEpochMs} title={liveState.title} />
        ) : null}

        {/* Terminal live error */}
        {state.liveError ? (
          <View style={playerStyles.errorPanel}>
            <Text style={playerStyles.errorText}>Live error: {state.liveError}</Text>
          </View>
        ) : null}

        {/* Status card — mirrors Android demo's LiveStatusCard */}
        <View style={cardStyles.statusCard}>
          <View style={cardStyles.statusRow}>
            <Text style={cardStyles.cardTitle}>Status</Text>
            <View style={[cardStyles.statusPill, { backgroundColor: statusColor }]}>
              <Text style={cardStyles.statusPillText}>
                {status ? liveStreamStatusLabel(status) : '—'}
              </Text>
            </View>
            {liveState?.reason ? (
              <Text style={cardStyles.reasonText}>({liveState.reason})</Text>
            ) : null}
          </View>
          {liveState?.dvrEnabled ? <Text style={cardStyles.dvrText}>DVR enabled</Text> : null}
        </View>

        {/* Properties card — mirrors Android demo's LiveStreamPropertiesCard */}
        {stream ? <PropertiesCard stream={stream} videoSize={videoSize} /> : null}
      </ScrollView>
    </View>
  );
}

/** Metadata properties card — mirrors the Android demo's LiveStreamPropertiesCard. */
function PropertiesCard({
  stream,
  videoSize,
}: {
  stream: LiveStream;
  videoSize: { width: number; height: number } | null;
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Stream ID', value: stream.id },
    { label: 'Library ID', value: String(stream.videoLibraryId) },
    { label: 'Status', value: liveStreamStatusLabel(stream.status as LiveStreamStatus) },
  ];

  if (videoSize) {
    rows.push({ label: 'Video size', value: `${videoSize.width} × ${videoSize.height}` });
  }

  if (stream.scheduledStartTime) {
    rows.push({ label: 'Scheduled start', value: formatTimestamp(stream.scheduledStartTime) });
  }
  if (stream.startedAt) {
    rows.push({ label: 'Started at', value: formatTimestamp(stream.startedAt) });
  }
  if (stream.endedAt) {
    rows.push({ label: 'Ended at', value: formatTimestamp(stream.endedAt) });
  }
  if (stream.width && stream.height) {
    rows.push({ label: 'Resolution', value: `${stream.width} × ${stream.height}` });
  }
  if (stream.framerate != null) {
    rows.push({ label: 'Framerate', value: `${stream.framerate} fps` });
  }
  if (stream.ingestRegion) {
    rows.push({ label: 'Ingest region', value: stream.ingestRegion });
  }
  if (stream.availableResolutions) {
    rows.push({ label: 'Available resolutions', value: stream.availableResolutions });
  }
  if (stream.peakConcurrentViewers != null) {
    rows.push({ label: 'Peak concurrent viewers', value: String(stream.peakConcurrentViewers) });
  }
  if (stream.totalViewerSeconds != null) {
    rows.push({ label: 'Total viewer seconds', value: String(stream.totalViewerSeconds) });
  }
  rows.push({ label: 'DVR', value: stream.dvrEnabled ? 'On' : 'Off' });
  rows.push({ label: 'Record VOD', value: stream.recordVod ? 'On' : 'Off' });
  if (stream.preStreamTrailerVideoId) {
    rows.push({ label: 'Trailer video ID', value: stream.preStreamTrailerVideoId });
  }
  if (stream.rtmpOutputs.length > 0) {
    rows.push({ label: 'RTMP outputs', value: String(stream.rtmpOutputs.length) });
  }

  return (
    <View style={cardStyles.propsCard}>
      <Text style={cardStyles.cardTitle}>Properties</Text>
      {rows.map((row, i) => (
        <View key={i} style={cardStyles.propRow}>
          <Text style={cardStyles.propLabel}>{row.label}</Text>
          <Text style={cardStyles.propValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Renders a live countdown to `targetEpochMs` (epoch milliseconds). Ticks
 * every second, shows days/hours/minutes/seconds. Mirrors the SDK's native
 * countdown overlay but in JS.
 */
function CountdownDisplay({ targetEpochMs, title }: { targetEpochMs: number; title?: string }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, targetEpochMs - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <View style={countdownStyles.container}>
      {title ? <Text style={countdownStyles.title}>{title} will start in</Text> : null}
      <Text style={countdownStyles.timer}>
        {days > 0 ? `${days}d ` : ''}
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
        {String(seconds).padStart(2, '0')}
      </Text>
    </View>
  );
}

const playerStyles = StyleSheet.create({
  errorPanel: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
  },
});

const liveBadgeStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e53935',
    marginRight: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

const countdownStyles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
    marginBottom: 4,
  },
  timer: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

const cardStyles = StyleSheet.create({
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  propsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 50,
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  reasonText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  dvrText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 8,
  },
  propRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  propLabel: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  propValue: {
    fontSize: 13,
    color: colors.onSurface,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
