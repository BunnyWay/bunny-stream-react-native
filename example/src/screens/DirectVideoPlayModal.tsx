import * as React from 'react';
import { Button, Modal, Text, TextInput, View } from 'react-native';

import { styles } from '../theme/styles';

type DirectVideoPlayModalProps = {
  visible: boolean;
  defaultVideoId: string;
  onPlay: (videoId: string, libraryIdOverride: string | null) => void;
  onCancel: () => void;
};

export function DirectVideoPlayModal({
  visible,
  defaultVideoId,
  onPlay,
  onCancel,
}: DirectVideoPlayModalProps) {
  const [videoId, setVideoId] = React.useState('');
  const [libraryIdOverride, setLibraryIdOverride] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setVideoId(defaultVideoId);
      setLibraryIdOverride('');
    }
  }, [visible, defaultVideoId]);

  const handlePlay = () => {
    const trimmed = videoId.trim();
    if (!trimmed) {
      return;
    }
    const libOverride = libraryIdOverride.trim();
    onPlay(trimmed, libOverride ? libOverride : null);
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Enter Video ID</Text>
          <Text style={styles.modalSubtitle}>
            Please enter the ID of the video you want to play.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Video ID"
            value={videoId}
            onChangeText={setVideoId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.modalSubtitle}>Video Library ID (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Use default"
            value={libraryIdOverride}
            onChangeText={setLibraryIdOverride}
            keyboardType="numeric"
          />
          <View style={styles.modalButtons}>
            <Button title="Cancel" onPress={handleCancel} />
            <Button title="Play" onPress={handlePlay} color="#FD8D32" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
