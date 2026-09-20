import type { LiveStream } from 'bunny-stream-react-native';

import Clipboard from '@react-native-clipboard/clipboard';
import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Dialog } from '../../components/Dialog';
import { colors } from '../../theme/colors';
import { styles } from '../../theme/styles';

/**
 * Modal showing RTMP ingest details (stream key + primary/backup URLs) for a
 * live stream, with copy-to-clipboard buttons. Mirrors the iOS demo's
 * `LiveStreamIngestDetailsView`.
 */
export function RtmpIngestModal({
  stream,
  onClose,
}: {
  stream: LiveStream | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = async (value: string, label: string) => {
    await Clipboard.setString(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const streamKey = stream?.streamKey;
  const primaryUrl = stream?.primaryIngestUrl;
  const backupUrl = stream?.backupIngestUrl;

  const copyableRow = (label: string, value: string | null) => {
    if (!value || value.length === 0) {
      return <Text style={rtmpStyles.unavailable}>Not provided by the API for this stream.</Text>;
    }
    return (
      <View style={rtmpStyles.row}>
        <Text style={rtmpStyles.rowText} numberOfLines={2}>
          {value}
        </Text>
        <TouchableOpacity style={rtmpStyles.copyButton} onPress={() => handleCopy(value, label)}>
          <Text style={rtmpStyles.copyButtonText}>{copied === label ? 'Copied!' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Dialog visible={stream != null} title="RTMP Ingest" onClose={onClose}>
      <View style={rtmpStyles.section}>
        <Text style={rtmpStyles.sectionTitle}>Stream key</Text>
        {copyableRow('Stream key', streamKey ?? null)}
      </View>

      <View style={rtmpStyles.section}>
        <Text style={rtmpStyles.sectionTitle}>Primary ingest URL</Text>
        {copyableRow('Primary URL', primaryUrl ?? null)}
      </View>

      <View style={rtmpStyles.section}>
        <Text style={rtmpStyles.sectionTitle}>Backup ingest URL</Text>
        {copyableRow('Backup URL', backupUrl ?? null)}
      </View>

      <View style={styles.modalButtons}>
        <TouchableOpacity style={[styles.errorButton, { flex: 1 }]} onPress={onClose}>
          <Text style={styles.errorButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
}

const rtmpStyles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    color: colors.onSurface,
    marginRight: 8,
  },
  copyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  unavailable: {
    fontSize: 13,
    color: colors.disabled,
    fontStyle: 'italic',
  },
});
