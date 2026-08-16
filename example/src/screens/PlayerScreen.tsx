import * as React from 'react';
import { StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BunnyStreamPlayer, type BunnyStreamPlayerRef } from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { styles } from '../theme/styles';

const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0];

type PlayerScreenProps = {
  videoId: string;
  libraryId: number;
  onBack: () => void;
};

export function PlayerScreen({ videoId, libraryId, onBack }: PlayerScreenProps) {
  const playerRef = React.useRef<BunnyStreamPlayerRef>(null);
  const [status, setStatus] = React.useState('idle');
  const [currentSpeed, setCurrentSpeed] = React.useState(1.0);
  const [error, setError] = React.useState<string | null>(null);

  const handleSpeedChange = (speed: number) => {
    setCurrentSpeed(speed);
    playerRef.current?.setPlaybackRate(speed);
  };

  return (
    <SafeAreaView style={styles.playerContainer} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#183D6D" />
      <Header title="Player" onBack={onBack} />
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
          onProgress={(e) => setStatus(`progress ${(e.nativeEvent.progress * 100).toFixed(0)}%`)}
        />
        {error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>Playback Error</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Text style={styles.errorVideoId} numberOfLines={1}>
              Video ID: {videoId}
            </Text>
            <TouchableOpacity style={styles.errorButton} onPress={onBack}>
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <Text style={styles.status}>{status}</Text>

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
    </SafeAreaView>
  );
}
