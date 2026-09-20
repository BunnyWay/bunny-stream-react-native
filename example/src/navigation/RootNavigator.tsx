import type { RootStackParamList } from './types';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';

import { HomeScreen } from '../features/home/HomeScreen';
import { LivePlayerScreen } from '../features/live/LivePlayerScreen';
import { LiveStreamsScreen } from '../features/live/LiveStreamsScreen';
import { ThumbnailPickerScreen } from '../features/live/ThumbnailPickerScreen';
import { TrailerPickerScreen } from '../features/live/TrailerPickerScreen';
import { PlayerScreen } from '../features/playback/PlayerScreen';
import { VideoListScreen } from '../features/playback/VideoListScreen';
import { VideoManagementScreen } from '../features/playback/VideoManagementScreen';
import { ResumePositionsScreen } from '../features/resume/ResumePositionsScreen';
import { ResumeSettingsScreen } from '../features/resume/ResumeSettingsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { CameraScreen } from '../features/upload/CameraScreen';
import { VideoUploadScreen } from '../features/upload/VideoUploadScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Route table — every screen the demo exposes, grouped by the feature
 * folders under `src/features/`. `RootStackParamList` in `types.ts`
 * describes the params each route accepts.
 */
export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="VideoList" component={VideoListScreen} />
        <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
        <Stack.Screen name="LiveStreams" component={LiveStreamsScreen} />
        <Stack.Screen name="TrailerPicker" component={TrailerPickerScreen} />
        <Stack.Screen name="ThumbnailPicker" component={ThumbnailPickerScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        <Stack.Screen name="LivePlayer" component={LivePlayerScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
        <Stack.Screen name="VideoManagement" component={VideoManagementScreen} />
        <Stack.Screen name="ResumePositions" component={ResumePositionsScreen} />
        <Stack.Screen name="ResumeSettings" component={ResumeSettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
