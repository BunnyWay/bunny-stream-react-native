import type { StyleProp, ViewStyle } from 'react-native';

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Tinted inline banner for a status message — red for errors, green for
 * success.
 */
export function StatusBanner({
  message,
  variant = 'error',
  style,
}: {
  message: string;
  variant?: 'error' | 'success';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[bannerStyles.box, variant === 'error' ? bannerStyles.error : bannerStyles.success, style]}>
      <Text style={[bannerStyles.text, variant === 'error' ? bannerStyles.errorText : bannerStyles.successText]}>
        {message}
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  box: {
    borderRadius: 8,
    padding: 12,
  },
  error: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
  },
  success: {
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
  },
  text: {
    fontSize: 13,
  },
  errorText: {
    color: '#d32f2f',
  },
  successText: {
    color: '#2e7d32',
  },
});
