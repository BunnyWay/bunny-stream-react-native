import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

function sections(text) {
  const headings = [...text.matchAll(/^## \[([^\]\r\n]+)\][^\r\n]*$/gm)];
  return headings.map((heading, index) => ({
    name: heading[1],
    start: heading.index,
    bodyStart: heading.index + heading[0].length,
    end: headings[index + 1]?.index ?? text.length,
  }));
}

function section(text, version) {
  const matches = sections(text).filter((s) => s.name === version);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one '## [${version}]' section in CHANGELOG.md`);
  }
  return matches[0];
}

function hasEntries(body) {
  return /^- \S/m.test(body.replace(/<!--[\s\S]*?-->/g, ''));
}

// Merges section bodies, folding entries under same-named `###` groups so the
// aggregated release notes read as one coherent section.
function mergeBodies(bodies) {
  const groups = new Map();
  for (const body of bodies.filter(Boolean)) {
    const parts = body.split(/^### /m);
    const add = (title, content) =>
      groups.set(title, [...(groups.get(title) ?? []), ...(content ? [content] : [])]);
    if (parts[0].trim()) add('', parts[0].trim());
    for (const part of parts.slice(1)) {
      const newline = part.indexOf('\n');
      add(
        (newline === -1 ? part : part.slice(0, newline)).trim(),
        newline === -1 ? '' : part.slice(newline).trim(),
      );
    }
  }
  return [...groups]
    .map(([title, content]) =>
      title ? `### ${title}\n\n${content.join('\n')}` : content.join('\n'),
    )
    .join('\n\n');
}

export function releaseNotes(text, version = 'Unreleased') {
  const { bodyStart, end } = section(text, version);
  const body = text.slice(bodyStart, end).trim();
  if (!hasEntries(body)) {
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
  // SemVer: numeric prerelease identifiers must not have leading zeroes
  // (`1.0.0-01` is invalid; `1.0.0-01a` is a valid alphanumeric identifier).
  const prerelease = version.slice(version.indexOf('-') + 1).split('+')[0];
  if (version.includes('-') && prerelease.split('.').some((id) => /^0\d+$/.test(id))) {
    throw new Error(`Invalid release version: ${version}`);
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Invalid release date: ${date}`);
  }

  const all = sections(text);
  const counts = new Map();
  for (const { name } of all) counts.set(name, (counts.get(name) ?? 0) + 1);
  const duplicates = [...counts].filter(([, count]) => count > 1).map(([name]) => name);
  if (duplicates.length > 0) {
    throw new Error(`CHANGELOG.md has duplicate sections: ${duplicates.join(', ')}`);
  }
  if (counts.has(version)) {
    throw new Error(`CHANGELOG.md already has a section for ${version}`);
  }

  const unreleased = section(text, 'Unreleased');
  // Promoting a prerelease to stable (1.1.0-rc.1 → 1.1.0) folds its sections
  // into the release so the stable notes contain everything documented in the
  // prereleases plus any newer Unreleased entries.
  const folded = all.filter((s) => s.name.startsWith(`${version}-`));
  if (folded.some((s) => s.start < unreleased.end)) {
    throw new Error(`CHANGELOG.md has a section for a ${version} prerelease before Unreleased`);
  }

  const bodies = [unreleased, ...folded].map((s) => text.slice(s.bodyStart, s.end).trim());
  const body = mergeBodies(bodies);
  if (!hasEntries(body)) {
    throw new Error("No changelog entries under '## [Unreleased]'");
  }

  // Rebuild the tail without the folded prerelease sections.
  let tail = '';
  let position = unreleased.end;
  for (const { start, end } of folded.sort((a, b) => a.start - b.start)) {
    tail += text.slice(position, start);
    position = end;
  }
  tail += text.slice(position);

  return (
    text.slice(0, unreleased.start) +
    `## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n` +
    (tail ? `\n${tail}` : '')
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
