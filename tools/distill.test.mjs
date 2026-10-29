// Failure modes for the distillation workflow, written before tools/distill.mjs.
//
// fetch
//  F1  An output folder inside a Git work tree is refused before any write.
//  F2  A declared license outside the allowed list is refused before any clone.
//  F3  A fetched LICENSE that does not match the declared license is refused, and the checkout is removed.
//  F4  A commit that does not exist in the source is refused.
//  F5  An existing non-empty checkout folder is refused (untrusted data needs a new empty folder).
//  F6  A good source is checked out at the pinned commit and recorded with its license digest.
//  F7  A source URL that starts with "-" is refused before git runs, so it cannot act as a git option.
//  F8  When a later source fails, every checkout made in that run is removed, so a rerun can start clean.
//  F9  An output folder reached through a symlink into a Git work tree is refused.
// inventory
//  I1  A unit without a description is listed as unrouted with reason no-description, not a crash.
//  I2  A routed unit records its command or play and the practice status from evals/practices.json.
//  I3  A unit the router cannot place is reported as a gap.
//  I4  Every route id is a well-formed commands/<name> or plays/<name> id, never an object string.
// routes
//  R1  A request whose route differs from the note's declared target is reported as a mismatch.
//  R2  A note without a requests section or a target line is reported, not skipped silently.
// check
//  C1  A copied run of 8 words (case and punctuation ignored) is a finding with file and line.
//  C2  A shared run of 7 words is not a finding.
//  C3  A source name, owner, or repository name in public text is a finding.
//  C4  A run inside an allowed stock phrase is not a finding.
//  C5  A clean file passes with exit code 0; any finding exits 1.
//  C6  A missing or unfetched corpus is an error, never a silent pass.
//  C7  A generic repository name taken from the URL (for example `seo`) is not a source name; the owner handle is.
//  C8  Source code is not part of the prose corpus, so shared import lines are not findings.
//  C10 A dangling symlink in a source does not abort the check, and a symlink out of the source is not read.
//  C9  With --diff <ref>, only lines added since the ref are checked; old lines and untracked files are handled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'tools', 'distill.mjs');
const MIT = 'MIT License\n\nCopyright (c) 2025 Example\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software.\n';
const GPL = 'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n';
const SOURCE_TEXT = 'Always lead the cancellation screen with the reason picker so every save offer matches the stated reason for leaving.\n';

const tmp = () => mkdtempSync(join(tmpdir(), 'distill-test-'));
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim();
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: root });

function sourceRepo({ license = MIT, units = { 'skills/churn/SKILL.md': `---\nname: churn\ndescription: "Build a referral program with rewards for customers who invite friends."\n---\n\n${SOURCE_TEXT}`, 'skills/blank/SKILL.md': '---\nname: blank\n---\n\nNo description here.\n' } } = {}) {
  const dir = tmp();
  writeFileSync(join(dir, 'LICENSE'), license);
  for (const [path, body] of Object.entries(units)) { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), body); }
  git(dir, 'init', '-q'); git(dir, 'add', '.'); git(dir, 'commit', '-qm', 'init');
  return { dir, commit: git(dir, 'rev-parse', 'HEAD') };
}

function registry(source, overrides = {}) {
  const path = join(tmp(), 'registry.json');
  writeFileSync(path, JSON.stringify({
    schemaVersion: 'conquistador.distill-registry/v1',
    sources: [{ id: 'fx', url: source.dir, commit: source.commit, license: 'MIT', units: ['skills/*/SKILL.md'], names: ['Example Author'], ...overrides }],
  }));
  return path;
}

const fetched = () => { const source = sourceRepo(); const reg = registry(source); const out = tmp(); assert.equal(run('fetch', '--registry', reg, '--out', out).status, 0); return { source, reg, out }; };

test('F1 refuses an output folder inside a Git work tree', () => {
  const source = sourceRepo();
  const result = run('fetch', '--registry', registry(source), '--out', join(root, 'dist', 'distill-should-not-exist'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Git work tree/);
  assert.equal(existsSync(join(root, 'dist', 'distill-should-not-exist')), false);
});

test('F2 refuses a license outside the allowed list before cloning', () => {
  const source = sourceRepo();
  const out = tmp();
  const result = run('fetch', '--registry', registry(source, { license: 'GPL-3.0' }), '--out', out);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /license GPL-3.0 is not allowed/);
  assert.deepEqual(readdirSync(out), []);
});

test('F3 refuses a fetched license that does not match the declaration and removes the checkout', () => {
  const source = sourceRepo({ license: GPL });
  const out = tmp();
  const result = run('fetch', '--registry', registry(source), '--out', out);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LICENSE does not match MIT/);
  assert.equal(existsSync(join(out, 'src', 'fx')), false);
});

test('F4 refuses a commit that does not exist', () => {
  const source = sourceRepo();
  const out = tmp();
  const result = run('fetch', '--registry', registry(source, { commit: 'f'.repeat(40) }), '--out', out);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /commit .* not found/);
});

test('F5 refuses an existing non-empty checkout folder', () => {
  const source = sourceRepo();
  const out = tmp();
  mkdirSync(join(out, 'src', 'fx'), { recursive: true });
  writeFileSync(join(out, 'src', 'fx', 'planted.txt'), 'x');
  const result = run('fetch', '--registry', registry(source), '--out', out);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not empty/);
});

test('F6 checks out the pinned commit and records the license digest', () => {
  const { source, out } = fetched();
  const lock = JSON.parse(readFileSync(join(out, 'sources.lock.json'), 'utf8'));
  assert.equal(lock.sources[0].commit, source.commit);
  assert.equal(lock.sources[0].license, 'MIT');
  assert.match(lock.sources[0].licenseSha256, /^[0-9a-f]{64}$/);
  assert.equal(git(join(out, 'src', 'fx'), 'rev-parse', 'HEAD'), source.commit);
});

test('I1-I4 inventory routes described units, reports gaps and undescribed units', () => {
  const { reg, out } = fetched();
  const result = run('inventory', '--registry', reg, '--out', out);
  assert.equal(result.status, 0, result.stderr);
  const inventory = JSON.parse(readFileSync(join(out, 'inventory.json'), 'utf8'));
  const blank = inventory.units.find(unit => unit.unit === 'blank');
  assert.equal(blank.route, null);
  assert.equal(blank.reason, 'no-description');
  const churn = inventory.units.find(unit => unit.unit === 'churn');
  assert.ok(churn.route, 'a churn request routes somewhere');
  for (const id of churn.route) assert.match(id, /^(commands|plays)\/[a-z0-9-]+$/);
  assert.ok(['passed', 'pass-through', 'untested', 'none'].includes(churn.practiceStatus));
  assert.ok(Array.isArray(inventory.gaps));
  assert.ok(inventory.gaps.some(gap => gap.unit === 'blank'));
  assert.ok(existsSync(join(out, 'inventory.md')));
});

test('R1-R2 routes compares note requests with declared targets', () => {
  const notes = tmp();
  writeFileSync(join(notes, 'ms-seo-audit.md'), '# seo-audit\nMaps to Conquistador: commands/seo · practice status: pass-through\n## Requests that should route here\n- Audit my site for technical SEO problems\n- Write a cold email to a VP of sales\n## Decision procedure (own words)\n');
  writeFileSync(join(notes, 'ms-empty.md'), '# empty\nNothing here.\n');
  const result = run('routes', '--notes', notes, '--json');
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 1);
  assert.ok(report.mismatches.some(item => /cold email/.test(item.request)));
  assert.ok(!report.mismatches.some(item => /technical SEO/.test(item.request)));
  assert.ok(report.invalid.some(item => item.note.endsWith('ms-empty.md')));
});

test('C1-C5 check finds copied runs and source names, honours allowed phrases', () => {
  const { reg, out } = fetched();
  const files = tmp();
  const copied = join(files, 'copied.md');
  const near = join(files, 'near.md');
  const named = join(files, 'named.md');
  const allowed = join(files, 'allowed.md');
  const clean = join(files, 'clean.md');
  writeFileSync(copied, 'Intro line.\nAlways lead the CANCELLATION screen, with the reason picker so the offer fits.\n');
  writeFileSync(near, 'We always lead the cancellation screen with the question first.\n');
  writeFileSync(named, 'As example author says, keep it short.\n');
  writeFileSync(allowed, 'Always lead the cancellation screen with the reason picker today.\n');
  writeFileSync(clean, 'Ask why they are leaving, then match the offer to that reason.\n');
  const allow = join(files, 'allow.txt');
  writeFileSync(allow, 'always lead the cancellation screen with the reason picker\n');

  const hit = run('check', '--registry', reg, '--out', out, '--json', copied, near, named, clean);
  assert.equal(hit.status, 1);
  const report = JSON.parse(hit.stdout);
  const copiedHit = report.findings.find(item => item.file === copied && item.kind === 'shared-run');
  assert.equal(copiedHit.line, 2);
  assert.ok(copiedHit.words >= 8);
  assert.ok(!report.findings.some(item => item.file === near));
  assert.ok(report.findings.some(item => item.file === named && item.kind === 'source-name'));
  assert.ok(!report.findings.some(item => item.file === clean));

  assert.equal(run('check', '--registry', reg, '--out', out, '--allow', allow, allowed).status, 0);
  assert.equal(run('check', '--registry', reg, '--out', out, clean).status, 0);
});

test('C6 check refuses a corpus that was never fetched', () => {
  const source = sourceRepo();
  const files = tmp();
  writeFileSync(join(files, 'clean.md'), 'Plain text.\n');
  const result = run('check', '--registry', registry(source), '--out', tmp(), join(files, 'clean.md'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not fetched/);
});

test('C7-C8 derives only the owner handle and checks prose only', () => {
  const source = sourceRepo({ units: { 'skills/a/SKILL.md': `---\ndescription: "x"\n---\n${SOURCE_TEXT}`, 'src/code.ts': "import { readFileSync, writeFileSync } from 'node:fs'; import { join, dirname, resolve } from 'node:path';\n" } });
  // A local clone URL stands in for the hosted one; `homepage` names the hosted repository.
  const reg = registry(source, { names: [], homepage: 'https://github.com/someowner/seo' });
  const out = tmp();
  assert.equal(run('fetch', '--registry', reg, '--out', out).status, 0);
  const files = tmp();
  const generic = join(files, 'generic.md');
  const owner = join(files, 'owner.md');
  const code = join(files, 'code.mjs');
  writeFileSync(generic, 'Improve seo for pages that rank on page two.\n');
  writeFileSync(owner, 'A tip from someowner.\n');
  writeFileSync(code, "import { readFileSync, writeFileSync } from 'node:fs'; import { join, dirname, resolve } from 'node:path';\n");
  assert.equal(run('check', '--registry', reg, '--out', out, generic, code).status, 0);
  const named = run('check', '--registry', reg, '--out', out, '--json', owner);
  assert.equal(named.status, 1);
  assert.ok(JSON.parse(named.stdout).findings.some(item => item.kind === 'source-name' && item.text === 'someowner'));
});

test('C9 --diff checks only lines added since a Git ref', () => {
  const { reg, out } = fetched();
  const repo = tmp();
  git(repo, 'init', '-q');
  const page = join(repo, 'page.md');
  writeFileSync(page, `Old line.\n${SOURCE_TEXT}`);
  git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'old');
  writeFileSync(page, `Old line.\n${SOURCE_TEXT}New clean line about pricing tiers.\n`);
  const clean = spawnSync(process.execPath, [cli, 'check', '--registry', reg, '--out', out, '--diff', 'HEAD', 'page.md'], { encoding: 'utf8', cwd: repo });
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  writeFileSync(page, `Old line.\n${SOURCE_TEXT}New clean line.\n${SOURCE_TEXT}`);
  const copied = spawnSync(process.execPath, [cli, 'check', '--registry', reg, '--out', out, '--diff', 'HEAD', '--json', 'page.md'], { encoding: 'utf8', cwd: repo });
  assert.equal(copied.status, 1);
  assert.deepEqual(JSON.parse(copied.stdout).findings.map(item => item.line), [4]);
  writeFileSync(join(repo, 'new.md'), SOURCE_TEXT);
  const untracked = spawnSync(process.execPath, [cli, 'check', '--registry', reg, '--out', out, '--diff', 'HEAD', 'new.md'], { encoding: 'utf8', cwd: repo });
  assert.equal(untracked.status, 1, 'an untracked file is checked whole');
});

test('F7 refuses a source URL that git would read as an option', () => {
  const source = sourceRepo();
  const out = tmp();
  const result = run('fetch', '--registry', registry(source, { url: `--upload-pack=touch ${join(out, 'ran')}` }), '--out', out);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /URL/);
  assert.equal(existsSync(join(out, 'ran')), false);
});

test('F8 removes every checkout from a failed run', () => {
  const good = sourceRepo();
  const bad = sourceRepo({ license: GPL });
  const reg = registry(good);
  const doc = JSON.parse(readFileSync(reg, 'utf8'));
  doc.sources.push({ ...doc.sources[0], id: 'bad', url: bad.dir, commit: bad.commit });
  writeFileSync(reg, JSON.stringify(doc));
  const out = tmp();
  assert.notEqual(run('fetch', '--registry', reg, '--out', out).status, 0);
  assert.equal(existsSync(join(out, 'src', 'fx')), false);
  assert.equal(existsSync(join(out, 'src', 'bad')), false);
});

test('F9 refuses an output folder reached through a symlink into a Git work tree', () => {
  const source = sourceRepo();
  const link = join(tmp(), 'into-repo');
  symlinkSync(join(root, 'dist'), link);
  const result = run('fetch', '--registry', registry(source), '--out', join(link, 'distill-should-not-exist'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Git work tree/);
  assert.equal(existsSync(join(root, 'dist', 'distill-should-not-exist')), false);
});

test('C10 skips symlinks in the source corpus', () => {
  const outside = tmp();
  writeFileSync(join(outside, 'private.md'), 'This private sentence lives outside the source and must never be read as source text.\n');
  const source = sourceRepo();
  symlinkSync('/nonexistent/target.md', join(source.dir, 'dangling.md'));
  symlinkSync(join(outside, 'private.md'), join(source.dir, 'linked.md'));
  git(source.dir, 'add', '.'); git(source.dir, 'commit', '-qm', 'links');
  const commit = git(source.dir, 'rev-parse', 'HEAD');
  const reg = registry({ ...source, commit });
  const out = tmp();
  assert.equal(run('fetch', '--registry', reg, '--out', out).status, 0);
  const files = tmp();
  const page = join(files, 'page.md');
  writeFileSync(page, 'This private sentence lives outside the source and must never be read as source text.\n');
  const result = run('check', '--registry', reg, '--out', out, page);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
