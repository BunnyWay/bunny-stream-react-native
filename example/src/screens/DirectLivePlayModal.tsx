import * as React from 'react';
import { Button, Modal, Text, TextInput, View } from 'react-native';

import { styles } from '../theme/styles';

type DirectLivePlayModalProps = {
  visible: boolean;
  defaultLibraryId: string;
  onPlay: (
    streamId: string,
    libraryId: number,
    token: string | null,
    expires: number | null,
  ) => void;
  onCancel: () => void;
};

/**
 * Modal for entering live-stream playback parameters.
 *
 * `streamId` and `libraryId` are required; `token` and `expires` are optional
 * (only used for token-secured live streams). `expires` is a Unix timestamp
 * in seconds (matching the SDK contract).
 */
export function DirectLivePlayModal({
  visible,
  defaultLibraryId,
  onPlay,
  onCancel,
}: DirectLivePlayModalProps) {
  const [streamId, setStreamId] = React.useState('');
  const [libraryId, setLibraryId] = React.useState('');
  const [token, setToken] = React.useState('');
  const [expires, setExpires] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setStreamId('');
      setLibraryId(defaultLibraryId);
      setToken('');
      setExpires('');
    }
  }, [visible, defaultLibraryId]);

  const handlePlay = () => {
    const trimmedStream = streamId.trim();
    const libNum = parseInt(libraryId.trim(), 10);
    if (!trimmedStream || isNaN(libNum) || libNum <= 0) {
      return;
    }
    const trimmedToken = token.trim();
    const expiresNum = parseInt(expires.trim(), 10);
    onPlay(
      trimmedStream,
      libNum,
      trimmedToken ? trimmedToken : null,
      !isNaN(expiresNum) && expiresNum > 0 ? expiresNum : null,
    );
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Enter Live Stream ID</Text>
          <Text style={styles.modalSubtitle}>
            Enter the stream ID and library ID of the live stream you want to play.
          </Text>
          <Text style={styles.modalFieldLabelFirst}>Stream ID</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Stream ID"
            value={streamId}
            onChangeText={setStreamId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.modalFieldLabel}>Library ID (required)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Library ID"
            value={libraryId}
            onChangeText={setLibraryId}
            keyboardType="numeric"
          />
          <Text style={styles.modalFieldLabel}>Token (optional)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Token-secured streams only"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.modalFieldLabel}>Expires (Unix seconds, optional)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Token expiration timestamp"
            value={expires}
            onChangeText={setExpires}
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
