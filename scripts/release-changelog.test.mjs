import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { prepareRelease, releaseNotes } from './release-changelog.mjs';

const entries = '### Fixed\n\n- Fix Android playback.\n- Fix iOS quality selection.';
const previous = '## [1.0.0] - 2026-10-16\n\n### Added\n\n- Initial stable release.\n';
const changelog = `# Changelog\n\n## [Unreleased]\n\n${entries}\n\n${previous}`;

test('pending notes contain only Unreleased entries', () => {
  assert.equal(releaseNotes(changelog), entries);
});

test('release preparation dates the entries and preserves previous releases', () => {
  const updated = prepareRelease(changelog, '1.0.1', '2026-10-23');
  assert.equal(
    updated,
    `# Changelog\n\n## [Unreleased]\n\n## [1.0.1] - 2026-10-23\n\n${entries}\n\n${previous}`,
  );
  assert.equal(releaseNotes(updated, '1.0.1'), entries);
  assert.equal(releaseNotes(updated, '1.0.0'), '### Added\n\n- Initial stable release.');
  assert.throws(() => releaseNotes(updated), /No changelog entries/);
});

test('release preparation works without any previous releases', () => {
  const text = `# Changelog\n\n## [Unreleased]\n\n${entries}\n`;
  assert.equal(
    prepareRelease(text, '1.0.1', '2026-10-23'),
    `# Changelog\n\n## [Unreleased]\n\n## [1.0.1] - 2026-10-23\n\n${entries}\n`,
  );
});

test('prereleases and build metadata have separate version sections', () => {
  for (const version of ['1.1.0-beta.1', '1.1.0-rc.2+build.3']) {
    assert.equal(releaseNotes(prepareRelease(changelog, version), version), entries);
  }
});

test('empty headings and comment placeholders cannot be released', () => {
  for (const body of ['', '### Fixed\n', '<!-- - Describe a fix. -->\n### Added']) {
    const text = `# Changelog\n\n## [Unreleased]\n\n${body}\n\n${previous}`;
    assert.throws(() => prepareRelease(text, '1.0.1'), /No changelog entries/);
  }
});

test('missing and duplicate sections fail rather than using the wrong notes', () => {
  assert.throws(() => releaseNotes(previous), /Expected exactly one/);
  assert.throws(() => releaseNotes(changelog, '9.0.0'), /Expected exactly one/);
  assert.throws(() => releaseNotes(`${changelog}\n## [Unreleased]\n`), /Expected exactly one/);
  assert.throws(() => prepareRelease(changelog, '1.0.0'), /already has a section/);
});

test('duplicate historical sections stop release preparation', () => {
  const text = `${changelog}\n## [1.0.0] - 2026-10-17\n\n- Duplicated release.\n`;
  assert.throws(() => prepareRelease(text, '1.0.1'), /duplicate sections: 1\.0\.0/);
  assert.throws(() => prepareRelease(`${changelog}\n## [Unreleased]\n`, '1.0.1'), /duplicate/);
});

test('promoting a prerelease folds its notes into the stable release', () => {
  const rc = '## [1.1.0-rc.1] - 2026-10-20\n\n### Added\n\n- Prerelease feature.\n';
  const text = `# Changelog\n\n## [Unreleased]\n\n${entries}\n\n${rc}\n${previous}`;

  const updated = prepareRelease(text, '1.1.0', '2026-10-23');
  const notes = releaseNotes(updated, '1.1.0');
  assert.equal(
    notes,
    '### Fixed\n\n- Fix Android playback.\n- Fix iOS quality selection.\n\n### Added\n\n- Prerelease feature.',
  );
  assert.match(updated, /## \[Unreleased\]\n\n## \[1\.1\.0\] - 2026-10-23/);
  assert.doesNotMatch(updated, /1\.1\.0-rc\.1/);
});

test('a prerelease can be promoted with an empty Unreleased section', () => {
  const text = `# Changelog\n\n## [Unreleased]\n\n## [1.1.0-rc.1] - 2026-10-20\n\n### Added\n\n- Prerelease feature.\n`;
  const updated = prepareRelease(text, '1.1.0', '2026-10-23');
  assert.equal(releaseNotes(updated, '1.1.0'), '### Added\n\n- Prerelease feature.');
});

test('unrelated prerelease sections are kept when promoting to stable', () => {
  const rc = '## [2.0.0-beta.1] - 2026-10-20\n\n### Changed\n\n- Next major work.\n';
  const text = `${changelog}\n${rc}`;
  const updated = prepareRelease(text, '1.0.1', '2026-10-23');
  assert.equal(releaseNotes(updated, '2.0.0-beta.1'), '### Changed\n\n- Next major work.');
});

test('versions match exactly rather than matching a prerelease or version prefix', () => {
  const text = `${changelog}\n## [1.0.10] - 2026-10-17\n\n- Another release.\n`;
  assert.throws(() => releaseNotes(text, '1.0.1'), /Expected exactly one/);
  assert.equal(releaseNotes(prepareRelease(text, '1.0.1'), '1.0.1'), entries);
});

test('invalid versions and dates are rejected', () => {
  for (const version of [
    'v1.0.1',
    '1.0',
    '01.0.1',
    '1.0.1-beta_1',
    '1.0.1-',
    '1.0.1-01',
    '1.0.1-alpha.02',
  ]) {
    assert.throws(() => prepareRelease(changelog, version), /Invalid release version/);
  }
  // Leading zeroes are legal in alphanumeric identifiers and build metadata.
  for (const version of ['1.0.1-0', '1.0.1-01a', '1.0.1-beta+build.01']) {
    assert.equal(releaseNotes(prepareRelease(changelog, version), version), entries);
  }
  for (const date of ['2026-02-30', '2026-13-01', '2026-1-01', 'not-a-date']) {
    assert.throws(() => prepareRelease(changelog, '1.0.1', date), /Invalid release date/);
  }
});

test('CLI previews, prepares, and extracts identical notes without modifying on errors', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'bunny-release-changelog-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'CHANGELOG.md');
  writeFileSync(file, changelog);
  const script = fileURLToPath(new URL('./release-changelog.mjs', import.meta.url));
  const run = (...args) =>
    spawnSync(process.execPath, [script, '--changelog', file, ...args], { encoding: 'utf8' });

  const preview = run('unreleased');
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(preview.stdout.trim(), entries);
  assert.equal(readFileSync(file, 'utf8'), changelog);

  const release = run('release', '1.0.1', '2026-10-23');
  assert.equal(release.status, 0, release.stderr);
  const updated = readFileSync(file, 'utf8');
  assert.equal(updated, prepareRelease(changelog, '1.0.1', '2026-10-23'));

  const notes = run('notes', '1.0.1');
  assert.equal(notes.status, 0, notes.stderr);
  assert.equal(notes.stdout, preview.stdout);
  for (const args of [
    ['release', '1.0.1'],
    ['release', '1.0.2'],
    ['notes', '9.0.0'],
    ['unreleased'],
    ['unknown'],
    ['notes'],
  ]) {
    assert.equal(run(...args).status, 1);
    assert.equal(readFileSync(file, 'utf8'), updated);
  }
});
