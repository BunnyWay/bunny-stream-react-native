import type { Video } from '@bunny.net/stream-react-native';

import { initialize } from '@bunny.net/stream-react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID, isConfigured } from './config';
import { PlayerScreen } from './screens/PlayerScreen';
import { VideoListScreen } from './screens/VideoListScreen';

type StartupState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export default function App() {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [startupState, setStartupState] = useState<StartupState>({ status: 'loading' });

  useEffect(() => {
    if (!isConfigured) return;
    try {
      initialize(BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID);
      setStartupState({ status: 'ready' });
    } catch (error) {
      setStartupState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  if (!isConfigured) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Missing or invalid Bunny Stream credentials</Text>
        <Text style={styles.hint}>
          Set EXPO_PUBLIC_BUNNY_ACCESS_KEY and EXPO_PUBLIC_BUNNY_LIBRARY_ID in example-expo/.env,
          then restart `expo start`.
        </Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (startupState.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Bunny Stream initialization failed</Text>
        <Text style={styles.hint}>{startupState.message}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (startupState.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.hint}>Initializing Bunny Stream…</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {selectedVideo ? (
        <PlayerScreen video={selectedVideo} onBack={() => setSelectedVideo(null)} />
      ) : (
        <VideoListScreen libraryId={BUNNY_LIBRARY_ID} onSelect={setSelectedVideo} />
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f' },
  centered: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  hint: { color: '#9a9aa5', textAlign: 'center', lineHeight: 20 },
});
