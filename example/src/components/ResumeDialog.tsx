import type { PlaybackPosition } from 'bunny-stream-react-native';

import * as React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme/colors';
import { formatTime } from '../utils/format';

/**
 * Resume-confirmation dialog matching the Android demo's `ResumeDialog`:
 * "Resume Playback — Continue watching from X:XX? (Y% watched)" with
 * Resume / Start Over actions. Dismissing counts as Start Over.
 */
export function ResumeDialog({
  position,
  onResume,
  onStartOver,
}: {
  position: PlaybackPosition | null;
  onResume: (position: PlaybackPosition) => void;
  onStartOver: () => void;
}) {
  return (
    <Modal
      visible={position !== null}
      transparent
      animationType="fade"
      onRequestClose={onStartOver}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Resume Playback</Text>
          {position ? (
            <>
              <Text style={styles.body}>
                Continue watching from {formatTime(position.positionMs)}?
              </Text>
              <Text style={styles.detail}>
                {(position.watchPercentage * 100).toFixed(0)}% watched
                {position.videoTitle ? ` • ${position.videoTitle}` : ''}
              </Text>
            </>
          ) : null}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.textButton} onPress={onStartOver}>
              <Text style={styles.textButtonLabel}>START OVER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textButton}
              onPress={() => position && onResume(position)}
            >
              <Text style={[styles.textButtonLabel, styles.primaryLabel]}>RESUME</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 8,
    width: '100%',
    maxWidth: 360,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: colors.onSurface,
    lineHeight: 22,
  },
  detail: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 6,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  textButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  primaryLabel: {
    color: colors.primary,
  },
});
