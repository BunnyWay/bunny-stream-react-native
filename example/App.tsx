import {
  BunnyStreamPlayer,
  initialize,
  type BunnyStreamPlayerRef,
} from 'bunny-stream-react-native';
import * as React from 'react';
import {
  Alert,
  Button,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Screen = 'home' | 'settings' | 'player';

type PlayerParams = {
  videoId: string;
  libraryId: number;
};

export default function App() {
  const [screen, setScreen] = React.useState<Screen>('home');
  const [accessKey, setAccessKey] = React.useState<string>(
    'eed581d7-235a-4bea-a78968ee066d-5ea3-4011',
  );
  const [libraryId, setLibraryId] = React.useState<string>('726775');
  const [playerParams, setPlayerParams] = React.useState<PlayerParams | null>(
    null,
  );

  // Initialize SDK on mount with default credentials.
  React.useEffect(() => {
    initialize(accessKey || null, parseInt(libraryId, 10));
  }, []);

  const handleSaveSettings = () => {
    const libId = parseInt(libraryId, 10);
    if (!libraryId || isNaN(libId)) {
      Alert.alert('Invalid input', 'Please enter a valid numeric Library ID.');
      return;
    }
    initialize(accessKey || null, libId);
    setScreen('home');
  };

  const handlePlayVideo = (videoId: string) => {
    const libId = parseInt(libraryId, 10);
    if (!libraryId || isNaN(libId)) {
      Alert.alert(
        'Configuration required',
        'Please set your Library ID in Settings first.',
      );
      return;
    }
    setPlayerParams({ videoId, libraryId: libId });
    setScreen('player');
  };

  if (screen === 'settings') {
    return (
      <SettingsScreen
        accessKey={accessKey}
        libraryId={libraryId}
        onAccessKeyChange={setAccessKey}
        onLibraryIdChange={setLibraryId}
        onSave={handleSaveSettings}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'player' && playerParams) {
    return (
      <PlayerScreen
        videoId={playerParams.videoId}
        libraryId={playerParams.libraryId}
        onBack={() => {
          setPlayerParams(null);
          setScreen('home');
        }}
      />
    );
  }

  return (
    <HomeScreen
      onNavigate={setScreen}
      onPlayVideo={handlePlayVideo}
      hasConfig={!!libraryId && !isNaN(parseInt(libraryId, 10))}
    />
  );
}

// --- Home Screen ---

type HomeScreenProps = {
  onNavigate: (screen: Screen) => void;
  onPlayVideo: (videoId: string) => void;
  hasConfig: boolean;
};

function HomeScreen({ onNavigate, onPlayVideo, hasConfig }: HomeScreenProps) {
  const [showVideoIdModal, setShowVideoIdModal] = React.useState(false);
  const [videoId, setVideoId] = React.useState(
    '575cfbfe-08c0-4d2e-b0f4-3a81a0357d4b',
  );

  const handlePlay = () => {
    if (!videoId.trim()) {
      Alert.alert('Missing Video ID', 'Please enter a Video ID to play.');
      return;
    }
    setShowVideoIdModal(false);
    onPlayVideo(videoId.trim());
    setVideoId('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#f5f5f7" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BunnyStream Demo</Text>
      </View>
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.card}>
          <HomeOption
            title="Direct Video Play"
            subtitle="Play a video by ID"
            onPress={() => setShowVideoIdModal(true)}
          />
          <View style={styles.divider} />
          <HomeOption
            title="BunnyStream Configuration"
            subtitle={hasConfig ? 'Configured' : 'Not configured'}
            onPress={() => onNavigate('settings')}
          />
        </View>
      </ScrollView>

      <Modal
        visible={showVideoIdModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVideoIdModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Video ID</Text>
            <Text style={styles.modalSubtitle}>
              Please enter the ID of the video you want to play.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Video ID"
              value={videoId}
              onChangeText={setVideoId}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowVideoIdModal(false);
                  setVideoId('');
                }}
              />
              <Button title="Play" onPress={handlePlay} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function HomeOption({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.optionRow} onPress={onPress}>
      <View>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.optionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// --- Settings Screen ---

type SettingsScreenProps = {
  accessKey: string;
  libraryId: string;
  onAccessKeyChange: (value: string) => void;
  onLibraryIdChange: (value: string) => void;
  onSave: () => void;
  onBack: () => void;
};

function SettingsScreen({
  accessKey,
  libraryId,
  onAccessKeyChange,
  onLibraryIdChange,
  onSave,
  onBack,
}: SettingsScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#f5f5f7" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Video Library ID</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your Library ID"
          value={libraryId}
          onChangeText={onLibraryIdChange}
          keyboardType="numeric"
        />
        <Text style={styles.sectionTitle}>Video Library API Key</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your Library API Key"
          value={accessKey}
          onChangeText={onAccessKeyChange}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <View style={styles.saveButtonContainer}>
          <Button title="Save" onPress={onSave} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Player Screen ---

type PlayerScreenProps = {
  videoId: string;
  libraryId: number;
  onBack: () => void;
};

function PlayerScreen({ videoId, libraryId, onBack }: PlayerScreenProps) {
  const playerRef = React.useRef<BunnyStreamPlayerRef>(null);
  const [status, setStatus] = React.useState('idle');

  return (
    <SafeAreaView style={styles.playerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Player</Text>
        <View style={styles.backButton} />
      </View>
      <BunnyStreamPlayer
        ref={playerRef}
        style={styles.player}
        videoId={videoId}
        libraryId={libraryId}
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
      <Text style={styles.status}>{status}</Text>
    </SafeAreaView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#6c2bd9',
    minHeight: 44,
    paddingTop: Platform.OS === 'ios' ? 4 : 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    width: 60,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 17,
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  optionRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionTitle: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginHorizontal: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  saveButtonContainer: {
    marginTop: 16,
  },
  // Player screen
  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  status: {
    color: '#fff',
    textAlign: 'center',
    padding: 8,
    backgroundColor: '#111',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});
