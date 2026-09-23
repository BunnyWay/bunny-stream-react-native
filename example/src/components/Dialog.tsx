import * as React from 'react';
import { Modal, Text, View } from 'react-native';

import { styles } from '../theme/styles';

/**
 * Standard centered dialog: dimmed backdrop + card with a title, an optional
 * subtitle and arbitrary content (fields, buttons).
 */
export function Dialog({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}
