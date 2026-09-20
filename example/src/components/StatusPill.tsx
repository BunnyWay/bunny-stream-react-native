import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

/**
 * Small status/metadata chip. Defaults to a neutral tinted pill; pass
 * `backgroundColor`/`color` for status-colored variants and `rounded` for the
 * fully-circular pill shape.
 */
export function StatusPill({
  label,
  color = colors.onSurfaceVariant,
  backgroundColor = 'rgba(37, 88, 143, 0.1)',
  rounded,
  style,
  textStyle,
}: {
  label: string;
  color?: string;
  backgroundColor?: string;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[pillStyles.pill, rounded && pillStyles.rounded, { backgroundColor }, style]}>
      <Text style={[pillStyles.text, { color }, textStyle]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rounded: {
    borderRadius: 50,
    paddingHorizontal: 10,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
});
