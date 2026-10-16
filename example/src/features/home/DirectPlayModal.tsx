import * as React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Dialog } from '../../components/Dialog';
import { loadLibraryConfig } from '../../storage/settings';
import { colors } from '../../theme/colors';
import { styles } from '../../theme/styles';

export type DirectPlayModalProps = {
  visible: boolean;
  onClose: () => void;
  onPlay: (id: string, libraryId: number) => void;
  /** Dialog heading, e.g. "Direct Video Play". */
  title: string;
  /** Helper line under the title. */
  subtitle: string;
  /** Label of the media-id input, e.g. "Video ID" or "Stream ID". */
  fieldLabel: string;
  /** Label of the confirm button, e.g. "Play" or "Watch". */
  actionLabel: string;
  /** .env defaults used when nothing was stored yet. */
  envIds: string[];
  /** Last-used values persisted per dialog kind (video / live). */
  loadValues: () => Promise<{ id: string; libraryId: string } | null>;
  saveValues: (values: { id: string; libraryId: string }) => void;
};

/**
 * Shared dialog for play-by-ID entry (VOD and live). Loads last-used values
 * once per open, falling back to env defaults, then to the configured
 * library ID — the same library the app initialized with.
 */
export function DirectPlayModal({
  visible,
  onClose,
  onPlay,
  title,
  subtitle,
  fieldLabel,
  actionLabel,
  envIds,
  loadValues,
  saveValues,
}: DirectPlayModalProps) {
  const [id, setId] = React.useState('');
  const [libraryId, setLibraryId] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  // Load last-used values from storage, falling back to env defaults, when the
  // modal opens. Runs once per open (visible: false → true transition).
  React.useEffect(() => {
    if (!visible || loaded) return;
    (async () => {
      const stored = await loadValues();
      const { libraryId: configuredLibId } = await loadLibraryConfig();
      setId(stored?.id || envIds[0] || '');
      setLibraryId(stored?.libraryId || String(configuredLibId ?? ''));
      setLoaded(true);
    })();
  }, [visible, loaded, loadValues, envIds]);

  // Reset the loaded flag when the modal closes so the next open re-reads storage.
  React.useEffect(() => {
    if (!visible) setLoaded(false);
  }, [visible]);

  const handlePlay = () => {
    const trimmedId = id.trim();
    const libId = parseInt(libraryId.trim(), 10);
    if (!trimmedId || isNaN(libId)) return;
    saveValues({ id: trimmedId, libraryId: String(libId) });
    onPlay(trimmedId, libId);
  };

  const canPlay = id.trim().length > 0 && libraryId.trim().length > 0;

  return (
    <Dialog visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      <Text style={styles.modalFieldLabelFirst}>{fieldLabel}</Text>
      <TextInput
        style={styles.modalInput}
        value={id}
        onChangeText={setId}
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
            {actionLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
}
