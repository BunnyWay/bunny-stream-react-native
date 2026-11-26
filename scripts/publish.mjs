import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const root = new URL('../', import.meta.url);
const manifest = new URL('package.json', root);
const readPackage = () => JSON.parse(readFileSync(manifest, 'utf8'));

function yarn(...args) {
  const result = spawnSync('yarn', args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function waitForNpm({ name, version, publishConfig }) {
  const registry = new URL(publishConfig.registry);
  const url = new URL(`${encodeURIComponent(name)}/${encodeURIComponent(version)}`, registry);
  const deadline = Date.now() + 30 * 60 * 1000;
  console.log(
    `Waiting for ${name}@${version} on npm. The v${version} tag triggers Publish to npm.`,
  );

  while (Date.now() < deadline) {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (response?.ok && (await response.json()).version === version) return;
    if (response && response.status < 500 && ![404, 429].includes(response.status)) {
      throw new Error(`npm registry returned HTTP ${response.status} for ${name}@${version}.`);
    }
    await setTimeout(15_000);
  }

  throw new Error(
    `Timed out waiting for ${name}@${version}. Check Publish to npm in GitHub Actions.`,
  );
}

async function main() {
  // npm also runs a package's publish script as a lifecycle hook.
  if (process.env.npm_command === 'publish') return;

  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', short: 'd' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log('Usage: yarn publish [<version> | patch | minor | major] [--dry-run]');
    return;
  }
  if (positionals.length > 1 || positionals[0]?.startsWith('-')) {
    throw new Error('Pass a single version or version increment.');
  }
  if (values['dry-run']) {
    yarn('release', ...positionals, '--dry-run');
    return;
  }
  if (process.platform !== 'darwin') throw new Error('Publishing the iOS example requires macOS.');

  yarn('example:distribution:check');
  const previousVersion = readPackage().version;
  yarn('release', ...positionals);
  const publishedPackage = readPackage();
  if (publishedPackage.version === previousVersion) return;

  await waitForNpm(publishedPackage);
  if (readPackage().version !== publishedPackage.version) {
    throw new Error(
      `The checkout changed while waiting for npm. Check out v${publishedPackage.version} and run yarn example:distribute.`,
    );
  }
  console.log(
    `Published ${publishedPackage.name}@${publishedPackage.version}. Distributing the examples.`,
  );
  yarn('example:distribute');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
