import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const example = new URL('../example/', import.meta.url);
const config = JSON.parse(readFileSync(new URL('firebase-distribution.json', example), 'utf8'));
const { values } = parseArgs({
  options: { build: { type: 'boolean', default: false }, apk: { type: 'string' } },
});
const appId = process.env.FIREBASE_APP_ID || config.appId;
const groups = process.env.FIREBASE_GROUPS ?? config.groups?.join(',');
const testers = process.env.FIREBASE_TESTERS ?? config.testers?.join(',');

if (typeof appId !== 'string' || !/^1:\d+:android:[a-f\d]+$/i.test(appId)) {
  console.error('Set appId in example/firebase-distribution.json or set FIREBASE_APP_ID.');
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: example, stdio: 'inherit' });
  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

if (values.build) run('npm', ['run', 'build:android:apk']);

const apk = values.apk
  ? resolve(values.apk)
  : fileURLToPath(new URL('android/app/build/outputs/apk/release/app-release.apk', example));
if (!existsSync(apk)) {
  console.error(
    `APK not found: ${apk}. Run yarn example build:android:firebase to build and upload.`,
  );
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(new URL('package.json', example), 'utf8'));
const args = [
  '--yes',
  '--package=firebase-tools@15.37.0',
  'firebase',
  'appdistribution:distribute',
  apk,
  '--app',
  appId,
  '--release-notes',
  process.env.FIREBASE_RELEASE_NOTES || `Bunny Stream React Native example ${version}`,
];
if (groups) args.push('--groups', groups);
if (testers) args.push('--testers', testers);
run('npx', args);
