import * as React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import { styles } from '../theme/styles';

/**
 * Standard centered dialog: dimmed backdrop + card with a title, an optional
 * subtitle and arbitrary content (fields, buttons). Tapping anywhere outside
 * a field (backdrop or idle card areas) dismisses the keyboard — required
 * because the iOS numeric pad has no Done key. Backdrop taps never close the
 * dialog itself so typed values aren't lost.
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
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalOverlay} onPress={Keyboard.dismiss}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title}</Text>
            {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
            {children}
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
