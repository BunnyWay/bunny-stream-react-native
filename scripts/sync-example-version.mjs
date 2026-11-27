import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
// iOS requires the native app version to contain only major.minor.patch.
const nativeVersion = version.split(/[-+]/)[0];

for (const [file, expected] of [
  ['example/package.json', version],
  ['example/app.json', nativeVersion],
]) {
  const target = new URL(file, root);
  const content = readFileSync(target, 'utf8');
  if (JSON.parse(content).version === expected) continue;

  if (process.argv.includes('--check')) {
    console.error(`${file} version is out of date. Run yarn example:version:sync.`);
    process.exitCode = 1;
  } else {
    // Update only the version field, preserving the rest of each manifest.
    writeFileSync(
      target,
      content.replace(/^(\s*"version"\s*:\s*)"[^"]*"/m, `$1${JSON.stringify(expected)}`),
    );
  }
}
