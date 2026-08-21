import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { Alert, Button, ScrollView, Text, TextInput, View } from 'react-native';

import { initialize } from 'bunny-stream-react-native';

import { Header } from '../components/Header';
import { loadSettings, saveSettings } from '../storage/storage';
import { styles } from '../theme/styles';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [accessKey, setAccessKey] = React.useState('');
  const [libraryId, setLibraryId] = React.useState('');

  React.useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      if (stored) {
        setAccessKey(stored.accessKey ?? '');
        setLibraryId(stored.libraryId ?? '');
      }
    })();
  }, []);

  const handleSave = async () => {
    const libId = parseInt(libraryId, 10);
    if (!libraryId || isNaN(libId)) {
      Alert.alert('Invalid input', 'Please enter a valid numeric Library ID.');
      return;
    }
    if (!accessKey.trim()) {
      Alert.alert('Invalid input', 'Please enter a non-empty Access Key (SDK 4.0.0 requirement).');
      return;
    }
    initialize(accessKey, libId);
    await saveSettings({ accessKey, libraryId });
    navigation.goBack();
  };

  return (
    <>
      <Header title="Settings" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Video Library ID</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your Library ID"
          value={libraryId}
          onChangeText={setLibraryId}
          keyboardType="numeric"
        />
        <Text style={styles.sectionTitle}>Video Library API Key</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your Library API Key"
          value={accessKey}
          onChangeText={setAccessKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <View style={styles.saveButtonContainer}>
          <Button title="Save" onPress={handleSave} color="#FD8D32" />
        </View>
      </ScrollView>
    </>
  );
}
