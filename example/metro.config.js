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
    // Force `react` and `react-native` to always resolve from the example
    // app's node_modules, never from the library's own node_modules. Without
    // this, two separate React instances coexist (library's 19.2.8 + app's
    // 19.2.3), causing "Invalid hook call / Cannot read property 'useRef' of
    // null" at runtime.
    resolveRequest: (context, moduleName, platform) => {
      if (
        moduleName === 'react' ||
        moduleName.startsWith('react/') ||
        moduleName === 'react-native' ||
        moduleName.startsWith('react-native/')
      ) {
        const resolved = context.resolveRequest(
          { ...context, originModulePath: __filename },
          moduleName,
          platform,
        );
        return resolved;
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
