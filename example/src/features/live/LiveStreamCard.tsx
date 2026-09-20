import type { LiveStream, LiveStreamStatus } from 'bunny-stream-react-native';

import * as React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LiveStreamStatusEnum, liveStreamStatusLabel } from 'bunny-stream-react-native';

import { colors } from '../../theme/colors';
import { LIVE_STATUS_COLORS } from './constants';
import { formatScheduled } from './time';

/**
 * Renders a single live stream card — mirrors the Android demo's
 * LiveStreamItem: a Row with text metadata + pills on the left, a play
 * button and overflow menu on the right. No thumbnail in the list.
 */
export function LiveStreamCard({
  stream,
  onWatch,
  onEdit,
  onDelete,
  onRtmp,
  onToggleLive,
  onGoLive,
}: {
  stream: LiveStream;
  onWatch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRtmp: () => void;
  onToggleLive: () => void;
  onGoLive: () => void;
}) {
  const status = stream.status as LiveStreamStatus;
  const statusColor = LIVE_STATUS_COLORS[status] ?? '#aaa';
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Watch is enabled only when the stream has an HLS playback URL.
  // Start/End live and Go Live are disabled for terminal states
  // (ENDED / VOD_PROCESSING) — the SDK rejects re-publishing those.
  // Edit and Delete are always enabled.
  const canWatch = Boolean(stream.playbackUrlHls);
  const isRunning = status === LiveStreamStatusEnum.RUNNING;
  const canToggleLive =
    status !== LiveStreamStatusEnum.ENDED && status !== LiveStreamStatusEnum.VOD_PROCESSING;
  const canGoLive = canToggleLive;

  const menuItems: {
    label: string;
    action: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }[] = [
    {
      label: 'Watch',
      action: () => {
        setMenuOpen(false);
        onWatch();
      },
      disabled: !canWatch,
    },
    {
      label: 'Go Live',
      action: () => {
        setMenuOpen(false);
        onGoLive();
      },
      disabled: !canGoLive,
    },
    {
      label: isRunning ? 'End live' : 'Start live',
      action: () => {
        setMenuOpen(false);
        onToggleLive();
      },
      disabled: !canToggleLive,
      destructive: isRunning,
    },
    {
      label: 'Ingest',
      action: () => {
        setMenuOpen(false);
        onRtmp();
      },
    },
    {
      label: 'Edit',
      action: () => {
        setMenuOpen(false);
        onEdit();
      },
    },
    {
      label: 'Delete',
      action: () => {
        setMenuOpen(false);
        onDelete();
      },
      destructive: true,
    },
  ];

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        {/* Left column: title + pills + scheduled time */}
        <View style={cardStyles.metadata}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {stream.title || 'Untitled stream'}
          </Text>

          <View style={cardStyles.pillRow}>
            <View style={[cardStyles.pill, { backgroundColor: statusColor }]}>
              <Text style={cardStyles.pillTextLight}>{liveStreamStatusLabel(status)}</Text>
            </View>
            {stream.isPublic ? (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>Public</Text>
              </View>
            ) : null}
            {stream.dvrEnabled ? (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>DVR</Text>
              </View>
            ) : null}
            {stream.recordVod ? (
              <View style={cardStyles.pill}>
                <Text style={cardStyles.pillText}>VOD</Text>
              </View>
            ) : null}
          </View>

          {stream.scheduledStartTime ? (
            <Text style={cardStyles.scheduled}>
              Scheduled: {formatScheduled(stream.scheduledStartTime)}
            </Text>
          ) : null}
        </View>

        {/* Right: play button + overflow menu */}
        <TouchableOpacity
          onPress={onWatch}
          disabled={!canWatch}
          style={[cardStyles.playButton, !canWatch && cardStyles.playButtonDisabled]}
        >
          <Text style={cardStyles.playIcon}>▶</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuOpen(true)} style={cardStyles.menuButton}>
          <Text style={cardStyles.menuIcon}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Overflow menu — modal bottom sheet style */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity style={cardStyles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={cardStyles.menuSheet}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={cardStyles.menuItem}
                onPress={item.disabled ? undefined : item.action}
                disabled={item.disabled}
              >
                <Text
                  style={[
                    cardStyles.menuItemText,
                    item.destructive && cardStyles.menuItemTextDestructive,
                    item.disabled && cardStyles.menuItemTextDisabled,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  metadata: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  pill: {
    backgroundColor: 'rgba(37, 88, 143, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 50,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  pillTextLight: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scheduled: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  playButtonDisabled: {
    backgroundColor: 'rgba(24, 61, 109, 0.2)',
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 2,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  menuIcon: {
    color: colors.onSurfaceVariant,
    fontSize: 22,
    fontWeight: '700',
  },
  // Overflow menu modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.onSurface,
  },
  menuItemTextDestructive: {
    color: '#d32f2f',
  },
  menuItemTextDisabled: {
    color: '#bbb',
  },
});
