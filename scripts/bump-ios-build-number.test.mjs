import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t, content) {
  const directory = mkdtempSync(path.join(tmpdir(), 'bunny-ios-build-number-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, 'scripts'));
  mkdirSync(path.join(directory, 'example'));
  const script = path.join(directory, 'scripts/bump-ios-build-number.mjs');
  copyFileSync(new URL('./bump-ios-build-number.mjs', import.meta.url), script);
  const manifest = path.join(directory, 'example/app.json');
  writeFileSync(manifest, content);
  return {
    run: () => spawnSync(process.execPath, [script], { encoding: 'utf8' }),
    read: () => readFileSync(manifest, 'utf8'),
  };
}

test('successive IPA preparations increment the build number and preserve other settings', (t) => {
  const content =
    '{\n  "version": "1.1.1",\n  "ios": { "bundleIdentifier": "net.bunny.demo", "buildNumber": "9" },\n  "android": { "versionCode": 5 }\n}\n';
  const { run, read } = fixture(t, content);
  for (const next of ['10', '11']) {
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read(), content.replace('"9"', `"${next}"`));
  }
});

test('invalid or missing build numbers fail without modifying the manifest', (t) => {
  for (const buildNumber of [undefined, 1, '', '-1', '1.2.3', 'abc', '9007199254740991']) {
    const content = JSON.stringify({ version: '1.1.1', ios: { buildNumber } });
    const { run, read } = fixture(t, content);
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected ios.buildNumber/);
    assert.equal(read(), content);
  }
});
