import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

function section(text, version) {
  const headings = [...text.matchAll(/^## \[([^\]\r\n]+)\][^\r\n]*$/gm)];
  const matches = headings.filter((heading) => heading[1] === version);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one '## [${version}]' section in CHANGELOG.md`);
  }
  const heading = matches[0];
  const next = headings[headings.indexOf(heading) + 1];
  return {
    start: heading.index,
    bodyStart: heading.index + heading[0].length,
    end: next?.index ?? text.length,
  };
}

export function releaseNotes(text, version = 'Unreleased') {
  const { bodyStart, end } = section(text, version);
  const body = text.slice(bodyStart, end).trim();
  if (!/^- \S/m.test(body.replace(/<!--[\s\S]*?-->/g, ''))) {
    throw new Error(`No changelog entries under '## [${version}]'`);
  }
  return body;
}

export function prepareRelease(text, version, date = new Date().toISOString().slice(0, 10)) {
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      version,
    )
  ) {
    throw new Error(`Invalid release version: ${version}`);
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Invalid release date: ${date}`);
  }
  if ([...text.matchAll(/^## \[([^\]\r\n]+)\]/gm)].some((heading) => heading[1] === version)) {
    throw new Error(`CHANGELOG.md already has a section for ${version}`);
  }
  const body = releaseNotes(text);
  const { start, end } = section(text, 'Unreleased');
  return (
    text.slice(0, start) +
    `## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n` +
    (end < text.length ? `\n${text.slice(end)}` : '')
  );
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { changelog: { type: 'string', default: 'CHANGELOG.md' } },
  });
  const [command, version, date] = positionals;
  if (
    (command === 'unreleased' && positionals.length !== 1) ||
    (command === 'notes' && positionals.length !== 2) ||
    (command === 'release' && (positionals.length < 2 || positionals.length > 3)) ||
    !['unreleased', 'notes', 'release'].includes(command)
  ) {
    throw new Error(
      'Usage: node scripts/release-changelog.mjs [--changelog FILE] unreleased | notes VERSION | release VERSION [YYYY-MM-DD]',
    );
  }
  const text = readFileSync(values.changelog, 'utf8');
  if (command === 'release') {
    writeFileSync(values.changelog, prepareRelease(text, version, date));
  } else {
    console.log(releaseNotes(text, command === 'unreleased' ? 'Unreleased' : version));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
