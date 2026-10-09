import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '../../components/Header';
import { loadLibraryConfig } from '../../storage/settings';
import { styles } from '../../theme/styles';
import { DirectVideoPlayModal } from './DirectVideoPlayModal';
import { HomeOption } from './HomeOption';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [hasConfig, setHasConfig] = React.useState(false);
  const [directPlayVisible, setDirectPlayVisible] = React.useState(false);
  const insets = useSafeAreaInsets();

  // Re-check on focus so options unlock after saving in Settings.
  React.useEffect(
    () =>
      navigation.addListener('focus', () => {
        (async () => {
          const { accessKey, libraryId } = await loadLibraryConfig();
          setHasConfig(libraryId != null && accessKey.trim().length > 0);
        })();
      }),
    [navigation],
  );

  const handleDirectPlay = (videoId: string, libraryId: number) => {
    setDirectPlayVisible(false);
    navigation.navigate('Player', { videoId, libraryId });
  };

  // Unconfigured options stay tappable and route to Settings instead of
  // their feature — mirrors the Android demo's AccessKey gate.
  const goToSettings = () => navigation.navigate('Settings');

  const openCameraUpload = () => {
    (async () => {
      const { libraryId } = await loadLibraryConfig();
      if (libraryId != null) {
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
            subtitle={hasConfig ? 'Library videos' : 'Not configured'}
            disabled={!hasConfig}
            onPress={hasConfig ? () => navigation.navigate('VideoList') : goToSettings}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Live streams"
            subtitle={hasConfig ? 'Library live streams' : 'Not configured'}
            disabled={!hasConfig}
            onPress={hasConfig ? () => navigation.navigate('LiveStreams', {}) : goToSettings}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Direct video play"
            subtitle={hasConfig ? 'Play by video ID' : 'Not configured'}
            disabled={!hasConfig}
            onPress={hasConfig ? () => setDirectPlayVisible(true) : goToSettings}
          />
        </View>

        <Text style={styles.sectionTitle}>Upload</Text>
        <View style={styles.card}>
          <HomeOption
            title="Video Upload"
            subtitle={hasConfig ? 'Upload videos to the library' : 'Not configured'}
            disabled={!hasConfig}
            onPress={hasConfig ? () => navigation.navigate('VideoUpload') : goToSettings}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Camera upload"
            subtitle={hasConfig ? 'Record and broadcast live' : 'Not configured'}
            disabled={!hasConfig}
            onPress={hasConfig ? openCameraUpload : goToSettings}
          />
        </View>

        <Text style={styles.sectionTitle}>Resume Positions</Text>
        <View style={styles.card}>
          <HomeOption
            title="Manage Resume Positions"
            subtitle={hasConfig ? 'List, export, import, delete' : 'Not configured'}
            disabled={!hasConfig}
            onPress={hasConfig ? openResumePositions : goToSettings}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Resume Settings"
            subtitle={hasConfig ? 'Retention, thresholds, enable/disable' : 'Not configured'}
            disabled={!hasConfig}
            onPress={hasConfig ? () => navigation.navigate('ResumeSettings') : goToSettings}
          />
        </View>

        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.card}>
          <HomeOption
            title="BunnyStream Configuration"
            subtitle={hasConfig ? 'Configured' : 'Not configured'}
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </ScrollView>

      <DirectVideoPlayModal
        visible={directPlayVisible}
        onClose={() => setDirectPlayVisible(false)}
        onPlay={handleDirectPlay}
      />
    </>
  );
}
