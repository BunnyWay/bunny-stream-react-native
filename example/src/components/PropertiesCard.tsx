import type { StyleProp, ViewStyle } from 'react-native';

import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

/**
 * Card listing label/value metadata rows — mirrors the Android demo's
 * VideoPropertiesCard / LiveStreamPropertiesCard.
 */
export function PropertiesCard({
  title,
  rows,
  style,
}: {
  title?: string;
  rows: { label: string; value: string }[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[cardStyles.card, style]}>
      {title ? <Text style={cardStyles.title}>{title}</Text> : null}
      {rows.map((row, i) => (
        <View key={i} style={[cardStyles.row, i < rows.length - 1 && cardStyles.rowBorder]}>
          <Text style={cardStyles.label}>{row.label}</Text>
          <Text style={cardStyles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  label: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  value: {
    fontSize: 13,
    color: colors.onSurface,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
