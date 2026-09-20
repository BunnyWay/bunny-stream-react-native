import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID } from '@env';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { initialize } from 'bunny-stream-react-native';

import { ScreenWrapper } from './components/ScreenWrapper';
import { RootNavigator } from './navigation/RootNavigator';
import { loadSettings } from './storage/settings';
import { styles } from './theme/styles';

export default function App() {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      const resolvedAccessKey = stored?.accessKey ?? BUNNY_ACCESS_KEY ?? '';
      const resolvedLibraryId = stored?.libraryId ?? BUNNY_LIBRARY_ID ?? '';
      const libIdNum = parseInt(resolvedLibraryId, 10);
      // SDK 4.0.0 requires a non-empty access key. Skip initialization when
      // none is configured rather than throwing — the user can set it in
      // Settings, and the player screens surface a clear message.
      if (!isNaN(libIdNum) && resolvedAccessKey.trim().length > 0) {
        initialize(resolvedAccessKey, libIdNum);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ScreenWrapper style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FD8D32" />
          </View>
        ) : (
          <RootNavigator />
        )}
      </ScreenWrapper>
    </SafeAreaProvider>
  );
}
