import type {
  AddCaptionRequestInput,
  BroadcastCameraChangeEvent,
  BroadcastElapsedTimeEvent,
  BroadcastErrorEvent,
  BroadcastFailoverEvent,
  BroadcastIngestStateEvent,
  BroadcastMuteChangeEvent,
  BroadcastQuality,
  BroadcastReconnectingEvent,
  BroadcastSource,
  BroadcastState,
  BroadcastStateChangeEvent,
  BunnyStreamApi,
  BunnyStreamBroadcasterProps,
  BunnyStreamBroadcasterRef,
  BunnyStreamPlayerProps,
  BunnyStreamPlayerRef,
  BunnyStreamUpload,
  BunnyVodPlayerRef,
  CameraPosition,
  CollectionListOptions,
  DeleteResolutionsOptions,
  FetchNewVideoOptions,
  FetchVideoRequestInput,
  initialize,
  IngestEndpoint,
  IngestState,
  LiveStreamIngestStatus,
  LiveStreamThumbnail,
  RefetchVideoOptions,
  SmartGenerateRequestInput,
  StartUploadOptions,
  TranscribeVideoOptions,
  TranscribeVideoRequestInput,
  UploadEvent,
  UploadHandle,
  UploadState,
  VideoCodec,
  VideoCollection,
  VideoCollectionList,
  VideoHeatmap,
  VideoResolutionsInfo,
  VideoStatistics,
} from '../index';
import type {
  LiveErrorEvent,
  LiveStateChangeEvent,
  LiveVideoSizeChangeEvent,
  NativeProps as LiveNativeProps,
} from '../specs/BunnyLiveStreamPlayerNativeComponent';
import type {
  BroadcasterCameraChangeEvent,
  BroadcasterElapsedTimeEvent,
  BroadcasterErrorEvent,
  BroadcasterFailoverEvent,
  BroadcasterIngestStateEvent,
  BroadcasterMuteChangeEvent,
  BroadcasterReconnectingEvent,
  BroadcasterReconnectFailedEvent,
  BroadcasterStateChangeEvent,
  NativeProps as BroadcasterNativeProps,
} from '../specs/BunnyStreamBroadcasterNativeComponent';
import type {
  NativeCommands,
  NativeProps as VodNativeProps,
  PlayerBufferingEvent,
  PlayerErrorEvent,
  PlayerPlaybackErrorEvent,
  PlayerPlaybackRateChangeEvent,
  PlayerPositionEvent,
  PlayerProgressEvent,
  PlayerReadyEvent,
  PlayerStateChangeEvent,
  PlayerVideoSizeChangeEvent,
  PlayerVolumeChangeEvent,
} from '../specs/BunnyStreamPlayerNativeComponent';
import type { Spec as ApiSpec } from '../specs/NativeBunnyStreamApi';
import type { Spec as PlayerSpec } from '../specs/NativeBunnyStreamPlayer';
import type { Spec as UploadSpec } from '../specs/NativeBunnyStreamUpload';
import type { TurboModule } from 'react-native';

import { describe, expect, it } from '@jest/globals';

type Assert<T extends true> = T;
type Compatible<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type EventPayload<K extends keyof BunnyStreamPlayerProps> =
  NonNullable<BunnyStreamPlayerProps[K]> extends (event: { nativeEvent: infer Payload }) => void
    ? Payload
    : never;

type PublicApiMethods = keyof typeof BunnyStreamApi;
type NativeApiMethods = Exclude<keyof ApiSpec, keyof TurboModule>;
type PublicUploadMethods = Exclude<
  keyof typeof BunnyStreamUpload,
  'addUploadListener' | 'restoreUploads'
>;
type NativeUploadMethods = Exclude<
  keyof UploadSpec,
  keyof TurboModule | 'addListener' | 'removeListeners'
>;
type PublicCommandMethods = keyof BunnyStreamPlayerRef;
type NativeCommandMethods = keyof NativeCommands;
// skipForward/skipBackward are JS-side (implemented via seekTo + position
// tracking), so the native command set is a subset of the public ref.
export type PlayerCommandContract = Assert<
  [NativeCommandMethods] extends [PublicCommandMethods] ? true : false
>;

export type InitializationContract = Assert<
  Compatible<Parameters<typeof initialize>, Parameters<PlayerSpec['initialize']>>
>;
export type ApiMethodContract = Assert<
  Exclude<NativeApiMethods, PublicApiMethods> extends never ? true : false
>;
export type UploadMethodContract = Assert<
  Exclude<NativeUploadMethods, PublicUploadMethods> extends never ? true : false
>;
export type PhaseThreePublicTypesContract = [
  StartUploadOptions,
  UploadEvent,
  UploadHandle,
  UploadState,
];
export type PhaseFourPublicTypesContract = [
  AddCaptionRequestInput,
  DeleteResolutionsOptions,
  FetchNewVideoOptions,
  FetchVideoRequestInput,
  RefetchVideoOptions,
  SmartGenerateRequestInput,
  TranscribeVideoOptions,
  TranscribeVideoRequestInput,
  VideoCodec,
];
export type PhaseTwoPublicTypesContract = [
  CollectionListOptions,
  LiveStreamIngestStatus,
  LiveStreamThumbnail,
  VideoCollection,
  VideoCollectionList,
  VideoHeatmap,
  VideoResolutionsInfo,
  VideoStatistics,
];
export type LegacyPlayerRefContract = Assert<Compatible<BunnyStreamPlayerRef, BunnyVodPlayerRef>>;
export type ReadyEventContract = Assert<Compatible<EventPayload<'onReady'>, PlayerReadyEvent>>;
export type StateEventContract = Assert<
  Compatible<EventPayload<'onPlaybackStateChange'>, PlayerStateChangeEvent>
>;
export type ProgressEventContract = Assert<
  Compatible<EventPayload<'onProgress'>, PlayerProgressEvent>
>;
export type ErrorEventContract = Assert<Compatible<EventPayload<'onError'>, PlayerErrorEvent>>;
export type BufferingEventContract = Assert<
  Compatible<EventPayload<'onBuffering'>, PlayerBufferingEvent>
>;
export type PlayEventContract = Assert<Compatible<EventPayload<'onPlay'>, PlayerPositionEvent>>;
export type PauseEventContract = Assert<Compatible<EventPayload<'onPause'>, PlayerPositionEvent>>;
export type EndEventContract = Assert<Compatible<EventPayload<'onEnd'>, PlayerPositionEvent>>;
export type VolumeEventContract = Assert<
  Compatible<EventPayload<'onVolumeChange'>, PlayerVolumeChangeEvent>
>;
export type PlaybackRateEventContract = Assert<
  Compatible<EventPayload<'onPlaybackRateChange'>, PlayerPlaybackRateChangeEvent>
>;
export type VodVideoSizeEventContract = Assert<
  Compatible<EventPayload<'onVideoSizeChange'>, PlayerVideoSizeChangeEvent>
>;
export type LiveVideoSizeEventContract = Assert<
  Compatible<EventPayload<'onVideoSizeChange'>, LiveVideoSizeChangeEvent>
>;
export type PlaybackErrorEventContract = Assert<
  Compatible<EventPayload<'onPlaybackError'>, PlayerPlaybackErrorEvent>
>;
export type LiveStateEventContract = Assert<
  Compatible<EventPayload<'onLiveStateChange'>, LiveStateChangeEvent>
>;
export type LiveErrorEventContract = Assert<
  Compatible<EventPayload<'onLiveError'>, LiveErrorEvent>
>;
export type VodSourceContract = Assert<
  Compatible<
    Pick<VodNativeProps, 'videoId' | 'libraryId' | 'token' | 'expires'>,
    { videoId: string; libraryId?: number; token?: string; expires?: number }
  >
>;
export type LiveSourceContract = Assert<
  Compatible<
    Pick<LiveNativeProps, 'streamId' | 'libraryId' | 'token' | 'expires'>,
    { streamId: string; libraryId: number; token?: string; expires?: number }
  >
>;

// Phase 5 — broadcaster contracts.
// Spec event types must be compatible with the public event types.
export type BroadcasterStateSpecContract = Assert<
  Compatible<BroadcasterStateChangeEvent, BroadcastStateChangeEvent>
>;
export type BroadcasterElapsedTimeSpecContract = Assert<
  Compatible<BroadcasterElapsedTimeEvent, BroadcastElapsedTimeEvent>
>;
export type BroadcasterCameraSpecContract = Assert<
  Compatible<BroadcasterCameraChangeEvent, BroadcastCameraChangeEvent>
>;
export type BroadcasterMuteSpecContract = Assert<
  Compatible<BroadcasterMuteChangeEvent, BroadcastMuteChangeEvent>
>;
export type BroadcasterIngestStateSpecContract = Assert<
  Compatible<BroadcasterIngestStateEvent, BroadcastIngestStateEvent>
>;
export type BroadcasterReconnectingSpecContract = Assert<
  Compatible<BroadcasterReconnectingEvent, BroadcastReconnectingEvent>
>;
export type BroadcasterFailoverSpecContract = Assert<
  Compatible<BroadcasterFailoverEvent, BroadcastFailoverEvent>
>;
export type BroadcasterErrorSpecContract = Assert<
  Compatible<BroadcasterErrorEvent, BroadcastErrorEvent>
>;
export type BroadcasterReconnectFailedSpecContract = Assert<
  Compatible<BroadcasterReconnectFailedEvent, { failed: boolean }>
>;
export type BroadcasterSourceContract = Assert<
  Compatible<
    Pick<BroadcasterNativeProps, 'libraryId' | 'streamId' | 'ingestEndpoint'>,
    { libraryId: number; streamId?: string; ingestEndpoint?: string }
  >
>;
export type BroadcasterRefContract = Assert<
  Compatible<
    BunnyStreamBroadcasterRef,
    {
      startBroadcast: () => void;
      stopBroadcast: () => void;
      switchCamera: () => void;
      setMuted: (muted: boolean) => void;
      toggleMute: () => void;
    }
  >
>;
export type PhaseFivePublicTypesContract = [
  BroadcastCameraChangeEvent,
  BroadcastElapsedTimeEvent,
  BroadcastErrorEvent,
  BroadcastFailoverEvent,
  BroadcastIngestStateEvent,
  BroadcastMuteChangeEvent,
  BroadcastQuality,
  BroadcastReconnectingEvent,
  BroadcastSource,
  BroadcastState,
  BroadcastStateChangeEvent,
  BunnyStreamBroadcasterProps,
  BunnyStreamBroadcasterRef,
  CameraPosition,
  IngestEndpoint,
  IngestState,
];

describe('Codegen contract type checks', () => {
  it('compiles all public and native contract assertions', () => {
    expect(true).toBe(true);
  });
});
