import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors } from '../theme/colors';

/**
 * Small outlined action button — the secondary action used in cards, rows and
 * pickers. `danger` marks destructive actions with a red border.
 */
export function OutlineButton({
  label,
  onPress,
  disabled,
  danger,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <TouchableOpacity
      style={[
        buttonStyles.button,
        danger && buttonStyles.danger,
        disabled && buttonStyles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[buttonStyles.label, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const buttonStyles = StyleSheet.create({
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  danger: {
    borderColor: '#d32f2f',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
