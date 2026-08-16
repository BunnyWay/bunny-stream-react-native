import * as React from 'react';
import { FlatList, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddVideoIdModal } from '../components/AddVideoIdModal';
import { Header } from '../components/Header';
import { styles } from '../theme/styles';

type VideoListScreenProps = {
  videoIds: string[];
  onPlayVideo: (videoId: string) => void;
  onAddVideoId: (videoId: string) => void;
  onRemoveVideoId: (videoId: string) => void;
  onBack: () => void;
};

export function VideoListScreen({
  videoIds,
  onPlayVideo,
  onAddVideoId,
  onRemoveVideoId,
  onBack,
}: VideoListScreenProps) {
  const [showAddModal, setShowAddModal] = React.useState(false);

  const renderItem = ({ item }: { item: string }) => (
    <View style={styles.card}>
      <View style={styles.videoIdRow}>
        <Text style={styles.videoIdText} numberOfLines={1} ellipsizeMode="middle">
          {item}
        </Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemoveVideoId(item)}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#FD8D32" />
      <Header title="Video List" onBack={onBack} />
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add Video ID</Text>
        </TouchableOpacity>

        {videoIds.length === 0 ? (
          <Text style={styles.videoListEmpty}>
            No videos yet. Tap + to add one.
          </Text>
        ) : (
          <FlatList
            data={videoIds}
            keyExtractor={(id) => id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => onPlayVideo(item)}>
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
          onAddVideoId(id);
        }}
        onCancel={() => setShowAddModal(false)}
      />
    </SafeAreaView>
  );
}
