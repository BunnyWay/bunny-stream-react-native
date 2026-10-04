import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from '../theme/styles';

/**
 * Shared empty / error body for a FlatList's `ListEmptyComponent`.
 * `loading` renders nothing — the list's RefreshControl already shows its
 * spinner, so a second ActivityIndicator here would double it up.
 *
 * `unconfigured` renders a "Settings" button instead of "Retry", mirroring
 * the Android demo's AccessKey gate.
 */
export function ListStateView({
  state,
  emptyMessage,
  onRetry,
  onOpenSettings,
}: {
  state: { kind: 'loading' | 'empty' | 'loaded' | 'error' | 'unconfigured'; message?: string };
  emptyMessage: string;
  onRetry: () => void;
  onOpenSettings?: () => void;
}) {
  if (state.kind === 'empty') {
    return <Text style={styles.videoListEmpty}>{emptyMessage}</Text>;
  }
  if (state.kind === 'unconfigured') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.listErrorMessage}>Set the access key and library ID in Settings</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onOpenSettings}>
          <Text style={styles.primaryButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (state.kind === 'error') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.listErrorMessage}>{state.message}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return null;
}
