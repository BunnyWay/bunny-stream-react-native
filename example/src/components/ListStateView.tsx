import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from '../theme/styles';

/**
 * Shared empty / error body for a FlatList's `ListEmptyComponent`.
 * `loading` renders nothing — the list's RefreshControl already shows its
 * spinner, so a second ActivityIndicator here would double it up.
 */
export function ListStateView({
  state,
  emptyMessage,
  onRetry,
}: {
  state: { kind: 'loading' | 'empty' | 'loaded' | 'error'; message?: string };
  emptyMessage: string;
  onRetry: () => void;
}) {
  if (state.kind === 'empty') {
    return <Text style={styles.videoListEmpty}>{emptyMessage}</Text>;
  }
  if (state.kind === 'error') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorMessage}>{state.message}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return null;
}
