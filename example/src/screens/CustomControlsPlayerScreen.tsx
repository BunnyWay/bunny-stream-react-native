import * as React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { BunnyStreamPlayer, type BunnyStreamPlayerRef } from 'bunny-stream-react-native';

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

type CustomControlsPlayerScreenProps = {
  videoId: string;
  libraryId: number;
  onBack: () => void;
};

export function CustomControlsPlayerScreen({
  videoId,
  libraryId,
  onBack,
}: CustomControlsPlayerScreenProps) {
  const playerRef = React.useRef<BunnyStreamPlayerRef>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [positionMs, setPositionMs] = React.useState(0);
  const [durationMs, setDurationMs] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState('idle');

  const handlePlay = () => {
    playerRef.current?.play();
  };

  const handlePause = () => {
    playerRef.current?.pause();
  };

  const handleSeek = (deltaMs: number) => {
    const target = Math.max(0, Math.min(positionMs + deltaMs, durationMs));
    playerRef.current?.seekTo(target);
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <View style={styles.playerContainer}>
      <Header title="Player (Custom)" onBack={onBack} />
      <View style={styles.playerWrapper}>
        <BunnyStreamPlayer
          ref={playerRef}
          style={styles.player}
          videoId={videoId}
          libraryId={libraryId}
          autoPlay
          controls={false}
          onReady={(e) => {
            setError(null);
            setDurationMs(e.nativeEvent.durationMs);
            setStatus('ready');
          }}
          onPlay={() => {
            setIsPlaying(true);
            setStatus('playing');
          }}
          onPause={() => {
            setIsPlaying(false);
            setStatus('paused');
          }}
          onEnd={() => {
            setIsPlaying(false);
            setStatus('ended');
          }}
          onError={(e) => {
            setError(e.nativeEvent.message || 'Unknown error');
            setStatus('error');
          }}
          onProgress={(e) => {
            setPositionMs(e.nativeEvent.positionMs);
            setDurationMs(e.nativeEvent.durationMs);
          }}
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

      {/* Position bar */}
      <View style={styles.controlsSection}>
        <View style={styles.positionBar}>
          <View style={[styles.positionBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.positionText}>
          {formatTime(positionMs)} / {formatTime(durationMs)}
        </Text>

        {/* Control buttons */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlButton} onPress={() => handleSeek(-SEEK_MS)}>
            <Text style={styles.controlButtonText}>⏪</Text>
          </TouchableOpacity>

          {isPlaying ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.controlButtonPrimary]}
              onPress={handlePause}
            >
              <Text style={[styles.controlButtonText, styles.controlButtonTextPrimary]}>⏸</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.controlButton, styles.controlButtonPrimary]}
              onPress={handlePlay}
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
