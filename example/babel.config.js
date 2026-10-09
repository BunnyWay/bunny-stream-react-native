const path = require('path');
const { getConfig } = require('react-native-builder-bob/babel-config');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');

const embedSecrets = process.env.BUNNY_EMBED_SECRETS !== 'false';

if (!embedSecrets) {
  delete process.env.BUNNY_ACCESS_KEY;
  delete process.env.BUNNY_LIBRARY_ID;
  delete process.env.BUNNY_VIDEO_IDS;
  delete process.env.BUNNY_VIDEO_ID;
}

module.exports = getConfig(
  {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: embedSecrets ? '.env' : '.env.release',
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  },
  { root, pkg },
);
