const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The library exposes a "bunny-stream-react-native-source" export condition
// pointing at src/, so the example runs the TypeScript sources directly —
// no `bob build` needed during development.
config.resolver.unstable_conditionNames = [
  'bunny-stream-react-native-source',
  ...(config.resolver.unstable_conditionNames ?? []),
];

module.exports = config;
