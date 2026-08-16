import * as React from 'react';
import { StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BunnyStreamPlayer,
  type BunnyStreamPlayerRef,
} from 'bunny-stream-react-native';

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

  const handleSpeedChange = (speed: number) => {
    setCurrentSpeed(speed);
    playerRef.current?.setPlaybackRate(speed);
  };

  return (
    <SafeAreaView style={styles.playerContainer} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#183D6D" />
      <Header title="Player" onBack={onBack} />
      <BunnyStreamPlayer
        ref={playerRef}
        style={styles.player}
        videoId={videoId}
        libraryId={libraryId}
        autoPlay
        onReady={(e) => setStatus(`ready • ${e.nativeEvent.durationMs}ms`)}
        onPlay={() => setStatus('playing')}
        onPause={() => setStatus('paused')}
        onEnd={() => setStatus('ended')}
        onError={(e) => setStatus(`error: ${e.nativeEvent.message}`)}
        onProgress={(e) =>
          setStatus(`progress ${(e.nativeEvent.progress * 100).toFixed(0)}%`)
        }
      />
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
                <Text
                  style={[
                    styles.speedButtonText,
                    isActive && styles.speedButtonTextActive,
                  ]}
                >
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
