import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import {
  BunnyStreamPlayer,
  sourceIdentityKey,
  useBunnyStreamPlayer,
} from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { styles } from '../theme/styles';

type LivePlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'LivePlayer'>;

/**
 * Live player screen — renders the native live host (Compose-backed
 * `BunnyLiveStreamPlayer`) with the SDK's built-in countdown / trailer /
 * DVR / recovery overlays.
 *
 * No custom JS controls today — the SDK does not yet expose a public live
 * controller (PLAN.md §6 Faza 5). The screen shows a loading overlay until
 * the first video-size event (first frame) or a live state transition, and
 * surfaces `liveState` (isLive / state / countdown / dvr) from the hook.
 */
export function LivePlayerScreen({ navigation, route }: LivePlayerScreenProps) {
  const { streamId, libraryId, token, expires } = route.params;
  const [loading, setLoading] = React.useState(true);
  const [videoSize, setVideoSize] = React.useState<{ width: number; height: number } | null>(null);

  const source = { type: 'live' as const, streamId, libraryId, token, expires };
  const sourceKey = sourceIdentityKey(source);

  const { state, eventHandlers } = useBunnyStreamPlayer(undefined, sourceKey);

  const liveState = state.liveState;
  const isLive = liveState?.isLive ?? false;

  return (
    <View style={styles.playerContainer}>
      <Header title="Live Player" onBack={() => navigation.goBack()} />
      <View style={styles.playerWrapper}>
        <BunnyStreamPlayer
          style={styles.player}
          source={source}
          onVideoSizeChange={(e) => {
            setVideoSize(e.nativeEvent);
            setLoading(false);
          }}
          onLiveStateChange={(e) => {
            // Dismiss loading as soon as we get any state (not just first frame).
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

      <Text style={styles.status}>
        {liveState ? liveState.state : 'idle'}
        {isLive ? ' • LIVE' : ''}
        {videoSize ? ` • ${videoSize.width}x${videoSize.height}` : ''}
        {liveState?.dvrEnabled ? ' • DVR' : ''}
      </Text>

      {/* Countdown display */}
      {liveState?.state === 'countdown' && liveState.targetEpochMs ? (
        <CountdownDisplay targetEpochMs={liveState.targetEpochMs} title={liveState.title} />
      ) : null}

      {/* Terminal live error */}
      {state.liveError ? (
        <Text style={styles.errorMessage}>Live error: {state.liveError}</Text>
      ) : null}

      <View style={styles.controlsSection}>
        <Text style={styles.positionText}>
          Stream: {streamId}
          {'\n'}
          Library: {libraryId}
          {token ? `\nToken: ${token.slice(0, 8)}…` : ''}
          {'\n'}State: {liveState?.state ?? '—'}
          {liveState?.reason ? ` (${liveState.reason})` : ''}
        </Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Renders a live countdown to `targetEpochMs` (epoch milliseconds). Ticks
 * every second, shows days/hours/minutes/seconds. Mirrors the SDK's native
 * countdown overlay but in JS — useful when the host app wants to customize
 * the countdown UI.
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

import { StyleSheet } from 'react-native';

const liveBadgeStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(204, 0, 0, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 4,
  },
  timer: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
