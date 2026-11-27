import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID, BUNNY_TOKEN_AUTH_KEY } from '@env';
import { usePreventRemove } from '@react-navigation/native';
import * as React from 'react';
import {
  Alert,
  Button,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { initialize } from '@bunny.net/stream-react-native';

import { android, ios, version } from '../../../app.json';
import { Header } from '../../components/Header';
import { OutlineButton } from '../../components/OutlineButton';
import { ToggleRow } from '../../components/ToggleRow';
import {
  DEFAULT_PLAYBACK_SETTINGS,
  loadPlaybackSettings,
  savePlaybackSettings,
} from '../../storage/playbackSettings';
import { resetAppData } from '../../storage/resetAppData';
import { loadSettings, saveSettings } from '../../storage/settings';
import { colors } from '../../theme/colors';
import { styles } from '../../theme/styles';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'> & {
  onAppReset: () => void;
};

const androidBuildNumber = 'versionCode' in android ? android.versionCode : 1;
const buildNumber = Platform.OS === 'ios' ? ios.buildNumber : androidBuildNumber;

export function SettingsScreen({ navigation, onAppReset }: SettingsScreenProps) {
  const [accessKey, setAccessKey] = React.useState('');
  const [tokenAuthKey, setTokenAuthKey] = React.useState('');
  const [libraryId, setLibraryId] = React.useState('');
  const [autoPlay, setAutoPlay] = React.useState(DEFAULT_PLAYBACK_SETTINGS.autoPlay);
  const [isResetting, setIsResetting] = React.useState(false);
  const pendingAction = React.useRef<'save' | 'reset' | null>(null);
  const playbackWrite = React.useRef(Promise.resolve());

  usePreventRemove(isResetting, () => {});

  React.useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      // Fall back to .env defaults when no stored value exists so the user
      // sees pre-filled fields instead of empty inputs.
      setAccessKey(stored?.accessKey ?? BUNNY_ACCESS_KEY ?? '');
      setTokenAuthKey(stored?.tokenAuthKey ?? BUNNY_TOKEN_AUTH_KEY ?? '');
      setLibraryId(String(stored?.libraryId ?? BUNNY_LIBRARY_ID ?? ''));
      const playback = await loadPlaybackSettings();
      setAutoPlay(playback.autoPlay);
    })();
  }, []);

  const handleSave = async () => {
    if (pendingAction.current) return;
    const libId = Number(libraryId);
    if (!Number.isInteger(libId) || libId <= 0) {
      Alert.alert('Invalid input', 'Please enter a positive integer Library ID.');
      return;
    }
    pendingAction.current = 'save';
    try {
      const normalizedAccessKey = accessKey.trim();
      initialize(normalizedAccessKey, libId);
      await saveSettings({
        accessKey: normalizedAccessKey,
        tokenAuthKey: tokenAuthKey.trim(),
        libraryId: String(libId),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'SDK initialization failed',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      pendingAction.current = null;
    }
  };

  const confirmReset = () => {
    if (pendingAction.current) return;
    Alert.alert(
      'Reset app data?',
      'This clears local settings, saved credentials, playback history, and upload progress on this device. Videos in your Bunny library will remain available.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (pendingAction.current) return;
            pendingAction.current = 'reset';
            setIsResetting(true);
            try {
              await playbackWrite.current;
              await resetAppData();
              onAppReset();
            } catch (error) {
              pendingAction.current = null;
              setIsResetting(false);
              Alert.alert(
                'Could not reset app data',
                error instanceof Error ? error.message : String(error),
              );
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Header title="Settings" onBack={isResetting ? undefined : () => navigation.goBack()} />
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Video Library ID</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your Library ID"
          value={libraryId}
          onChangeText={setLibraryId}
          keyboardType="numeric"
        />
        <Text style={styles.sectionTitle}>Video Library API Key (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional — leave empty for playback only"
          value={accessKey}
          onChangeText={setAccessKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.inputHint}>
          {accessKey.trim().length > 0
            ? 'Full access: playback, library management, uploads, and broadcasting.'
            : 'Playback-only mode: public videos and live streams play without a key. Library ' +
              'management, uploads, and broadcasting stay unavailable until a key is set.'}
        </Text>
        <Text style={styles.sectionTitle}>Token Authentication Key (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional — required for token-authenticated libraries"
          value={tokenAuthKey}
          onChangeText={setTokenAuthKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.inputHint}>
          {'The "Token authentication key" from the library Security page — a different value ' +
            'from the API key. Signs embed-view/playback tokens when embed view or CDN token ' +
            'authentication is enabled.'}
        </Text>
        <View style={styles.saveButtonContainer}>
          <Button title="Save" onPress={handleSave} color={colors.primary} disabled={isResetting} />
        </View>
        <Text style={styles.sectionTitle}>Playback</Text>
        <ToggleRow
          label="Auto-play videos"
          subtitle="Start VOD playback automatically when opening the player"
          value={autoPlay}
          onValueChange={(value) => {
            if (pendingAction.current === 'reset') return;
            setAutoPlay(value);
            playbackWrite.current = playbackWrite.current.then(() =>
              savePlaybackSettings({ autoPlay: value }),
            );
          }}
        />
        <OutlineButton
          danger
          label={isResetting ? 'Resetting app data…' : 'Reset app data'}
          disabled={isResetting}
          onPress={confirmReset}
          style={localStyles.resetButton}
          textStyle={localStyles.resetButtonText}
        />
        <Text selectable style={localStyles.version}>
          {`Version ${version} (build ${buildNumber})`}
        </Text>
      </ScrollView>
    </>
  );
}

const localStyles = StyleSheet.create({
  resetButton: { alignItems: 'center', marginTop: 16 },
  resetButtonText: { color: colors.error },
  version: {
    color: colors.onSurfaceVariant,
    fontSize: 13,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
});
