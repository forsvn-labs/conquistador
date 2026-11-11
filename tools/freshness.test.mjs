// Failure modes for the freshness check, written before tools/freshness.mjs.
//
// parse
//  P1  `(checked Oct 2026; ...)` and `(checked October 2026)` are facts dated to the last day of that month.
//  P2  `(verified 2026-06)` and `(checked 2026-10-27)` are facts; a full date keeps its day.
//  P3  `(observed Nov 2026; review by Feb 2027)` is a play that is due on the last day of the review month.
//  P4  Prose such as `(checked or unchecked)` or `(verified against the table)` has no date and is ignored.
//  P5  A marker with an unknown month is invalid, never skipped silently.
//  P6  An `observed` marker without `review by` is invalid: a play must carry its review date.
//  P7  A review date before the observed date is invalid.
// status
//  S1  A fact is current until its date plus the maximum age, and overdue after it.
//  S2  A play is overdue after its review month, whatever the maximum age is.
//  S3  A block that comes due inside the warning window is reported as due soon and does not fail.
//  S4  A date in the future is invalid, because nobody checked a fact next month.
// scan and command
//  C1  The scan reads Markdown files in nested folders and reports each block with its file and line.
//  C2  A tree with no dated block is an error (exit 2), never a silent pass.
//  C3  The command exits 0 when every block is current, and 1 when a block is overdue or invalid.
//  C4  `--json` prints the report as JSON with the same counts.
//  C5  An unknown option or a bad `--now` date is a usage error (exit 2).
//  C6  The method library in this repository has dated blocks, and none is invalid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseMarkers, scan } from './freshness.mjs';

const tool = join(dirname(fileURLToPath(import.meta.url)), 'freshness.mjs');
const day = value => new Date(`${value}T00:00:00Z`);
const tree = files => {
  const root = mkdtempSync(join(tmpdir(), 'freshness-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};
const run = (...args) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8' });
const iso = date => date.toISOString().slice(0, 10);

test('P1 month markers are facts dated to the end of the month', () => {
  const [short, long] = parseMarkers('## Platform facts (checked Oct 2026; confirm in the composer)\n\ntext (checked October 2026)');
  assert.equal(short.kind, 'facts');
  assert.equal(iso(short.date), '2026-10-31');
  assert.equal(short.line, 1);
  assert.equal(iso(long.date), '2026-10-31');
  assert.equal(long.line, 3);
});

test('P2 numeric dates are facts and a full date keeps its day', () => {
  const [month, full] = parseMarkers('(verified 2026-06)\n(checked 2026-10-27)');
  assert.equal(iso(month.date), '2026-06-30');
  assert.equal(iso(full.date), '2026-10-27');
  assert.equal(full.kind, 'facts');
});

test('P3 an observed marker is a play due at the end of its review month', () => {
  const [play] = parseMarkers('## Current plays (observed Nov 2026; review by Feb 2027; confirm on your own account)');
  assert.equal(play.kind, 'plays');
  assert.equal(iso(play.date), '2026-11-30');
  assert.equal(iso(play.reviewBy), '2027-02-28');
  assert.equal(play.invalid, undefined);
});

test('P4 prose without a date is ignored', () => {
  assert.deepEqual(parseMarkers('(checked or unchecked) (verified against the table) (checked BEFORE cold-start) (observed in sample) (verified)'), []);
});

test('P5 an unknown month is invalid', () => {
  const [bad] = parseMarkers('(checked Okt 2026)');
  assert.match(bad.invalid, /month/);
});

test('P6 an observed marker without a review date is invalid', () => {
  const [bad] = parseMarkers('(observed Nov 2026)');
  assert.match(bad.invalid, /review by/);
});

test('P7 a review date before the observed date is invalid', () => {
  const [bad] = parseMarkers('(observed Nov 2026; review by Oct 2026)');
  assert.match(bad.invalid, /before/);
});

test('S1 a fact is current until its date plus the maximum age', () => {
  const root = tree({ 'a.md': '(checked Oct 2026)' });
  assert.equal(scan(root, { now: day('2027-01-29'), maxAgeDays: 90 }).overdue.length, 0);
  const late = scan(root, { now: day('2027-01-30'), maxAgeDays: 90 });
  assert.equal(late.overdue.length, 1);
  assert.equal(iso(late.overdue[0].due), '2027-01-29');
});

test('S2 a play is overdue after its review month', () => {
  const root = tree({ 'a.md': '(observed Nov 2026; review by Feb 2027)' });
  assert.equal(scan(root, { now: day('2027-02-28'), maxAgeDays: 1 }).overdue.length, 0);
  assert.equal(scan(root, { now: day('2027-03-01'), maxAgeDays: 9999 }).overdue.length, 1);
});

test('S3 a block inside the warning window is due soon and does not fail', () => {
  const root = tree({ 'a.md': '(checked Oct 2026)' });
  const report = scan(root, { now: day('2027-01-10'), maxAgeDays: 90, soonDays: 30 });
  assert.equal(report.soon.length, 1);
  assert.equal(report.overdue.length, 0);
  assert.equal(scan(root, { now: day('2026-11-11'), maxAgeDays: 90, soonDays: 30 }).soon.length, 0);
});

test('S4 a date in the future is invalid', () => {
  const root = tree({ 'a.md': '(checked Dec 2026)' });
  const report = scan(root, { now: day('2026-11-11') });
  assert.equal(report.invalid.length, 1);
  assert.match(report.invalid[0].invalid, /future/);
  assert.equal(scan(tree({ 'a.md': '(checked Nov 2026)' }), { now: day('2026-11-11') }).invalid.length, 0);
});

test('C1 the scan reads nested Markdown files and reports file and line', () => {
  const root = tree({ 'channels/x.md': '# X\n\n## Facts (checked Oct 2026)\n', 'commands/ads/refs/deep.md': '(checked Sep 2026)', 'notes.txt': '(checked Jan 2020)' });
  const report = scan(root, { now: day('2026-11-11') });
  assert.deepEqual(report.blocks.map(block => `${block.file}:${block.line}`), ['channels/x.md:3', 'commands/ads/refs/deep.md:1']);
});

test('C2 a tree with no dated block is an error', () => {
  const root = tree({ 'a.md': 'no dates here' });
  assert.throws(() => scan(root, { now: day('2026-11-11') }), /no dated block/i);
  const result = run('--root', root, '--now', '2026-11-11');
  assert.equal(result.status, 2);
});

test('C3 the command exits 0 when current and 1 when overdue or invalid', () => {
  const root = tree({ 'a.md': '(checked Oct 2026)' });
  const ok = run('--root', root, '--now', '2026-11-11');
  assert.equal(ok.status, 0, ok.stderr);
  const late = run('--root', root, '--now', '2027-06-01');
  assert.equal(late.status, 1);
  assert.match(late.stdout, /a\.md:1/);
  assert.match(late.stdout, /overdue/i);
  const bad = run('--root', tree({ 'a.md': '(observed Nov 2026)' }), '--now', '2026-12-01');
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /invalid/i);
});

test('C4 --json prints the report with the same counts', () => {
  const root = tree({ 'a.md': '(checked Oct 2026)\n(checked Jan 2026)' });
  const result = run('--root', root, '--now', '2026-11-11', '--json');
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.blocks.length, 2);
  assert.equal(report.overdue.length, 1);
  assert.equal(report.now, '2026-11-11');
});

test('C5 an unknown option or a bad date is a usage error', () => {
  assert.equal(run('--nope').status, 2);
  assert.equal(run('--now', 'yesterday').status, 2);
  assert.equal(run('--max-age-days', '0').status, 2);
});

test('C6 the method library has dated blocks and none is invalid', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'conquistador');
  const report = scan(root, { now: day('2026-11-11') });
  assert.ok(report.blocks.length >= 20, `found ${report.blocks.length}`);
  assert.deepEqual(report.invalid.map(block => `${block.file}:${block.line} ${block.invalid}`), []);
});
