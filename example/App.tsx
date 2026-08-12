import {
  BunnyStreamPlayer,
  initialize,
  type BunnyStreamPlayerRef,
} from 'bunny-stream-react-native';
import * as React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

// Replace with your own Bunny Stream credentials for local testing.
const ACCESS_KEY: string | null = null;
const LIBRARY_ID = 0;
const VIDEO_ID = '';

function App() {
  const playerRef = React.useRef<BunnyStreamPlayerRef>(null);
  const [status, setStatus] = React.useState<string>('idle');

  React.useEffect(() => {
    if (ACCESS_KEY != null && LIBRARY_ID > 0) {
      initialize(ACCESS_KEY, LIBRARY_ID);
    }
  }, []);

  return (
    <View style={styles.container}>
      {VIDEO_ID ? (
        <BunnyStreamPlayer
          ref={playerRef}
          style={styles.player}
          videoId={VIDEO_ID}
          libraryId={LIBRARY_ID > 0 ? LIBRARY_ID : undefined}
          autoPlay
          onReady={e => setStatus(`ready • ${e.nativeEvent.durationMs}ms`)}
          onPlay={() => setStatus('playing')}
          onPause={() => setStatus('paused')}
          onEnd={() => setStatus('ended')}
          onError={e => setStatus(`error: ${e.nativeEvent.message}`)}
          onProgress={e =>
            setStatus(`progress ${(e.nativeEvent.progress * 100).toFixed(0)}%`)
          }
        />
      ) : (
        <Text style={styles.placeholder}>
          Set VIDEO_ID, LIBRARY_ID, and ACCESS_KEY in App.tsx to test playback.
        </Text>
      )}

      <View style={styles.controls}>
        <Button title="Play" onPress={() => playerRef.current?.play()} />
        <Button title="Pause" onPress={() => playerRef.current?.pause()} />
        <Button
          title="+10s"
          onPress={() => playerRef.current?.seekTo(Date.now() % 60000)}
        />
      </View>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  player: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    color: '#fff',
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 24,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
  },
  status: {
    color: '#fff',
    textAlign: 'center',
    padding: 8,
  },
});

export default App;
