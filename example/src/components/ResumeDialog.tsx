import type { PlaybackPosition } from '@bunny.net/stream-react-native';

import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../theme/colors';
import { formatTime } from '../utils/format';
import { Dialog } from './Dialog';

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
    <Dialog visible={position !== null} title="Resume Playback" onClose={onStartOver}>
      {position ? (
        <>
          <Text style={styles.body}>Continue watching from {formatTime(position.positionMs)}?</Text>
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
        <TouchableOpacity style={styles.textButton} onPress={() => position && onResume(position)}>
          <Text style={[styles.textButtonLabel, styles.primaryLabel]}>RESUME</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 12,
    marginHorizontal: -8,
    marginBottom: -8,
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
