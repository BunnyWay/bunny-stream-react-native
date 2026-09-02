import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_LIBRARY_ID, BUNNY_VIDEO_ID, BUNNY_VIDEO_IDS } from '@env';
import * as React from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';

import { AddVideoIdModal } from '../components/AddVideoIdModal';
import { Header } from '../components/Header';
import {
  addVideoId,
  loadSettings,
  loadVideoIds,
  parseVideoIdsFromEnv,
  removeVideoId,
  saveVideoIds,
} from '../storage/storage';
import { styles } from '../theme/styles';

type VideoListScreenProps = NativeStackScreenProps<RootStackParamList, 'VideoList'>;

export function VideoListScreen({ navigation }: VideoListScreenProps) {
  const [videoIds, setVideoIds] = React.useState<string[]>([]);
  const [showAddModal, setShowAddModal] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const ids = await loadVideoIds();
      if (ids.length === 0) {
        const envIds = parseVideoIdsFromEnv({ BUNNY_VIDEO_IDS, BUNNY_VIDEO_ID });
        if (envIds.length > 0) {
          await saveVideoIds(envIds);
          setVideoIds(envIds);
        } else {
          setVideoIds([]);
        }
      } else {
        setVideoIds(ids);
      }
    })();
  }, []);

  const handlePlayVideo = async (videoId: string) => {
    const stored = await loadSettings();
    const libIdStr = stored?.libraryId ?? BUNNY_LIBRARY_ID ?? '';
    const libId = parseInt(libIdStr, 10);
    if (!libIdStr || isNaN(libId)) {
      Alert.alert('Configuration required', 'Please set your Library ID in Settings first.');
      return;
    }
    navigation.navigate('Player', { videoId, libraryId: libId });
  };

  const handleAddVideoId = async (videoId: string) => {
    const next = await addVideoId(videoId);
    setVideoIds(next);
  };

  const handleRemoveVideoId = async (videoId: string) => {
    const next = await removeVideoId(videoId);
    setVideoIds(next);
  };

  const renderItem = ({ item }: { item: string }) => (
    <View style={styles.card}>
      <View style={styles.videoIdRow}>
        <Text style={styles.videoIdText} numberOfLines={1} ellipsizeMode="middle">
          {item}
        </Text>
        <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveVideoId(item)}>
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <Header title="Video List" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButtonText}>+ Add Video ID</Text>
        </TouchableOpacity>

        {videoIds.length === 0 ? (
          <Text style={styles.videoListEmpty}>No videos yet. Tap + to add one.</Text>
        ) : (
          <FlatList
            data={videoIds}
            keyExtractor={(id) => id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handlePlayVideo(item)}>
                {renderItem({ item })}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}
      </View>

      <AddVideoIdModal
        visible={showAddModal}
        existingIds={videoIds}
        onAdd={(id) => {
          setShowAddModal(false);
          handleAddVideoId(id);
        }}
        onCancel={() => setShowAddModal(false)}
      />
    </>
  );
}
