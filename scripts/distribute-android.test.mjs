import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t) {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'bunny-firebase-')));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const example = path.join(directory, 'example');
  const bin = path.join(directory, 'bin');
  const script = path.join(directory, 'scripts/distribute-android.mjs');
  const apk = path.join(example, 'android/app/build/outputs/apk/release/app-release.apk');
  const calls = path.join(directory, 'calls.jsonl');
  mkdirSync(path.dirname(script), { recursive: true });
  mkdirSync(path.dirname(apk), { recursive: true });
  mkdirSync(bin);
  writeFileSync(calls, '');
  copyFileSync(new URL('./distribute-android.mjs', import.meta.url), script);
  const configure = (config) =>
    writeFileSync(path.join(example, 'firebase-distribution.json'), JSON.stringify(config));
  configure({ appId: '1:123456789:android:abcdef', groups: ['qa'], testers: [] });
  writeFileSync(path.join(example, 'package.json'), JSON.stringify({ version: '1.2.3' }));

  // Substitute the native builder and Firebase CLI: these tests never upload.
  for (const command of ['npm', 'npx']) {
    writeFileSync(
      path.join(bin, command),
      `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify({ command: '${command}', args: process.argv.slice(2), cwd: process.cwd() }) + '\\n');
const status = Number(process.env['TEST_${command.toUpperCase()}_STATUS'] || 0);
if ('${command}' === 'npm' && status === 0) fs.writeFileSync(process.env.TEST_APK, 'apk');
process.exit(status);
`,
      { mode: 0o755 },
    );
  }

  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` };
  for (const key of [
    'FIREBASE_APP_ID',
    'FIREBASE_GROUPS',
    'FIREBASE_TESTERS',
    'FIREBASE_RELEASE_NOTES',
  ]) {
    delete env[key];
  }
  return {
    apk,
    directory,
    configure,
    calls: () => readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),
    run: (args = [], overrides = {}) =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: directory,
        encoding: 'utf8',
        env: { ...env, TEST_APK: apk, TEST_CALLS: calls, ...overrides },
      }),
  };
}

test('builds before distributing and passes configuration as literal CLI arguments', (t) => {
  const { run, calls, apk } = fixture(t);
  const notes = 'Fix playback; $(do-not-execute) `literal`';
  const result = run(['--build'], {
    FIREBASE_APP_ID: '1:999:android:abc123',
    FIREBASE_GROUPS: 'qa,internal',
    FIREBASE_TESTERS: 'tester@example.com',
    FIREBASE_RELEASE_NOTES: notes,
  });
  assert.equal(result.status, 0, result.stderr);
  const [build, upload] = calls();
  assert.equal(build.command, 'npm');
  assert.deepEqual(build.args, ['run', 'build:android:apk']);
  assert.equal(upload.command, 'npx');
  assert.deepEqual(upload.args, [
    '--yes',
    '--package=firebase-tools@15.37.0',
    'firebase',
    'appdistribution:distribute',
    apk,
    '--app',
    '1:999:android:abc123',
    '--release-notes',
    notes,
    '--groups',
    'qa,internal',
    '--testers',
    'tester@example.com',
  ]);
  assert.equal(upload.cwd, build.cwd);
});

test('failed builds never upload an older APK', (t) => {
  const { run, calls, apk } = fixture(t);
  writeFileSync(apk, 'old apk');
  const result = run(['--build'], { TEST_NPM_STATUS: '7' });
  assert.equal(result.status, 7);
  assert.equal(calls().length, 1);
  assert.equal(calls()[0].command, 'npm');
});

test('configuration check needs no APK and never builds or uploads', (t) => {
  const { run, calls } = fixture(t);
  const result = run(['--check']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), []);
});

test('invalid app IDs stop before building and missing APKs stop before uploading', (t) => {
  const { run, calls, configure } = fixture(t);
  configure({ appId: '', groups: [], testers: [] });
  const invalid = run(['--build']);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /FIREBASE_APP_ID/);
  assert.deepEqual(calls(), []);
  const missing = run([], { FIREBASE_APP_ID: '1:999:android:abc123' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /APK not found/);
  assert.deepEqual(calls(), []);
});

test('retries an existing APK without building and propagates Firebase failures', (t) => {
  const { run, calls, configure, directory } = fixture(t);
  const apk = path.join(directory, 'custom build.apk');
  configure({ appId: '1:123456789:android:abcdef' });
  writeFileSync(apk, 'apk');
  const result = run(['--apk', path.relative(directory, apk)], {
    TEST_NPX_STATUS: '9',
  });
  assert.equal(result.status, 9, result.stderr);
  assert.equal(calls().length, 1);
  assert.equal(calls()[0].command, 'npx');
  assert.ok(calls()[0].args.includes(apk));
  assert.ok(!calls()[0].args.includes('--groups'));
  assert.ok(!calls()[0].args.includes('--testers'));
  assert.ok(calls()[0].args.includes('Bunny Stream React Native example 1.2.3'));
});
