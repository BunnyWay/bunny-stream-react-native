import * as React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme/colors';
import { styles } from '../theme/styles';

/**
 * Shared loading / empty / error body for a FlatList's `ListEmptyComponent`.
 * `loaded` renders nothing — the list items are shown instead.
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
  if (state.kind === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
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
