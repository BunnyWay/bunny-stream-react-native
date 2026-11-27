import { readFileSync, writeFileSync } from 'node:fs';

const target = new URL('../example/app.json', import.meta.url);
const content = readFileSync(target, 'utf8');
const android = JSON.parse(content).android;
const current = android?.versionCode ?? 1;
if (!android || !Number.isInteger(current) || current < 1 || current >= 2100000000) {
  throw new Error(
    'Expected android.versionCode in example/app.json to be an integer from 1 to 2099999999.',
  );
}
const next = current + 1;
const updated = Object.hasOwn(android, 'versionCode')
  ? content.replace(
      /("android"\s*:\s*\{[\s\S]*?"versionCode"\s*:\s*)\d+/,
      (_match, prefix) => `${prefix}${next}`,
    )
  : content.replace(/("android"\s*:\s*\{)/, `$1\n    "versionCode": ${next},`);
if (updated === content)
  throw new Error('Could not update android.versionCode in example/app.json.');

writeFileSync(target, updated);
console.log(`Android version code: ${current} -> ${next}`);
