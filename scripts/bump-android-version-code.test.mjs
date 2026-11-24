import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t, content) {
  const directory = mkdtempSync(path.join(tmpdir(), 'bunny-android-version-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, 'scripts'));
  mkdirSync(path.join(directory, 'example'));
  const script = path.join(directory, 'scripts/bump-android-version-code.mjs');
  const manifest = path.join(directory, 'example/app.json');
  copyFileSync(new URL('./bump-android-version-code.mjs', import.meta.url), script);
  writeFileSync(manifest, content);
  return {
    run: () => spawnSync(process.execPath, [script], { encoding: 'utf8' }),
    read: () => readFileSync(manifest, 'utf8'),
  };
}

test('increments versionCode without changing other values or formatting', (t) => {
  const content =
    '{\n  "version": "1.1.1",\n  "ios": { "buildNumber": "3" },\n  "android": { "package": "net.bunny.demo", "versionCode": 9 }\n}\n';
  const { run, read } = fixture(t, content);
  for (const next of [10, 11]) {
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read(), content.replace('"versionCode": 9', `"versionCode": ${next}`));
  }
});

test('starts above the react-native-test-app default versionCode when omitted', (t) => {
  const original = { version: '1.1.1', android: { package: 'net.bunny.demo' } };
  const { run, read } = fixture(t, JSON.stringify(original));
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(read()), {
    ...original,
    android: { ...original.android, versionCode: 2 },
  });
});

test('invalid or exhausted version codes fail without modifying the manifest', (t) => {
  for (const versionCode of ['1', 0, -1, 1.5, 2100000000]) {
    const content = JSON.stringify({ android: { versionCode } });
    const { run, read } = fixture(t, content);
    assert.notEqual(run().status, 0);
    assert.equal(read(), content);
  }
});
