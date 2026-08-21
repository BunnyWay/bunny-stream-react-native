import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { BunnyStreamPlayer, sourceIdentityKey } from 'bunny-stream-react-native';

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
 * the first video-size event (first frame) or a playback error, and surfaces
 * `onVideoSizeChange` for layout.
 */
export function LivePlayerScreen({ navigation, route }: LivePlayerScreenProps) {
  const { streamId, libraryId, token, expires } = route.params;
  const [loading, setLoading] = React.useState(true);
  const [videoSize, setVideoSize] = React.useState<{ width: number; height: number } | null>(null);

  const source = { type: 'live' as const, streamId, libraryId, token, expires };
  const sourceKey = sourceIdentityKey(source);
  void sourceKey;

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
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <Text style={styles.status}>
        live{videoSize ? ` • ${videoSize.width}x${videoSize.height}` : ''}
      </Text>

      <View style={styles.controlsSection}>
        <Text style={styles.positionText}>
          Stream: {streamId}
          {'\n'}
          Library: {libraryId}
          {token ? `\nToken: ${token.slice(0, 8)}…` : ''}
        </Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
