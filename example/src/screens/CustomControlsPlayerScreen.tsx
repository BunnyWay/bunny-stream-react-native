import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { BunnyStreamPlayer, useBunnyStreamPlayer } from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { styles } from '../theme/styles';

const SEEK_MS = 10_000;

function formatTime(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

type CustomControlsPlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'PlayerCustom'>;

export function CustomControlsPlayerScreen({ navigation, route }: CustomControlsPlayerScreenProps) {
  const { videoId, libraryId } = route.params;
  const player = useBunnyStreamPlayer();

  const { state, progress, controls } = player;
  const loading = state.playbackState === 'idle' || state.playbackState === 'loading';

  const handleSeek = (deltaMs: number) => {
    const target = Math.max(0, Math.min(progress.positionMs + deltaMs, state.durationMs));
    controls.seekTo(target);
  };

  const seekProgress =
    state.durationMs > 0 ? progress.positionMs / state.durationMs : progress.progress;

  return (
    <View style={styles.playerContainer}>
      <Header title="Player (Custom)" onBack={() => navigation.goBack()} />
      <View style={styles.playerWrapper}>
        <BunnyStreamPlayer
          ref={player.ref}
          style={styles.player}
          videoId={videoId}
          libraryId={libraryId}
          autoPlay
          controls={false}
          {...player.eventHandlers}
        />
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : null}
        {state.error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>Playback Error</Text>
            <Text style={styles.errorMessage}>{state.error.message}</Text>
            <Text style={styles.errorVideoId} numberOfLines={1}>
              Video ID: {videoId}
            </Text>
            <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <Text style={styles.status}>{state.playbackState}</Text>

      {/* Position bar */}
      <View style={styles.controlsSection}>
        <View style={styles.positionBar}>
          <View style={[styles.positionBarFill, { width: `${seekProgress * 100}%` }]} />
        </View>
        <Text style={styles.positionText}>
          {formatTime(progress.positionMs)} / {formatTime(state.durationMs)}
        </Text>

        {/* Control buttons */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlButton} onPress={() => handleSeek(-SEEK_MS)}>
            <Text style={styles.controlButtonText}>⏪</Text>
          </TouchableOpacity>

          {state.isPlaying ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.controlButtonPrimary]}
              onPress={controls.pause}
            >
              <Text style={[styles.controlButtonText, styles.controlButtonTextPrimary]}>⏸</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.controlButton, styles.controlButtonPrimary]}
              onPress={controls.play}
            >
              <Text style={[styles.controlButtonText, styles.controlButtonTextPrimary]}>▶</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.controlButton} onPress={() => handleSeek(SEEK_MS)}>
            <Text style={styles.controlButtonText}>⏩</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
