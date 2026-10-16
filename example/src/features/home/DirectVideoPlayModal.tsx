import { BUNNY_VIDEO_ID, BUNNY_VIDEO_IDS } from '@env';
import * as React from 'react';

import {
  loadDirectPlayValues,
  saveDirectPlayValues,
  parseVideoIdsFromEnv,
} from '../../storage/settings';
import { DirectPlayModal } from './DirectPlayModal';

type DirectVideoPlayModalProps = {
  visible: boolean;
  onClose: () => void;
  onPlay: (videoId: string, libraryId: number) => void;
};

export function DirectVideoPlayModal({ visible, onClose, onPlay }: DirectVideoPlayModalProps) {
  return (
    <DirectPlayModal
      visible={visible}
      onClose={onClose}
      onPlay={onPlay}
      title="Direct Video Play"
      subtitle="Enter a video ID to play directly."
      fieldLabel="Video ID"
      actionLabel="Play"
      envIds={parseVideoIdsFromEnv({ BUNNY_VIDEO_IDS, BUNNY_VIDEO_ID })}
      loadValues={async () => {
        const stored = await loadDirectPlayValues();
        return stored ? { id: stored.videoId, libraryId: stored.libraryId } : null;
      }}
      saveValues={(values) =>
        saveDirectPlayValues({ videoId: values.id, libraryId: values.libraryId })
      }
    />
  );
}
