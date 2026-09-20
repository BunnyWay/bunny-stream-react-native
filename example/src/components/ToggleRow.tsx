import type { StyleProp, ViewStyle } from 'react-native';

import * as React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '../theme/colors';

/**
 * Label + optional subtitle + Switch — the standard settings/feature row used
 * across the demo screens.
 */
export function ToggleRow({
  label,
  subtitle,
  value,
  onValueChange,
  style,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[toggleStyles.row, style]}>
      <View style={toggleStyles.text}>
        <Text style={toggleStyles.label}>{label}</Text>
        {subtitle ? <Text style={toggleStyles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  text: {
    flex: 1,
    paddingRight: 12,
  },
  label: {
    fontSize: 15,
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
});
