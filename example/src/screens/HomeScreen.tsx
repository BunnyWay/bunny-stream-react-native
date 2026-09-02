import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_LIBRARY_ID } from '@env';
import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Header } from '../components/Header';
import { HomeOption } from '../components/HomeOption';
import { DirectVideoPlayModal } from '../screens/DirectVideoPlayModal';
import { loadSettings } from '../storage/storage';
import { styles } from '../theme/styles';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [hasConfig, setHasConfig] = React.useState(false);
  const [directPlayVisible, setDirectPlayVisible] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      const libId = stored?.libraryId ?? BUNNY_LIBRARY_ID ?? '';
      setHasConfig(!!libId && !isNaN(parseInt(libId, 10)));
    })();
  }, []);

  const handleDirectPlay = (videoId: string, libraryId: number) => {
    setDirectPlayVisible(false);
    navigation.navigate('Player', { videoId, libraryId });
  };

  return (
    <>
      <Header title="BunnyStream Demo" subtitle="React Native" />
      <ScrollView style={styles.content}>
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
            onPress={() => navigation.navigate('LiveStreams')}
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
          <HomeOption title="Video Upload" badge="Coming soon" disabled onPress={() => {}} />
          <View style={styles.divider} />
          <HomeOption title="Camera upload" badge="Coming soon" disabled onPress={() => {}} />
        </View>

        <Text style={styles.sectionTitle}>Resume Positions</Text>
        <View style={styles.card}>
          <HomeOption
            title="Resume Position Settings"
            badge="Coming soon"
            disabled
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Manage Resume Positions"
            badge="Coming soon"
            disabled
            onPress={() => {}}
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
