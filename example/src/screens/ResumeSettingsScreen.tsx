import type { RootStackParamList } from '../navigation/types';
import type { ResumeSettings } from '../storage/resumeSettings';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as React from 'react';
import { Alert, Button, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Header } from '../components/Header';
import {
  DEFAULT_RESUME_SETTINGS,
  loadResumeSettings,
  saveResumeSettings,
} from '../storage/resumeSettings';
import { colors } from '../theme/colors';
import { styles } from '../theme/styles';

type ResumeSettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'ResumeSettings'>;

/**
 * Resume-position settings — mirrors the Android demo's
 * ResumePositionSettingsScreen, but persisted to AsyncStorage and applied by
 * the player screens (`resumeConfig` on Android, `useResumePosition` on iOS).
 */
export function ResumeSettingsScreen({ navigation }: ResumeSettingsScreenProps) {
  const [settings, setSettings] = React.useState<ResumeSettings>(DEFAULT_RESUME_SETTINGS);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    void loadResumeSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const update = (patch: Partial<ResumeSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (settings.retentionDays < 0) {
      Alert.alert('Invalid input', 'Retention days must be 0 or greater.');
      return;
    }
    if (settings.minimumWatchSec < 0) {
      Alert.alert('Invalid input', 'Minimum watch time must be 0 or greater.');
      return;
    }
    if (
      settings.resumeThresholdPct < 0 ||
      settings.resumeThresholdPct >= settings.nearEndThresholdPct ||
      settings.nearEndThresholdPct > 100
    ) {
      Alert.alert(
        'Invalid input',
        'Resume threshold must be >= 0 and smaller than the near-end threshold (<= 100).',
      );
      return;
    }
    await saveResumeSettings(settings);
    navigation.goBack();
  };

  const parseNum = (text: string, fallback: number) => {
    const n = parseFloat(text);
    return isNaN(n) ? fallback : n;
  };

  if (!loaded) return null;

  return (
    <>
      <Header title="Resume Settings" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content}>
        <View style={localStyles.switchRow}>
          <Text style={localStyles.switchLabel}>Resume playback</Text>
          <Switch
            value={settings.enabled}
            onValueChange={(enabled) => update({ enabled })}
            trackColor={{ true: colors.primary }}
          />
        </View>
        <Text style={localStyles.hint}>
          When enabled, the player saves your position and offers to continue where you left off.
          Android uses the native SDK; iOS uses the JS fallback with AsyncStorage.
        </Text>

        <Text style={styles.sectionTitle}>Retention (days)</Text>
        <TextInput
          style={styles.input}
          value={String(settings.retentionDays)}
          onChangeText={(t) => update({ retentionDays: parseNum(t, settings.retentionDays) })}
          keyboardType="numeric"
        />

        <Text style={styles.sectionTitle}>Minimum watch time (seconds)</Text>
        <TextInput
          style={styles.input}
          value={String(settings.minimumWatchSec)}
          onChangeText={(t) => update({ minimumWatchSec: parseNum(t, settings.minimumWatchSec) })}
          keyboardType="numeric"
        />

        <Text style={styles.sectionTitle}>Resume threshold (%)</Text>
        <TextInput
          style={styles.input}
          value={String(settings.resumeThresholdPct)}
          onChangeText={(t) =>
            update({ resumeThresholdPct: parseNum(t, settings.resumeThresholdPct) })
          }
          keyboardType="numeric"
        />
        <Text style={localStyles.hint}>
          Positions below this watched percentage are not offered for resume.
        </Text>

        <Text style={styles.sectionTitle}>Near-end threshold (%)</Text>
        <TextInput
          style={styles.input}
          value={String(settings.nearEndThresholdPct)}
          onChangeText={(t) =>
            update({ nearEndThresholdPct: parseNum(t, settings.nearEndThresholdPct) })
          }
          keyboardType="numeric"
        />
        <Text style={localStyles.hint}>
          Positions at or above this percentage are treated as finished.
        </Text>

        <View style={styles.saveButtonContainer}>
          <Button title="Save" onPress={handleSave} color="#FD8D32" />
        </View>
      </ScrollView>
    </>
  );
}

const localStyles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: colors.onSurface,
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    paddingHorizontal: 16,
    paddingBottom: 8,
    lineHeight: 18,
  },
});
