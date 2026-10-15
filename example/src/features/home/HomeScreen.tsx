import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BunnyStreamApi } from '@bunny.net/stream-react-native';

import { Header } from '../../components/Header';
import { loadLibraryConfig } from '../../storage/settings';
import { styles } from '../../theme/styles';
import { DirectLivePlayModal } from './DirectLivePlayModal';
import { DirectVideoPlayModal } from './DirectVideoPlayModal';
import { HomeOption } from './HomeOption';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [hasLibrary, setHasLibrary] = React.useState(false);
  const [hasApiKey, setHasApiKey] = React.useState(false);
  const [directPlayVisible, setDirectPlayVisible] = React.useState(false);
  const [directLiveVisible, setDirectLiveVisible] = React.useState(false);
  const insets = useSafeAreaInsets();

  // Re-check on focus so options unlock after saving in Settings.
  React.useEffect(
    () =>
      navigation.addListener('focus', () => {
        (async () => {
          const { accessKey, libraryId } = await loadLibraryConfig();
          setHasLibrary(libraryId != null);
          setHasApiKey(accessKey.trim().length > 0);
        })();
      }),
    [navigation],
  );

  // Playback-only features need just a library ID; management/upload/broadcast
  // features additionally need the API access key.
  const canPlay = hasLibrary;
  const canManage = hasLibrary && hasApiKey;

  // Unconfigured options stay tappable and route to Settings instead of
  // their feature — mirrors the Android demo's AccessKey gate.
  const goToSettings = () => navigation.navigate('Settings');

  const optionSubtitle = (enabled: boolean, text: string) =>
    enabled ? text : hasLibrary ? 'API key required' : 'Not configured';
  const optionAction = (enabled: boolean, action: () => void) => (enabled ? action : goToSettings);

  const handleDirectPlay = (videoId: string, libraryId: number) => {
    setDirectPlayVisible(false);
    navigation.navigate('Player', { videoId, libraryId });
  };

  const handleDirectLive = (streamId: string, libraryId: number) => {
    setDirectLiveVisible(false);
    // Public streams play with no token; sign one anyway when a key is
    // configured so token-authenticated libraries work too.
    void (async () => {
      const { accessKey } = await loadLibraryConfig();
      const { token, expires } = BunnyStreamApi.signPlaybackToken(accessKey, streamId);
      navigation.navigate('LivePlayer', {
        streamId,
        libraryId,
        token: token ?? undefined,
        expires: expires ?? undefined,
      });
    })();
  };

  const openCameraUpload = () => {
    (async () => {
      const { accessKey, libraryId } = await loadLibraryConfig();
      if (libraryId != null && accessKey.trim().length > 0) {
        navigation.navigate('Camera', { mode: 'new', libraryId });
      }
    })();
  };

  const openResumePositions = () => {
    (async () => {
      const { libraryId } = await loadLibraryConfig();
      if (libraryId != null) {
        navigation.navigate('ResumePositions', { libraryId });
      }
    })();
  };

  return (
    <>
      <Header title="BunnyStream Demo" subtitle="React Native" />
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Text style={styles.sectionTitle}>Playback</Text>
        <View style={styles.card}>
          <HomeOption
            title="Video player"
            subtitle={optionSubtitle(canManage, 'Library videos')}
            disabled={!canManage}
            onPress={optionAction(canManage, () => navigation.navigate('VideoList'))}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Live streams"
            subtitle={optionSubtitle(canManage, 'Library live streams')}
            disabled={!canManage}
            onPress={optionAction(canManage, () => navigation.navigate('LiveStreams', {}))}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Direct video play"
            subtitle={optionSubtitle(canPlay, 'Play by video ID')}
            disabled={!canPlay}
            onPress={optionAction(canPlay, () => setDirectPlayVisible(true))}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Direct live play"
            subtitle={optionSubtitle(canPlay, 'Watch a live stream by ID')}
            disabled={!canPlay}
            onPress={optionAction(canPlay, () => setDirectLiveVisible(true))}
          />
        </View>

        <Text style={styles.sectionTitle}>Upload</Text>
        <View style={styles.card}>
          <HomeOption
            title="Video Upload"
            subtitle={optionSubtitle(canManage, 'Upload videos to the library')}
            disabled={!canManage}
            onPress={optionAction(canManage, () => navigation.navigate('VideoUpload'))}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Camera upload"
            subtitle={optionSubtitle(canManage, 'Record and broadcast live')}
            disabled={!canManage}
            onPress={optionAction(canManage, openCameraUpload)}
          />
        </View>

        <Text style={styles.sectionTitle}>Resume Positions</Text>
        <View style={styles.card}>
          <HomeOption
            title="Manage Resume Positions"
            subtitle={optionSubtitle(canPlay, 'List, export, import, delete')}
            disabled={!canPlay}
            onPress={optionAction(canPlay, openResumePositions)}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Resume Settings"
            subtitle={optionSubtitle(canPlay, 'Retention, thresholds, enable/disable')}
            disabled={!canPlay}
            onPress={optionAction(canPlay, () => navigation.navigate('ResumeSettings'))}
          />
        </View>

        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.card}>
          <HomeOption
            title="BunnyStream Configuration"
            subtitle={
              hasApiKey
                ? 'Configured'
                : hasLibrary
                  ? 'Playback only (no API key)'
                  : 'Not configured'
            }
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </ScrollView>

      <DirectVideoPlayModal
        visible={directPlayVisible}
        onClose={() => setDirectPlayVisible(false)}
        onPlay={handleDirectPlay}
      />
      <DirectLivePlayModal
        visible={directLiveVisible}
        onClose={() => setDirectLiveVisible(false)}
        onPlay={handleDirectLive}
      />
    </>
  );
}
