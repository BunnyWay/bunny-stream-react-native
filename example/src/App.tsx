import type { RootStackParamList } from './navigation/types';

import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID } from '@env';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { initialize } from 'bunny-stream-react-native';

import { ScreenWrapper } from './components/ScreenWrapper';
import { HomeScreen } from './screens/HomeScreen';
import { LivePlayerScreen } from './screens/LivePlayerScreen';
import { LiveStreamsScreen } from './screens/LiveStreamsScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { VideoListScreen } from './screens/VideoListScreen';
import { loadSettings } from './storage/storage';
import { styles } from './theme/styles';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="VideoList" component={VideoListScreen} />
              <Stack.Screen name="LiveStreams" component={LiveStreamsScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Player" component={PlayerScreen} />
              <Stack.Screen name="LivePlayer" component={LivePlayerScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </ScreenWrapper>
    </SafeAreaProvider>
  );
}
