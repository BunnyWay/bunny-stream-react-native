import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { BunnyStreamPlayer, type BunnyStreamPlayerRef } from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { styles } from '../theme/styles';

const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0];

type PlayerScreenProps = NativeStackScreenProps<RootStackParamList, 'Player'>;

export function PlayerScreen({ navigation, route }: PlayerScreenProps) {
  const { videoId, libraryId } = route.params;
  const playerRef = React.useRef<BunnyStreamPlayerRef>(null);
  const [status, setStatus] = React.useState('idle');
  const [progress, setProgress] = React.useState<string | null>(null);
  const [currentSpeed, setCurrentSpeed] = React.useState(1.0);
  const [error, setError] = React.useState<string | null>(null);

  const handleSpeedChange = (speed: number) => {
    setCurrentSpeed(speed);
    playerRef.current?.setPlaybackRate(speed);
  };

  return (
    <View style={styles.playerContainer}>
      <Header title="Player" onBack={() => navigation.goBack()} />
      <View style={styles.playerWrapper}>
        <BunnyStreamPlayer
          ref={playerRef}
          style={styles.player}
          videoId={videoId}
          libraryId={libraryId}
          autoPlay
          onReady={(e) => {
            setError(null);
            setStatus(`ready • ${e.nativeEvent.durationMs}ms`);
          }}
          onPlay={() => setStatus('playing')}
          onPause={() => setStatus('paused')}
          onEnd={() => setStatus('ended')}
          onError={(e) => {
            setError(e.nativeEvent.message || 'Unknown error');
            setStatus('error');
          }}
          onProgress={(e) => setProgress(`progress ${(e.nativeEvent.progress * 100).toFixed(0)}%`)}
        />
        {error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>Playback Error</Text>
            <Text style={styles.errorMessage}>{error}</Text>
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
        {status}
        {progress ? ` • ${progress}` : ''}
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
