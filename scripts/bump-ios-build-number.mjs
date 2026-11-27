import { readFileSync, writeFileSync } from 'node:fs';

const target = new URL('../example/app.json', import.meta.url);
const content = readFileSync(target, 'utf8');
const current = JSON.parse(content).ios?.buildNumber;
const next = Number(current) + 1;

if (typeof current !== 'string' || !/^\d+$/.test(current) || !Number.isSafeInteger(next)) {
  throw new Error('Expected ios.buildNumber in example/app.json to be an integer string.');
}

// Preserve all other manifest settings and formatting.
const updated = content.replace(
  /("ios"\s*:\s*\{[\s\S]*?"buildNumber"\s*:\s*")\d+(")/,
  (_match, prefix, suffix) => `${prefix}${next}${suffix}`,
);
if (updated === content) {
  throw new Error('Could not update ios.buildNumber in example/app.json.');
}

writeFileSync(target, updated);
console.log(`iOS build number: ${current} -> ${next}`);
