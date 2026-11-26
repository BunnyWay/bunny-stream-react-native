import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
let directory;
let packageDirectory;
let version;

before(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'bunny-package-'));
  execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', directory], {
    cwd: root,
    stdio: 'pipe',
  });
  // Some npm versions run prepare despite --ignore-scripts and mix build logs into stdout.
  // Locate the artifact directly instead of parsing npm's output.
  const archives = readdirSync(directory).filter((filename) => filename.endsWith('.tgz'));
  assert.equal(archives.length, 1, 'npm pack must create exactly one package archive');
  execFileSync('tar', ['-xzf', path.join(directory, archives[0]), '-C', directory]);
  packageDirectory = path.join(directory, 'package');
  ({ version } = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')));
});

after(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

for (const format of ['module', 'commonjs']) {
  test(`packed ${format} initialization resolves dependencies and sends the package version`, async () => {
    const outputDirectory = path.join(packageDirectory, 'lib', format);
    const nativePath = path.join(outputDirectory, 'specs', 'NativeBunnyStreamPlayer.js');
    // Only the native boundary is replaced. Load every JS dependency from the tarball.
    assert.ok(readFileSync(nativePath, 'utf8'), 'The native spec must be packaged');
    const nativeStub = `const calls = [];
const player = { calls, initialize: (...args) => calls.push(args) };
`;
    writeFileSync(
      nativePath,
      nativeStub +
        (format === 'module' ? 'export default player;\n' : 'module.exports = player;\n'),
    );

    const load = async (file) =>
      format === 'module' ? import(pathToFileURL(file).href) : require(file);
    const configuration = await load(path.join(outputDirectory, 'config', 'initialize.js'));
    const nativeModule = await load(nativePath);
    const player = format === 'module' ? nativeModule.default : nativeModule;

    assert.equal(configuration.getConfiguredLibraryId(), undefined);
    configuration.initialize('test-access-key', 123);
    configuration.initialize('', 456);
    assert.deepEqual(player.calls, [
      ['test-access-key', 123, version],
      ['', 456, version],
    ]);
    assert.equal(configuration.getConfiguredLibraryId(), 456);
  });
}
