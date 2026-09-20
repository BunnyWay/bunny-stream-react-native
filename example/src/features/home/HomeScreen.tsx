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

  React.useEffect(() => {
    (async () => {
      const { libraryId } = await loadLibraryConfig();
      setHasConfig(libraryId != null);
    })();
  }, []);

  const handleDirectPlay = (videoId: string, libraryId: number) => {
    setDirectPlayVisible(false);
    navigation.navigate('Player', { videoId, libraryId });
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
            onPress={() => navigation.navigate('VideoList')}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Live streams"
            subtitle={hasConfig ? 'Library live streams' : 'Not configured'}
            onPress={() => navigation.navigate('LiveStreams', {})}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Direct video play"
            subtitle="Play by video ID"
            onPress={() => setDirectPlayVisible(true)}
          />
        </View>

        <Text style={styles.sectionTitle}>Upload</Text>
        <View style={styles.card}>
          <HomeOption
            title="Video Upload"
            subtitle={hasConfig ? 'Upload videos to the library' : 'Not configured'}
            disabled={!hasConfig}
            onPress={() => navigation.navigate('VideoUpload')}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Camera upload"
            subtitle={hasConfig ? 'Record and broadcast live' : 'Not configured'}
            disabled={!hasConfig}
            onPress={() => {
              (async () => {
                const { libraryId } = await loadLibraryConfig();
                if (libraryId != null) {
                  navigation.navigate('Camera', { mode: 'new', libraryId });
                }
              })();
            }}
          />
        </View>

        <Text style={styles.sectionTitle}>Resume Positions</Text>
        <View style={styles.card}>
          <HomeOption
            title="Manage Resume Positions"
            subtitle="List, export, import, delete"
            onPress={() => {
              (async () => {
                const { libraryId } = await loadLibraryConfig();
                if (libraryId != null) {
                  navigation.navigate('ResumePositions', { libraryId });
                }
              })();
            }}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Resume Settings"
            subtitle="Retention, thresholds, enable/disable"
            onPress={() => navigation.navigate('ResumeSettings')}
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
