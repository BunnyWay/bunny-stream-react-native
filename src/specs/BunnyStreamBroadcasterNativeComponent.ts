import type { HostComponent, ViewProps } from 'react-native';
import type { DirectEventHandler, Int32 } from 'react-native/Libraries/Types/CodegenTypes';

import { codegenNativeComponent } from 'react-native';

// Internal Codegen spec for the broadcaster host view.
//
// This is NOT part of the public npm API — the public `BunnyStreamBroadcaster`
// component (src/broadcaster/BunnyStreamBroadcaster.tsx) wraps this native
// component and exposes typed props/commands.

export type BroadcasterStateChangeEvent = Readonly<{
  state: 'idle' | 'preparing' | 'live';
}>;

export type BroadcasterElapsedTimeEvent = Readonly<{
  elapsedMs: Int32;
  formatted: string;
}>;

export type BroadcasterCameraChangeEvent = Readonly<{
  position: 'front' | 'back';
}>;

export type BroadcasterMuteChangeEvent = Readonly<{
  muted: boolean;
}>;

export type BroadcasterIngestStateEvent = Readonly<{
  endpoint: 'primary' | 'backup';
  state: 'connecting' | 'live' | 'offline';
}>;

export type BroadcasterReconnectingEvent = Readonly<{
  attempt: Int32;
  usingBackup: boolean;
}>;

export type BroadcasterFailoverEvent = Readonly<{
  usingBackup: boolean;
}>;

export type BroadcasterErrorEvent = Readonly<{
  message: string;
}>;

export type BroadcasterReconnectFailedEvent = Readonly<{
  // Codegen requires at least one field in event payloads.
  failed: boolean;
}>;

export interface NativeProps extends ViewProps {
  accessKey: string;
  libraryId: Int32;
  streamId?: string;
  ingestEndpoint?: string;
  quality?: string;
  cameraPosition?: string;
  hideDefaultControls?: boolean;
  dualPublish?: boolean;
  autoStart?: boolean;
  onStateChange?: DirectEventHandler<BroadcasterStateChangeEvent> | null;
  onElapsedTime?: DirectEventHandler<BroadcasterElapsedTimeEvent> | null;
  onCameraChange?: DirectEventHandler<BroadcasterCameraChangeEvent> | null;
  onMuteChange?: DirectEventHandler<BroadcasterMuteChangeEvent> | null;
  onIngestStateChange?: DirectEventHandler<BroadcasterIngestStateEvent> | null;
  onReconnecting?: DirectEventHandler<BroadcasterReconnectingEvent> | null;
  onReconnectFailed?: DirectEventHandler<BroadcasterReconnectFailedEvent> | null;
  onFailover?: DirectEventHandler<BroadcasterFailoverEvent> | null;
  onError?: DirectEventHandler<BroadcasterErrorEvent> | null;
}

export default codegenNativeComponent<NativeProps>(
  'BunnyStreamBroadcasterView',
) as HostComponent<NativeProps>;
