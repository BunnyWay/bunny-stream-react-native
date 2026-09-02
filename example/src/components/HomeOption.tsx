import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { styles } from '../theme/styles';

type HomeOptionProps = {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  badge?: string;
  onPress: () => void;
};

export function HomeOption({
  title,
  subtitle,
  disabled = false,
  badge,
  onPress,
}: HomeOptionProps) {
  return (
    <TouchableOpacity
      style={styles.optionRow}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.6}
    >
      <View style={styles.optionTextContainer}>
        <Text style={[styles.optionTitle, disabled && styles.optionTitleDisabled]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={styles.comingSoonBadge}>{badge}</Text> : null}
    </TouchableOpacity>
  );
}
