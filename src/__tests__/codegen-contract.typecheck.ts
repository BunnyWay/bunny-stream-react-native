import type {
  BunnyStreamApi,
  BunnyStreamPlayerProps,
  BunnyStreamPlayerRef,
  BunnyStreamUpload,
  BunnyVodPlayerRef,
  CollectionListOptions,
  initialize,
  LiveStreamIngestStatus,
  LiveStreamThumbnail,
  StartUploadOptions,
  UploadEvent,
  UploadHandle,
  UploadState,
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
export type PlayerCommandContract = Assert<Compatible<PublicCommandMethods, NativeCommandMethods>>;
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

describe('Codegen contract type checks', () => {
  it('compiles all public and native contract assertions', () => {
    expect(true).toBe(true);
  });
});
