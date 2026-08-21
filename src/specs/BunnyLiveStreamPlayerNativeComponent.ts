import type { HostComponent, ViewProps } from 'react-native';
import type { DirectEventHandler, Double, Int32 } from 'react-native/Libraries/Types/CodegenTypes';

import { codegenNativeComponent } from 'react-native';

// Internal Codegen spec for the live-stream host view.
//
// This is NOT part of the public npm API — the public `BunnyStreamPlayer`
// component (src/index.tsx) selects between the VOD host
// (`BunnyStreamPlayerNativeComponent`) and this live host based on
// `source.type`. See PLAN.md §5 "Dwie implementacje wewnętrzne Androida".
//
// The live host renders the SDK's Compose `BunnyLiveStreamPlayer` composable
// inside a ComposeView. The SDK owns polling, the state resolver, countdown /
// trailer overlays, DVR, recovery and the live → VOD hand-off. The bridge
// only forwards `onVideoSizeChange` (and, once the SDK exposes a public
// controller, playback commands — see PLAN.md §6 Faza 5).

export type LiveVideoSizeChangeEvent = Readonly<{
  width: Int32;
  height: Int32;
}>;

export interface NativeProps extends ViewProps {
  libraryId: Double;
  streamId: string;
  token?: string;
  expires?: Double;
  onVideoSizeChange?: DirectEventHandler<LiveVideoSizeChangeEvent> | null;
}

// The live host has no commands today — the SDK does not yet expose a public
// live controller (PLAN.md §6 Faza 5). When commands are added, declare a
// `NativeCommands` interface here and register it via `codegenNativeCommands`.
// An empty interface is omitted because it would type-accept any non-nullish
// value (eslint no-empty-interface).

export default codegenNativeComponent<NativeProps>(
  'BunnyLiveStreamPlayerView',
) as HostComponent<NativeProps>;
