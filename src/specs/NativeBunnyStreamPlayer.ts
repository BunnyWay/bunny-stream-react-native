import type { TurboModule } from 'react-native';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';

import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  initialize(accessKey: string | null, libraryId: Double): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BunnyStreamPlayer');
