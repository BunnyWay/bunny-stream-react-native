import type { StyleProp, ViewStyle } from 'react-native';

import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

/**
 * Thin determinate progress bar — upload progress, seek position. `progress`
 * is a fraction in [0, 1].
 */
export function ProgressBar({
  progress,
  style,
}: {
  progress: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.min(100, Math.max(0, progress * 100));
  return (
    <View style={[progressStyles.track, style]}>
      <View style={[progressStyles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(24, 61, 109, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
