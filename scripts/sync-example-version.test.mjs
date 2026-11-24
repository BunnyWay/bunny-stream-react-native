import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t, version) {
  const directory = mkdtempSync(path.join(tmpdir(), 'bunny-example-version-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, 'scripts'));
  mkdirSync(path.join(directory, 'example'));
  const script = path.join(directory, 'scripts/sync-example-version.mjs');
  copyFileSync(new URL('./sync-example-version.mjs', import.meta.url), script);
  const write = (file, content) => writeFileSync(path.join(directory, file), content);
  const read = (file) => readFileSync(path.join(directory, file), 'utf8');
  write('package.json', JSON.stringify({ version }));
  write('example/package.json', '{\n  "version": "1.0.0",\n  "private": true\n}\n');
  write(
    'example/app.json',
    '{\n  "version": "1.0.0",\n  "ios": { "buildNumber": "42" },\n  "android": { "versionCode": 17 }\n}\n',
  );
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { read, run, write };
}

test('synchronizes stable versions while preserving formatting and custom settings', (t) => {
  const { read, run } = fixture(t, '1.2.3');
  const originalPackage = read('example/package.json');
  const originalApp = read('example/app.json');
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read('example/package.json'), originalPackage.replace('1.0.0', '1.2.3'));
  assert.equal(read('example/app.json'), originalApp.replace('1.0.0', '1.2.3'));
  assert.equal(run('--check').status, 0);
  assert.equal(run().status, 0);
  assert.equal(read('example/app.json'), originalApp.replace('1.0.0', '1.2.3'));
});

test('native app versions omit prerelease identifiers and build metadata', (t) => {
  const { read, run, write } = fixture(t, '1.2.0-rc.1+build.5');
  for (const version of ['1.2.0-rc.1+build.5', '1.2.0+build.5', '1.2.0']) {
    write('package.json', JSON.stringify({ version }));
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(read('example/package.json')).version, version);
    assert.equal(JSON.parse(read('example/app.json')).version, '1.2.0');
    assert.equal(run('--check').status, 0);
  }
});

test('check detects either stale manifest without modifying any files', (t) => {
  const { read, run, write } = fixture(t, '1.2.3');
  assert.equal(run().status, 0);
  for (const file of ['example/package.json', 'example/app.json']) {
    const current = read(file);
    const stale = current.replace('1.2.3', '1.0.0');
    write(file, stale);
    const result = run('--check');
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(file), result.stderr);
    assert.equal(read(file), stale);
    write(file, current);
  }
});
