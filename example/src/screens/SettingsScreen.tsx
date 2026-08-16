import * as React from 'react';
import { Button, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../components/Header';
import { styles } from '../theme/styles';

type SettingsScreenProps = {
  accessKey: string;
  libraryId: string;
  onAccessKeyChange: (value: string) => void;
  onLibraryIdChange: (value: string) => void;
  onSave: () => void;
  onBack: () => void;
};

export function SettingsScreen({
  accessKey,
  libraryId,
  onAccessKeyChange,
  onLibraryIdChange,
  onSave,
  onBack,
}: SettingsScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#FD8D32" />
      <Header title="Settings" onBack={onBack} />
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
          <Button title="Save" onPress={onSave} color="#FD8D32" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
