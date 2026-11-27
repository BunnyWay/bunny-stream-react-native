import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetLocalSdkState } from '../../../src/config/initialize';
import { resetUploadScreenState } from '../features/upload/VideoUploadScreen';

export async function resetAppData(): Promise<void> {
  resetUploadScreenState();
  await resetLocalSdkState();
  await AsyncStorage.clear();
}
