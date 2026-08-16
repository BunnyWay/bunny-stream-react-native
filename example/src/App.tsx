import type { PlayerParams, Screen } from './navigation/types';

import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID, BUNNY_VIDEO_ID, BUNNY_VIDEO_IDS } from '@env';
import * as React from 'react';
import { ActivityIndicator, Alert, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initialize } from 'bunny-stream-react-native';

import { DirectVideoPlayModal } from './screens/DirectVideoPlayModal';
import { HomeScreen } from './screens/HomeScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { VideoListScreen } from './screens/VideoListScreen';
import {
  addVideoId,
  loadSettings,
  loadVideoIds,
  parseVideoIdsFromEnv,
  removeVideoId,
  saveSettings,
  saveVideoIds,
} from './storage/storage';
import { styles } from './theme/styles';

export default function App() {
  const [screen, setScreen] = React.useState<Screen>('home');
  const [loading, setLoading] = React.useState(true);
  const [accessKey, setAccessKey] = React.useState<string>('');
  const [libraryId, setLibraryId] = React.useState<string>('');
  const [playerParams, setPlayerParams] = React.useState<PlayerParams | null>(null);
  const [videoIds, setVideoIds] = React.useState<string[]>([]);
  const [showDirectPlayModal, setShowDirectPlayModal] = React.useState(false);

  // Initialize SDK on mount: load from storage, fallback to .env.
  React.useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      const resolvedAccessKey = stored?.accessKey ?? BUNNY_ACCESS_KEY ?? '';
      const resolvedLibraryId = stored?.libraryId ?? BUNNY_LIBRARY_ID ?? '';
      setAccessKey(resolvedAccessKey);
      setLibraryId(resolvedLibraryId);

      const libIdNum = parseInt(resolvedLibraryId, 10);
      if (!isNaN(libIdNum)) {
        initialize(resolvedAccessKey || null, libIdNum);
      }

      // Load saved video IDs; seed from .env if storage is empty.
      const ids = await loadVideoIds();
      if (ids.length === 0) {
        const envIds = parseVideoIdsFromEnv({
          BUNNY_VIDEO_IDS,
          BUNNY_VIDEO_ID,
        });
        if (envIds.length > 0) {
          // Persist the seed so addVideoId/removeVideoId see the full list.
          await saveVideoIds(envIds);
          setVideoIds(envIds);
        } else {
          setVideoIds([]);
        }
      } else {
        setVideoIds(ids);
      }

      setLoading(false);
    })();
  }, []);

  const handleSaveSettings = async () => {
    const libId = parseInt(libraryId, 10);
    if (!libraryId || isNaN(libId)) {
      Alert.alert('Invalid input', 'Please enter a valid numeric Library ID.');
      return;
    }
    initialize(accessKey || null, libId);
    await saveSettings({ accessKey, libraryId });
    setScreen('home');
  };

  const resolveLibId = (override: string | null): number => {
    if (override) {
      const parsed = parseInt(override, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return parseInt(libraryId, 10);
  };

  const handleDirectPlay = (videoId: string, libraryIdOverride: string | null) => {
    const libId = resolveLibId(libraryIdOverride);
    if (isNaN(libId)) {
      Alert.alert('Configuration required', 'Please set your Library ID in Settings first.');
      return;
    }
    setShowDirectPlayModal(false);
    setPlayerParams({ videoId, libraryId: libId });
    setScreen('player');
  };

  const handlePlayVideo = (videoId: string) => {
    const libId = parseInt(libraryId, 10);
    if (!libraryId || isNaN(libId)) {
      Alert.alert('Configuration required', 'Please set your Library ID in Settings first.');
      return;
    }
    setPlayerParams({ videoId, libraryId: libId });
    setScreen('player');
  };

  const handleAddVideoId = async (videoId: string) => {
    const next = await addVideoId(videoId);
    setVideoIds(next);
  };

  const handleRemoveVideoId = async (videoId: string) => {
    const next = await removeVideoId(videoId);
    setVideoIds(next);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#FD8D32" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FD8D32" />
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        accessKey={accessKey}
        libraryId={libraryId}
        onAccessKeyChange={setAccessKey}
        onLibraryIdChange={setLibraryId}
        onSave={handleSaveSettings}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'videoList') {
    return (
      <VideoListScreen
        videoIds={videoIds}
        onPlayVideo={handlePlayVideo}
        onAddVideoId={handleAddVideoId}
        onRemoveVideoId={handleRemoveVideoId}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'player' && playerParams) {
    return (
      <PlayerScreen
        videoId={playerParams.videoId}
        libraryId={playerParams.libraryId}
        onBack={() => {
          setPlayerParams(null);
          setScreen('home');
        }}
      />
    );
  }

  return (
    <>
      <HomeScreen
        onNavigate={setScreen}
        onDirectPlay={() => setShowDirectPlayModal(true)}
        hasConfig={!!libraryId && !isNaN(parseInt(libraryId, 10))}
      />
      <DirectVideoPlayModal
        visible={showDirectPlayModal}
        defaultVideoId={parseVideoIdsFromEnv({ BUNNY_VIDEO_IDS, BUNNY_VIDEO_ID })[0] ?? ''}
        onPlay={handleDirectPlay}
        onCancel={() => setShowDirectPlayModal(false)}
      />
    </>
  );
}
