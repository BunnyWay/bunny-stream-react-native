import * as React from 'react';
import { Alert, Button, Modal, Text, TextInput, View } from 'react-native';

import { styles } from '../theme/styles';

type AddVideoIdModalProps = {
  visible: boolean;
  onAdd: (videoId: string) => void;
  onCancel: () => void;
  existingIds?: string[];
  title?: string;
  subtitle?: string;
};

export function AddVideoIdModal({
  visible,
  onAdd,
  onCancel,
  existingIds = [],
  title = 'Enter Video ID',
  subtitle = 'Please enter the ID of the video you want to add.',
}: AddVideoIdModalProps) {
  const [videoId, setVideoId] = React.useState('');

  // Reset value when modal opens
  React.useEffect(() => {
    if (visible) {
      setVideoId('');
    }
  }, [visible]);

  const handleAdd = () => {
    const trimmed = videoId.trim();
    if (!trimmed) {
      Alert.alert('Missing Video ID', 'Please enter a Video ID.');
      return;
    }
    if (existingIds.includes(trimmed)) {
      Alert.alert('Already in list', 'This Video ID is already in your list.');
      return;
    }
    onAdd(trimmed);
  };

  const handleCancel = () => {
    setVideoId('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>{subtitle}</Text>
          <TextInput
            style={styles.input}
            placeholder="Video ID"
            value={videoId}
            onChangeText={setVideoId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <Button title="Cancel" onPress={handleCancel} />
            <Button title="Add" onPress={handleAdd} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
