const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [path.resolve(__dirname, '..')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // Resolve `react` and `react-native` (and their deep imports) from the
    // example app's node_modules. The library is a watchFolder, so Metro
    // would otherwise find the peer-dep copies npm auto-installed under the
    // library's own node_modules, creating two React instances at runtime.
    // This is the standard pattern used by RN libraries with an example app.
    resolveRequest: (context, moduleName, platform) => {
      if (
        moduleName === 'react' ||
        moduleName.startsWith('react/') ||
        moduleName === 'react-native' ||
        moduleName.startsWith('react-native/')
      ) {
        return context.resolveRequest(
          { ...context, originModulePath: __filename },
          moduleName,
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
