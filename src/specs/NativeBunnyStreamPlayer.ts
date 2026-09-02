import type { TurboModule } from 'react-native';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';

import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // SDK 4.0.0 requires a non-null access key (BunnyStreamApi.initialize no
  // longer accepts null). The public `initialize` wrapper validates and rejects
  // empty strings before calling native, so the bridge never receives null.
  initialize(accessKey: string, libraryId: Double): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BunnyStreamPlayer');
