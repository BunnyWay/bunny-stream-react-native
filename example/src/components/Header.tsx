import * as React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import bunnyIconWhite from '../assets/bunny_icon_white.png';
import { colors } from '../theme/colors';
import { styles } from '../theme/styles';

type HeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
};

export function Header({ title, subtitle, onBack }: HeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.backButton} />
      )}
      <View style={headerStyles.titleContainer}>
        <View style={headerStyles.titleRow}>
          <Image source={bunnyIconWhite} style={headerStyles.logo} />
          <View>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
      </View>
      <View style={styles.backButton} />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
});

// Re-export colors for convenience in screens
export { colors };
