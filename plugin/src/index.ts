import type { BunnyStreamPluginProps } from './types';
import type { ConfigPlugin } from '@expo/config-plugins';

import {
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
  withInfoPlist,
  withXcodeProject,
} from '@expo/config-plugins';

import {
  applyBunnyStreamAndroidManifest,
  applyBunnyStreamGradleProperties,
  ensureCoreLibraryDesugaring,
} from './android';
import { applyBunnyStreamInfoPlist, ensureEmbedSwiftPmFrameworksPhase } from './ios';
import { withSpmUuidFix } from './spm';
import { resolvePluginProps } from './types';

const withBunnyStream: ConfigPlugin<BunnyStreamPluginProps | void> = (config, props) => {
  const resolved = resolvePluginProps(props ?? {});

  config = withAndroidManifest(config, (c) => {
    c.modResults = applyBunnyStreamAndroidManifest(c.modResults, resolved);
    return c;
  });
  config = withAppBuildGradle(config, (c) => {
    c.modResults.contents = ensureCoreLibraryDesugaring(
      c.modResults.contents,
      resolved.desugarJdkLibsVersion,
    );
    return c;
  });
  config = withGradleProperties(config, (c) => {
    c.modResults = applyBunnyStreamGradleProperties(c.modResults);
    return c;
  });
  config = withInfoPlist(config, (c) => {
    applyBunnyStreamInfoPlist(c.modResults, resolved);
    return c;
  });
  config = withXcodeProject(config, (c) => {
    ensureEmbedSwiftPmFrameworksPhase(c.modResults);
    return c;
  });
  config = withSpmUuidFix(config);

  return config;
};

export default withBunnyStream;
export type { BunnyStreamPluginProps } from './types';
