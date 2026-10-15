import { BUNNY_STREAM_ID, BUNNY_STREAM_IDS } from '@env';
import * as React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Dialog } from '../../components/Dialog';
import {
  loadDirectLiveValues,
  saveDirectLiveValues,
  loadLibraryConfig,
  parseStreamIdsFromEnv,
} from '../../storage/settings';
import { colors } from '../../theme/colors';
import { styles } from '../../theme/styles';

type DirectLivePlayModalProps = {
  visible: boolean;
  onClose: () => void;
  onPlay: (streamId: string, libraryId: number) => void;
};

export function DirectLivePlayModal({ visible, onClose, onPlay }: DirectLivePlayModalProps) {
  const [streamId, setStreamId] = React.useState('');
  const [libraryId, setLibraryId] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  // Load last-used values from storage, falling back to env defaults, when the
  // modal opens. Runs once per open (visible: false → true transition).
  React.useEffect(() => {
    if (!visible || loaded) return;
    (async () => {
      const stored = await loadDirectLiveValues();
      const envStreamIds = parseStreamIdsFromEnv({ BUNNY_STREAM_IDS, BUNNY_STREAM_ID });
      const { libraryId: configuredLibId } = await loadLibraryConfig();
      setStreamId(stored?.streamId || envStreamIds[0] || '');
      setLibraryId(stored?.libraryId || String(configuredLibId ?? ''));
      setLoaded(true);
    })();
  }, [visible, loaded]);

  // Reset the loaded flag when the modal closes so the next open re-reads storage.
  React.useEffect(() => {
    if (!visible) setLoaded(false);
  }, [visible]);

  const handlePlay = () => {
    const trimmedId = streamId.trim();
    const libId = parseInt(libraryId.trim(), 10);
    if (!trimmedId || isNaN(libId)) return;
    saveDirectLiveValues({ streamId: trimmedId, libraryId: String(libId) });
    onPlay(trimmedId, libId);
  };

  const canPlay = streamId.trim().length > 0 && libraryId.trim().length > 0;

  return (
    <Dialog
      visible={visible}
      title="Direct Live Play"
      subtitle="Enter a live stream ID to watch it directly."
      onClose={onClose}
    >
      <Text style={styles.modalFieldLabelFirst}>Stream ID</Text>
      <TextInput
        style={styles.modalInput}
        value={streamId}
        onChangeText={setStreamId}
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
            Watch
          </Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
}
