import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_LIBRARY_ID, BUNNY_VIDEO_ID, BUNNY_VIDEO_IDS } from '@env';
import * as React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Header } from '../components/Header';
import { HomeOption } from '../components/HomeOption';
import { loadSettings, parseVideoIdsFromEnv } from '../storage/storage';
import { styles } from '../theme/styles';
import { DirectLivePlayModal } from './DirectLivePlayModal';
import { DirectVideoPlayModal } from './DirectVideoPlayModal';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: HomeScreenProps) {
  const [hasConfig, setHasConfig] = React.useState(false);
  const [showDirectPlayModal, setShowDirectPlayModal] = React.useState(false);
  const [showDirectPlayCustomModal, setShowDirectPlayCustomModal] = React.useState(false);
  const [showDirectLiveModal, setShowDirectLiveModal] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      const libId = stored?.libraryId ?? BUNNY_LIBRARY_ID ?? '';
      setHasConfig(!!libId && !isNaN(parseInt(libId, 10)));
    })();
  }, []);

  const resolveLibId = async (override: string | null): Promise<number> => {
    if (override) {
      const parsed = parseInt(override, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    const stored = await loadSettings();
    return parseInt(stored?.libraryId ?? BUNNY_LIBRARY_ID ?? '', 10);
  };

  const handleDirectPlay = async (videoId: string, libraryIdOverride: string | null) => {
    const libId = await resolveLibId(libraryIdOverride);
    if (isNaN(libId)) {
      Alert.alert('Configuration required', 'Please set your Library ID in Settings first.');
      return;
    }
    setShowDirectPlayModal(false);
    navigation.navigate('Player', { videoId, libraryId: libId });
  };

  const handleDirectPlayCustom = async (videoId: string, libraryIdOverride: string | null) => {
    const libId = await resolveLibId(libraryIdOverride);
    if (isNaN(libId)) {
      Alert.alert('Configuration required', 'Please set your Library ID in Settings first.');
      return;
    }
    setShowDirectPlayCustomModal(false);
    navigation.navigate('PlayerCustom', { videoId, libraryId: libId });
  };

  const handleDirectLivePlay = (
    streamId: string,
    libraryId: number,
    token: string | null,
    expires: number | null,
  ) => {
    setShowDirectLiveModal(false);
    navigation.navigate('LivePlayer', {
      streamId,
      libraryId,
      token: token ?? undefined,
      expires: expires ?? undefined,
    });
  };

  const defaultVideoId = parseVideoIdsFromEnv({ BUNNY_VIDEO_IDS, BUNNY_VIDEO_ID })[0] ?? '';

  return (
    <>
      <Header title="BunnyStream Demo" subtitle="React Native" />
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.card}>
          <HomeOption
            title="Video player"
            subtitle="Saved video IDs"
            onPress={() => navigation.navigate('VideoList')}
          />
          <View style={styles.divider} />
          <HomeOption title="Video Upload" badge="Coming soon" disabled onPress={() => {}} />
          <View style={styles.divider} />
          <HomeOption title="Camera upload" badge="Coming soon" disabled onPress={() => {}} />
          <View style={styles.divider} />
          <HomeOption
            title="Direct video play"
            subtitle="Native controls"
            onPress={() => setShowDirectPlayModal(true)}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Direct video play (custom)"
            subtitle="JS controls only"
            onPress={() => setShowDirectPlayCustomModal(true)}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Direct live stream play"
            subtitle="Native live host (SDK controls)"
            onPress={() => setShowDirectLiveModal(true)}
          />
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
        visible={showDirectPlayModal}
        defaultVideoId={defaultVideoId}
        onPlay={handleDirectPlay}
        onCancel={() => setShowDirectPlayModal(false)}
      />
      <DirectVideoPlayModal
        visible={showDirectPlayCustomModal}
        defaultVideoId={defaultVideoId}
        onPlay={handleDirectPlayCustom}
        onCancel={() => setShowDirectPlayCustomModal(false)}
      />
      <DirectLivePlayModal
        visible={showDirectLiveModal}
        defaultLibraryId={BUNNY_LIBRARY_ID ?? ''}
        onPlay={handleDirectLivePlay}
        onCancel={() => setShowDirectLiveModal(false)}
      />
    </>
  );
}
