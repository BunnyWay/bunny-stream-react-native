import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselines = JSON.parse(await readFile(path.join(root, 'native-sdk-baselines.json'), 'utf8'));
const sdkPath =
  process.env.BUNNY_STREAM_ANDROID_SDK_PATH ??
  path.resolve(root, baselines.android.defaultLocalPath);
const version = baselines.android.mavenVersion;

execFileSync('node', [path.join(root, 'scripts', 'verify-native-sdk-baselines.mjs'), 'android'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

// The SDK's publishToMavenLocal always signs publications, which needs GPG
// keys that local development does not have. Stage the Maven artifacts by
// hand instead: release AAR + generated POM + Gradle module metadata for each
// published module. The bridge registers mavenLocal() last, so these are only
// ever used for versions that do not exist on Maven Central.
const modules = [
  ['api', 'bunny-stream-api'],
  ['player', 'bunny-stream-player'],
  ['recording', 'bunny-stream-camera-upload'],
];

execFileSync(
  path.join(sdkPath, 'gradlew'),
  [
    ...modules.flatMap(([project]) => [
      `:${project}:bundleReleaseAar`,
      `:${project}:generatePomFileForMavenPublication`,
      `:${project}:generateMetadataFileForMavenPublication`,
    ]),
    `-Pversion=${version}`,
  ],
  { cwd: sdkPath, stdio: 'inherit' },
);

for (const [project, dir] of modules) {
  const buildDir = path.join(sdkPath, dir, 'build');
  const dest = path.join(homedir(), '.m2', 'repository', 'net', 'bunny', project, version);
  mkdirSync(dest, { recursive: true });
  copyFileSync(
    path.join(buildDir, 'outputs', 'aar', `${project}-release.aar`),
    path.join(dest, `${project}-${version}.aar`),
  );
  copyFileSync(
    path.join(buildDir, 'publications', 'maven', 'pom-default.xml'),
    path.join(dest, `${project}-${version}.pom`),
  );
  copyFileSync(
    path.join(buildDir, 'publications', 'maven', 'module.json'),
    path.join(dest, `${project}-${version}.module`),
  );
  console.log(`net.bunny:${project}:${version} -> ${dest}`);
}
