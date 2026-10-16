import * as React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { initialize } from '@bunny.net/stream-react-native';

import { ScreenWrapper } from './components/ScreenWrapper';
import { RootNavigator } from './navigation/RootNavigator';
import { loadLibraryConfig } from './storage/settings';
import { colors } from './theme/colors';
import { styles } from './theme/styles';

export default function App() {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const { accessKey, libraryId } = await loadLibraryConfig();
        // An empty access key is valid — it selects playback-only mode
        // (public videos need no credentials). Skip initialization only when
        // no library ID is configured.
        if (libraryId != null) {
          initialize(accessKey, libraryId);
        }
      } catch (error) {
        Alert.alert(
          'SDK initialization failed',
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ScreenWrapper style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <RootNavigator />
        )}
      </ScreenWrapper>
    </SafeAreaProvider>
  );
}
