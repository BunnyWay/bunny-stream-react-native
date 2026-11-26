import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'bunny-publish-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'scripts'));
  const script = path.join(root, 'scripts/publish.mjs');
  const preload = path.join(root, 'mock-npm.mjs');
  const calls = path.join(root, 'calls');
  copyFileSync(new URL('./publish.mjs', import.meta.url), script);
  writeFileSync(calls, '');
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: '@bunny.net/stream-react-native',
      version: '1.1.2',
      publishConfig: { registry: 'https://registry.npmjs.org/' },
    }),
  );
  writeFileSync(
    path.join(root, 'yarn'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const [command, ...args] = process.argv.slice(2);
fs.appendFileSync('calls', [command, ...args].join(' ') + '\\n');
if (command === process.env.TEST_FAIL) process.exit(7);
if (command === 'release' && !args.includes('--dry-run')) {
  const manifest = require('./package.json');
  manifest.version = '1.1.3';
  fs.writeFileSync('package.json', JSON.stringify(manifest));
}
`,
    { mode: 0o755 },
  );
  writeFileSync(
    preload,
    `import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import timers from 'node:timers/promises';
Object.defineProperty(process, 'platform', { value: 'darwin' });
timers.setTimeout = async () => {};
syncBuiltinESMExports();
let attempts = 0;
globalThis.fetch = async (url) => {
  appendFileSync('calls', url.href + '\\n');
  if (process.env.TEST_FAIL === 'registry') return new Response(null, { status: 403 });
  if (++attempts === 1) return new Response(null, { status: 404 });
  return Response.json({ version: '1.1.3' });
};
`,
  );
  return {
    calls: () => readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean),
    run: (args, fail = '', npmCommand = '') =>
      spawnSync(process.execPath, ['--import', preload, script, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${root}${path.delimiter}${process.env.PATH}`,
          TEST_FAIL: fail,
          npm_command: npmCommand,
        },
        timeout: 5000,
      }),
  };
}

const registryUrl = 'https://registry.npmjs.org/%40bunny.net%2Fstream-react-native/1.1.3';

test('distributes the examples after the exact new version appears on npm', (t) => {
  const { run, calls } = fixture(t);
  const result = run(['patch']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), [
    'example:distribution:check',
    'release patch',
    registryUrl,
    registryUrl,
    'example:distribute',
  ]);
});

test('dry run only previews the library release', (t) => {
  const { run, calls } = fixture(t);
  assert.equal(run(['patch', '--dry-run']).status, 0);
  assert.deepEqual(calls(), ['release patch --dry-run']);
});

test('npm publish lifecycle never starts a second release', (t) => {
  const { run, calls } = fixture(t);
  assert.equal(run([], '', 'publish').status, 0);
  assert.deepEqual(calls(), []);
});

test('failed distribution preflight stops the library release', (t) => {
  const { run, calls } = fixture(t);
  assert.equal(run([], 'example:distribution:check').status, 7);
  assert.deepEqual(calls(), ['example:distribution:check']);
});

test('failed library release never distributes the examples', (t) => {
  const { run, calls } = fixture(t);
  assert.equal(run([], 'release').status, 7);
  assert.deepEqual(calls(), ['example:distribution:check', 'release']);
});

test('registry errors stop example distribution', (t) => {
  const { run, calls } = fixture(t);
  const result = run([], 'registry');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HTTP 403/);
  assert.deepEqual(calls(), ['example:distribution:check', 'release', registryUrl]);
});
