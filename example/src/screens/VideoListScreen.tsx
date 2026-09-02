import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID } from '@env';
import * as React from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  BunnyStreamApi,
  TRANSITIONAL_VIDEO_STATUSES,
  fold,
  getOrNull,
  useBunnyImage,
  videoStatusLabel,
  type Video,
  type VideoStatus,
} from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { loadSettings } from '../storage/storage';
import { colors } from '../theme/colors';
import { styles } from '../theme/styles';

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
    const stored = await loadSettings();
    const libIdStr = stored?.libraryId ?? BUNNY_LIBRARY_ID ?? '';
    const libId = parseInt(libIdStr, 10);
    if (isNaN(libId)) {
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
          uiState.kind === 'empty' ? (
            <Text style={styles.videoListEmpty}>No videos in this library.</Text>
          ) : uiState.kind === 'error' ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.errorMessage}>{uiState.message}</Text>
              <TouchableOpacity style={styles.errorButton} onPress={loadLibrary}>
                <Text style={styles.errorButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        contentContainerStyle={[isEmpty ? sectionStyles.emptyList : sectionStyles.list]}
      />
    </>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Renders a single video card. Uses `useBunnyImage` to resolve the Bunny
 * CDN thumbnail URL (with Referer header) to a data: URI the plain `Image`
 * can render. */
function VideoCard({
  video,
  thumbnailUrl,
  onPress,
}: {
  video: Video;
  thumbnailUrl: string | undefined;
  onPress: () => void;
}) {
  const { uri } = useBunnyImage(thumbnailUrl);

  return (
    <TouchableOpacity style={videoCardStyles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={videoCardStyles.thumbnailContainer}>
        {uri ? (
          <Image source={{ uri }} style={videoCardStyles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={videoCardStyles.thumbnailPlaceholder} />
        )}
      </View>
      <View style={videoCardStyles.info}>
        <Text style={videoCardStyles.title} numberOfLines={1}>
          {video.title || 'Untitled'}
        </Text>
        <View style={videoCardStyles.pillRow}>
          <View style={videoCardStyles.pill}>
            <Text style={videoCardStyles.pillText}>
              {videoStatusLabel(video.status as VideoStatus)}
            </Text>
          </View>
          <View style={videoCardStyles.pill}>
            <Text style={videoCardStyles.pillText}>{formatDuration(video.lengthSeconds)}</Text>
          </View>
          {video.views > 0 ? (
            <View style={videoCardStyles.pill}>
              <Text style={videoCardStyles.pillText}>{video.views} views</Text>
            </View>
          ) : null}
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
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: 'rgba(37, 88, 143, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
});
