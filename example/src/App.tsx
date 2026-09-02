import type { RootStackParamList } from './navigation/types';

import { BUNNY_ACCESS_KEY, BUNNY_LIBRARY_ID } from '@env';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { initialize } from 'bunny-stream-react-native';

import { ScreenWrapper } from './components/ScreenWrapper';
import { CustomControlsPlayerScreen } from './screens/CustomControlsPlayerScreen';
import { HomeScreen } from './screens/HomeScreen';
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
      if (!isNaN(libIdNum)) {
        initialize(resolvedAccessKey || null, libIdNum);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <ScreenWrapper style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FD8D32" />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.container}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="VideoList" component={VideoListScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Player" component={PlayerScreen} />
          <Stack.Screen name="PlayerCustom" component={CustomControlsPlayerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ScreenWrapper>
  );
}
