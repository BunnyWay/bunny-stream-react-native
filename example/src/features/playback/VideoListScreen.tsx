import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_ACCESS_KEY } from '@env';
import * as React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  BunnyStreamApi,
  TRANSITIONAL_VIDEO_STATUSES,
  VideoStatusEnum,
  fold,
  getOrNull,
  type Video,
  type VideoStatus,
} from 'bunny-stream-react-native';

import { BunnyThumbnail } from '../../components/BunnyThumbnail';
import { Header } from '../../components/Header';
import { ListStateView } from '../../components/ListStateView';
import { OutlineButton } from '../../components/OutlineButton';
import { StatusPill } from '../../components/StatusPill';
import { loadLibraryConfig } from '../../storage/settings';
import { colors } from '../../theme/colors';
import { styles } from '../../theme/styles';
import { formatDuration } from '../../utils/format';

type VideoListScreenProps = NativeStackScreenProps<RootStackParamList, 'VideoList'>;

/** Poll interval for refreshing the list while any video is still processing. */
const STATUS_POLL_INTERVAL_MS = 5_000;

type UiState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; videos: Video[] }
  | { kind: 'error'; message: string };

export function VideoListScreen({ navigation }: VideoListScreenProps) {
  const [uiState, setUiState] = React.useState<UiState>({ kind: 'loading' });
  const [libraryId, setLibraryId] = React.useState<number | null>(null);
  // Thumbnail URLs keyed by video ID — enriched via fetchPlayerSettings,
  // like the Android demo's LibraryViewModel.enrichMissingThumbnails.
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({});

  const loadLibrary = React.useCallback(async () => {
    const { libraryId: libId } = await loadLibraryConfig();
    if (libId == null) {
      setUiState({ kind: 'error', message: 'Library ID not configured. Set it in Settings.' });
      return;
    }
    setLibraryId(libId);

    setUiState((prev) => (prev.kind === 'loaded' ? prev : { kind: 'loading' }));
    const result = await BunnyStreamApi.listVideos(libId, { orderBy: 'date' });
    fold(
      result,
      (list) => {
        if (list.items.length === 0) {
          setUiState({ kind: 'empty' });
        } else {
          setUiState({ kind: 'loaded', videos: list.items });
        }
      },
      (error) => setUiState({ kind: 'error', message: error.message }),
    );
  }, []);

  // Initial load
  React.useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Enrich thumbnails for videos that don't have one yet — calls
  // fetchPlayerSettings per video (like the Android demo). For token-auth
  // libraries, signs a short-lived playback token so the API returns a
  // thumbnail URL that loads without 403.
  React.useEffect(() => {
    if (uiState.kind !== 'loaded' || libraryId == null) return;
    const missing = uiState.videos.filter((v) => !thumbnails[v.id]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const resolved: Record<string, string> = {};
      for (const video of missing) {
        if (cancelled) return;
        // Sign a playback token when the library has token auth on — the
        // thumbnail URL returned by fetchPlayerSettings then carries the
        // token query params needed to load without 403.
        const { token, expires } = BunnyStreamApi.signPlaybackToken(BUNNY_ACCESS_KEY, video.id);
        // Try fetchPlayerSettings first (like the Android demo), then fall
        // back to fetchVideoPlayData which also carries a thumbnailUrl.
        let url: string | undefined;
        const settingsResult = await BunnyStreamApi.fetchPlayerSettings(
          libraryId,
          video.id,
          token,
          expires,
        );
        const settings = getOrNull(settingsResult);
        if (settings?.thumbnailUrl) {
          url = settings.thumbnailUrl;
        }
        if (!url) {
          const playResult = await BunnyStreamApi.fetchVideoPlayData(
            libraryId,
            video.id,
            token,
            expires,
          );
          const playData = getOrNull(playResult);
          if (playData?.thumbnailUrl) {
            url = playData.thumbnailUrl;
          }
        }
        if (url) {
          resolved[video.id] = url;
        }
      }
      if (!cancelled && Object.keys(resolved).length > 0) {
        setThumbnails((prev) => ({ ...prev, ...resolved }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uiState, libraryId, thumbnails]);

  // Poll status while any video is transitional (processing/transcoding),
  // gated on the screen being mounted. Mirrors LibraryViewModel.onStatusPollTick.
  React.useEffect(() => {
    if (uiState.kind !== 'loaded') return;
    const hasTransitional = uiState.videos.some((v) =>
      TRANSITIONAL_VIDEO_STATUSES.has(v.status as VideoStatus),
    );
    if (!hasTransitional) return;

    const id = setInterval(() => {
      loadLibrary();
    }, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [uiState, loadLibrary]);

  const handlePlayVideo = (videoId: string) => {
    if (libraryId == null) return;
    navigation.navigate('Player', { videoId, libraryId });
  };

  const handleManageVideo = (videoId: string) => {
    if (libraryId == null) return;
    navigation.navigate('VideoManagement', { videoId, libraryId });
  };

  const videos = uiState.kind === 'loaded' ? uiState.videos : [];
  const isEmpty = uiState.kind === 'empty' || uiState.kind === 'error';

  return (
    <>
      <Header title="Video Library" onBack={() => navigation.goBack()} />
      <FlatList
        style={styles.content}
        data={videos}
        keyExtractor={(video) => video.id}
        renderItem={({ item: video }) => (
          <VideoCard
            video={video}
            thumbnailUrl={thumbnails[video.id]}
            onPress={() => handlePlayVideo(video.id)}
            onManage={() => handleManageVideo(video.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={uiState.kind === 'loading'}
            onRefresh={loadLibrary}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <ListStateView
            state={uiState}
            emptyMessage="No videos in this library."
            onRetry={loadLibrary}
          />
        }
        contentContainerStyle={[isEmpty ? sectionStyles.emptyList : sectionStyles.list]}
      />
    </>
  );
}

/** Where the video is in Bunny's encoding pipeline — mirrors
 * `VideoResponseInfo.encodingState` in the iOS example app. Statuses:
 * 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished, 5 Error,
 * 6 UploadFailed, 7 JitSegmenting, 8 JitPlaylistsCreated.
 *
 * `encodeProgress` alone isn't enough: JIT libraries finish at status 8
 * without the progress ever reaching 100, and a failed encode would
 * otherwise read as "Processing" forever. */
type EncodingState = 'processing' | 'failed' | 'finished';

function encodingState(video: Video): EncodingState {
  const status = video.status as VideoStatus | null | undefined;
  if (status == null) {
    return video.encodeProgress === 100 ? 'finished' : 'processing';
  }
  switch (status) {
    case VideoStatusEnum.FINISHED:
    case VideoStatusEnum.JIT_PLAYLISTS_CREATED:
      return 'finished';
    case VideoStatusEnum.ERROR:
    case VideoStatusEnum.UPLOAD_FAILED:
      return 'failed';
    default:
      return 'processing';
  }
}

/** Badge text while encoding — with the percentage once the encoder reports
 * progress. Mirrors `VideoResponseInfo.processingLabel` on iOS. */
function processingLabel(video: Video): string {
  const progress = video.encodeProgress;
  return progress >= 1 && progress < 100 ? `Processing ${progress}%` : 'Processing';
}

/** Renders a single video card. `BunnyThumbnail` wraps `useBunnyImage` — the
 * Bunny CDN requires a `Referer` header that native image pipelines drop, so
 * the hook fetches through JS and renders a `data:` URI. */
function VideoCard({
  video,
  thumbnailUrl,
  onPress,
  onManage,
}: {
  video: Video;
  thumbnailUrl: string | undefined;
  onPress: () => void;
  onManage: () => void;
}) {
  return (
    <TouchableOpacity style={videoCardStyles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={videoCardStyles.thumbnailContainer}>
        {thumbnailUrl ? (
          <BunnyThumbnail url={thumbnailUrl} style={videoCardStyles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={videoCardStyles.thumbnailPlaceholder} />
        )}
      </View>
      <View style={videoCardStyles.info}>
        <View style={videoCardStyles.titleRow}>
          <Text style={videoCardStyles.title} numberOfLines={1}>
            {video.title || 'Untitled'}
          </Text>
          <OutlineButton
            label="Manage"
            onPress={onManage}
            style={videoCardStyles.manageButton}
            textStyle={videoCardStyles.manageButtonText}
          />
        </View>
        <View style={videoCardStyles.pillRow}>
          {/* Encoding state is only surfaced while it isn't finished — a
              playable video shows no status badge. */}
          {encodingState(video) === 'processing' ? (
            <StatusPill
              label={processingLabel(video)}
              backgroundColor="rgba(126, 87, 194, 0.12)"
              color="#7E57C2"
            />
          ) : encodingState(video) === 'failed' ? (
            <StatusPill label="Failed" backgroundColor="rgba(211, 47, 47, 0.12)" color="#D32F2F" />
          ) : null}
          <StatusPill label={formatDuration(video.lengthSeconds)} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const sectionStyles = StyleSheet.create({
  emptyList: {
    flexGrow: 1,
  },
  list: {
    paddingBottom: 48,
  },
});

const videoCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1a1a2e',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  info: {
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    flex: 1,
    marginRight: 8,
  },
  manageButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  manageButtonText: {
    fontSize: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
