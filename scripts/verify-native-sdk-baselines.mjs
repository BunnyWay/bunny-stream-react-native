import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselines = JSON.parse(await readFile(path.join(root, 'native-sdk-baselines.json'), 'utf8'));

if (baselines.schemaVersion !== 1) {
  throw new Error('Invalid native SDK baseline schema');
}

const sdkPaths = {
  android:
    process.env.BUNNY_STREAM_ANDROID_SDK_PATH ??
    path.resolve(root, baselines.android.defaultLocalPath),
  ios: process.env.BUNNY_STREAM_IOS_SDK_PATH ?? path.resolve(root, baselines.ios.defaultLocalPath),
};

const git = (repositoryPath, ...args) =>
  execFileSync('git', ['-C', repositoryPath, ...args], { encoding: 'utf8' }).trim();
const requestedPlatforms = process.argv.slice(2);
const platforms = requestedPlatforms.length > 0 ? requestedPlatforms : ['android', 'ios'];

for (const platform of platforms) {
  if (!(platform in sdkPaths)) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  const baseline = baselines[platform];
  const repositoryPath = sdkPaths[platform];
  const commit = git(repositoryPath, 'rev-parse', 'HEAD');
  const changes = git(repositoryPath, 'status', '--porcelain');

  if (commit !== baseline.commit) {
    throw new Error(
      `${platform} SDK must be at ${baseline.commit}, found ${commit} in ${repositoryPath}`,
    );
  }
  if (changes) {
    throw new Error(`${platform} SDK working tree must be clean: ${repositoryPath}`);
  }

  console.log(`${platform}: ${baseline.repository}@${commit}`);
}
