import { BUNNY_LIBRARY_ID, BUNNY_VIDEO_ID, BUNNY_VIDEO_IDS } from '@env';
import * as React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Dialog } from '../../components/Dialog';
import {
  loadDirectPlayValues,
  saveDirectPlayValues,
  parseVideoIdsFromEnv,
} from '../../storage/settings';
import { colors } from '../../theme/colors';
import { styles } from '../../theme/styles';

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
    <Dialog
      visible={visible}
      title="Direct Video Play"
      subtitle="Enter a video ID to play directly."
      onClose={onClose}
    >
      <Text style={styles.modalFieldLabelFirst}>Video ID</Text>
      <TextInput
        style={styles.modalInput}
        value={videoId}
        onChangeText={setVideoId}
        placeholder="e.g. abc-123-def"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.modalFieldLabel}>Library ID</Text>
      <TextInput
        style={styles.modalInput}
        value={libraryId}
        onChangeText={setLibraryId}
        placeholder="e.g. 12345"
        placeholderTextColor={colors.placeholder}
        keyboardType="numeric"
      />

      <View style={styles.modalButtons}>
        <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 10 }}>
          <Text style={{ fontSize: 16, color: colors.neutralDark, textAlign: 'center' }}>
            Cancel
          </Text>
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
              color: canPlay ? colors.onSurfaceVariant : colors.disabled,
              textAlign: 'center',
            }}
          >
            Play
          </Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
}
