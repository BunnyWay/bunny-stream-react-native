import type { Video } from '@bunny.net/stream-react-native';

import { BunnyStreamApi, BunnyStreamPlayer } from '@bunny.net/stream-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BUNNY_TOKEN_AUTH_KEY } from '../config';

export function PlayerScreen({ video, onBack }: { video: Video; onBack: () => void }) {
  // Sign a playback token when a key is configured — token-authenticated
  // libraries reject unsigned /play requests, public ones ignore it.
  const { token, expires } = useMemo(
    () => BunnyStreamApi.signPlaybackToken(BUNNY_TOKEN_AUTH_KEY, video.id),
    [video.id],
  );

  return (
    <View style={styles.screen}>
      <BunnyStreamPlayer
        source={{
          type: 'vod',
          videoId: video.id,
          token: token ?? undefined,
          expires: expires ?? undefined,
        }}
        style={styles.player}
        autoPlay
        onReady={() => console.log('[player] ready:', video.id)}
        onError={(e) => console.warn('[player] error:', e.nativeEvent)}
      />
      <View style={styles.overlay}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backLabel}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {video.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  player: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 12,
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
  },
  backLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { color: '#fff', fontSize: 15, flex: 1 },
});
