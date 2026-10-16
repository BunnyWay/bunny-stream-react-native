import { BUNNY_STREAM_ID, BUNNY_STREAM_IDS } from '@env';
import * as React from 'react';

import {
  loadDirectLiveValues,
  saveDirectLiveValues,
  parseStreamIdsFromEnv,
} from '../../storage/settings';
import { DirectPlayModal } from './DirectPlayModal';

type DirectLivePlayModalProps = {
  visible: boolean;
  onClose: () => void;
  onPlay: (streamId: string, libraryId: number) => void;
};

export function DirectLivePlayModal({ visible, onClose, onPlay }: DirectLivePlayModalProps) {
  return (
    <DirectPlayModal
      visible={visible}
      onClose={onClose}
      onPlay={onPlay}
      title="Direct Live Play"
      subtitle="Enter a live stream ID to watch it directly."
      fieldLabel="Stream ID"
      actionLabel="Watch"
      envIds={parseStreamIdsFromEnv({ BUNNY_STREAM_IDS, BUNNY_STREAM_ID })}
      loadValues={async () => {
        const stored = await loadDirectLiveValues();
        return stored ? { id: stored.streamId, libraryId: stored.libraryId } : null;
      }}
      saveValues={(values) =>
        saveDirectLiveValues({ streamId: values.id, libraryId: values.libraryId })
      }
    />
  );
}
