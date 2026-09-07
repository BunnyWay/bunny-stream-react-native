import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselines = JSON.parse(await readFile(path.join(root, 'native-sdk-baselines.json'), 'utf8'));
const sdkPath =
  process.env.BUNNY_STREAM_ANDROID_SDK_PATH ??
  path.resolve(root, baselines.android.defaultLocalPath);

execFileSync('node', [path.join(root, 'scripts', 'verify-native-sdk-baselines.mjs'), 'android'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
execFileSync(
  path.join(sdkPath, 'gradlew'),
  [
    ':api:publishToMavenLocal',
    ':player:publishToMavenLocal',
    `-Pversion=${baselines.android.mavenVersion}`,
  ],
  { cwd: sdkPath, stdio: 'inherit' },
);
