import type { Screen } from '../navigation/types';

import * as React from 'react';
import { ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../components/Header';
import { HomeOption } from '../components/HomeOption';
import { styles } from '../theme/styles';

type HomeScreenProps = {
  onNavigate: (screen: Screen) => void;
  onDirectPlay: () => void;
  onDirectPlayCustom: () => void;
  hasConfig: boolean;
};

export function HomeScreen({
  onNavigate,
  onDirectPlay,
  onDirectPlayCustom,
  hasConfig,
}: HomeScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#FD8D32" />
      <Header title="BunnyStream Demo" subtitle="React Native" />
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.card}>
          <HomeOption
            title="Video player"
            subtitle="Saved video IDs"
            onPress={() => onNavigate('videoList')}
          />
          <View style={styles.divider} />
          <HomeOption title="Video Upload" badge="Coming soon" disabled onPress={() => {}} />
          <View style={styles.divider} />
          <HomeOption title="Camera upload" badge="Coming soon" disabled onPress={() => {}} />
          <View style={styles.divider} />
          <HomeOption title="Direct video play" subtitle="Native controls" onPress={onDirectPlay} />
          <View style={styles.divider} />
          <HomeOption
            title="Direct video play (custom)"
            subtitle="JS controls only"
            onPress={onDirectPlayCustom}
          />
        </View>

        <Text style={styles.sectionTitle}>Resume Positions</Text>
        <View style={styles.card}>
          <HomeOption
            title="Resume Position Settings"
            badge="Coming soon"
            disabled
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <HomeOption
            title="Manage Resume Positions"
            badge="Coming soon"
            disabled
            onPress={() => {}}
          />
        </View>

        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.card}>
          <HomeOption
            title="BunnyStream Configuration"
            subtitle={hasConfig ? 'Configured' : 'Not configured'}
            onPress={() => onNavigate('settings')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
