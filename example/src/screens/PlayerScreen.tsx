import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import {
  BunnyStreamPlayer,
  sourceIdentityKey,
  useBunnyStreamPlayer,
} from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { styles } from '../theme/styles';

const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0];

type PlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'Player'>;

export function PlayerScreen({ navigation, route }: PlayerScreenProps) {
  const { videoId, libraryId } = route.params;
  const sourceKey = sourceIdentityKey({ type: 'vod', videoId, libraryId });
  const player = useBunnyStreamPlayer(undefined, sourceKey);

  const { state, progress, controls } = player;
  const loading = state.playbackState === 'idle' || state.playbackState === 'loading';

  const [currentSpeed, setCurrentSpeed] = React.useState(1.0);

  const handleSpeedChange = (speed: number) => {
    setCurrentSpeed(speed);
    controls.setPlaybackRate(speed);
  };

  const progressPct = `${(progress.progress * 100).toFixed(0)}%`;

  return (
    <View style={styles.playerContainer}>
      <Header title="Player" onBack={() => navigation.goBack()} />
      <View style={styles.playerWrapper}>
        <BunnyStreamPlayer
          ref={player.ref}
          style={styles.player}
          source={{ type: 'vod', videoId, libraryId }}
          autoPlay
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

      <Text style={styles.status}>
        {state.playbackState}
        {progress.progress > 0 ? ` • progress ${progressPct}` : ''}
      </Text>

      <View style={styles.speedSection}>
        <Text style={styles.speedTitle}>Playback Speed</Text>
        <View style={styles.speedRow}>
          {SPEED_OPTIONS.map((speed) => {
            const isActive = speed === currentSpeed;
            return (
              <TouchableOpacity
                key={speed}
                style={[styles.speedButton, isActive && styles.speedButtonActive]}
                onPress={() => handleSpeedChange(speed)}
              >
                <Text style={[styles.speedButtonText, isActive && styles.speedButtonTextActive]}>
                  {speed}x
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
