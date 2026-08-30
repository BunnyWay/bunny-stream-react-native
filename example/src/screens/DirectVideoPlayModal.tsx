import { BUNNY_LIBRARY_ID, BUNNY_VIDEO_ID, BUNNY_VIDEO_IDS } from '@env';
import * as React from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  loadDirectPlayValues,
  saveDirectPlayValues,
  parseVideoIdsFromEnv,
} from '../storage/storage';
import { styles } from '../theme/styles';

type DirectVideoPlayModalProps = {
  visible: boolean;
  onClose: () => void;
  onPlay: (videoId: string, libraryId: number) => void;
};

export function DirectVideoPlayModal({ visible, onClose, onPlay }: DirectVideoPlayModalProps) {
  const [videoId, setVideoId] = React.useState('');
  const [libraryId, setLibraryId] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  // Load last-used values from storage, falling back to env defaults, when the
  // modal opens. Runs once per open (visible: false → true transition).
  React.useEffect(() => {
    if (!visible || loaded) return;
    (async () => {
      const stored = await loadDirectPlayValues();
      const envVideoIds = parseVideoIdsFromEnv({ BUNNY_VIDEO_IDS, BUNNY_VIDEO_ID });
      setVideoId(stored?.videoId || envVideoIds[0] || '');
      setLibraryId(stored?.libraryId || BUNNY_LIBRARY_ID || '');
      setLoaded(true);
    })();
  }, [visible, loaded]);

  // Reset the loaded flag when the modal closes so the next open re-reads storage.
  React.useEffect(() => {
    if (!visible) setLoaded(false);
  }, [visible]);

  const handlePlay = () => {
    const trimmedId = videoId.trim();
    const libId = parseInt(libraryId.trim(), 10);
    if (!trimmedId || isNaN(libId)) return;
    saveDirectPlayValues({ videoId: trimmedId, libraryId: String(libId) });
    onPlay(trimmedId, libId);
  };

  const canPlay = videoId.trim().length > 0 && libraryId.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Direct Video Play</Text>
          <Text style={styles.modalSubtitle}>Enter a video ID to play directly.</Text>

          <Text style={styles.modalFieldLabelFirst}>Video ID</Text>
          <TextInput
            style={styles.modalInput}
            value={videoId}
            onChangeText={setVideoId}
            placeholder="e.g. abc-123-def"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.modalFieldLabel}>Library ID</Text>
          <TextInput
            style={styles.modalInput}
            value={libraryId}
            onChangeText={setLibraryId}
            placeholder="e.g. 12345"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 10 }}>
              <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePlay}
              style={{ flex: 1, paddingVertical: 10 }}
              disabled={!canPlay}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: canPlay ? '#25588f' : '#ccc',
                  textAlign: 'center',
                }}
              >
                Play
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
