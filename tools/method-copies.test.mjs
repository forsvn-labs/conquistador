import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCopies, copyManifestPath, findDuplicateGroups, readCopyManifest, repoPath, syncCopies, validateCopyManifest } from './method-copies.mjs';
import { internalPath, internalText, methodOwner, regularFiles, subsetLinks } from './method-library.mjs';
import { resolveDomainSelection, shouldStageSkillPath } from './domain-package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = readCopyManifest(root);
const declared = manifest.groups.flatMap(group => [group.source, ...group.copies].map(key => ({ key, group })));

// Synthetic fixture: one declared group, one near-duplicate, one unrelated file.
const SOURCE = 'skills/conquistador/commands/alpha/references/pack.md';
const COPIES = ['skills/conquistador/commands/beta/references/pack.md', 'skills/conquistador/commands/gamma/references/modes/x/pack.md'];
const NEAR = 'skills/conquistador/commands/delta/references/pack.md';
function fixture(t, text = '# Pack\n\nSynthetic rule for a fictional product.\n') {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'cq method copies ')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const at = key => join(dir, ...key.split('/'));
  const write = (key, value) => { mkdirSync(dirname(at(key)), { recursive: true }); writeFileSync(at(key), value); };
  for (const key of [SOURCE, ...COPIES]) write(key, text);
  write(NEAR, text.replace('rule', 'rules'));
  write('skills/conquistador/commands/alpha/COMMAND.md', '# Alpha\n');
  write(copyManifestPath, JSON.stringify({ schemaVersion: 'conquistador.method-copies/v1', groups: [{ source: SOURCE, sha256: sha(Buffer.from(text)), copies: COPIES }] }, null, 2) + '\n');
  const read = key => readFileSync(at(key));
  return { dir, write, read, text };
}

// ---- Repository contract -------------------------------------------------------------------

test('every declared copy matches its source byte for byte and the recorded hash', () => {
  assert.deepEqual(checkCopies(root), []);
});

test('every byte-identical file under skills/ belongs to exactly one declared group', () => {
  const groups = findDuplicateGroups(root).map(keys => keys.join('\n')).sort();
  const expected = manifest.groups.map(group => [group.source, ...group.copies].sort().join('\n')).sort();
  assert.deepEqual(groups, expected);
});

test('relative links in every declared file resolve from that file location', () => {
  const broken = [];
  let links = 0;
  for (const { key } of declared) {
    const text = readFileSync(repoPath(root, key), 'utf8');
    for (const [, href] of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      if (/^(?:[a-z]+:|\/|#)/i.test(href)) continue;
      const target = posix.normalize(posix.join(posix.dirname(key), decodeURIComponent(href.split(/[?#]/)[0])));
      links += 1;
      if (!target.startsWith('skills/') || !existsSync(join(root, ...target.split('/')))) broken.push(`${key}: ${href}`);
    }
  }
  assert.deepEqual(broken, []);
  assert.ok(links > 0, 'the declared files must contain relative links to check');
});

test('release manifests record the same hash for every copy as for its source', () => {
  const completeness = JSON.parse(readFileSync(join(root, 'release/completeness.json'), 'utf8'));
  const plugin = JSON.parse(readFileSync(join(root, 'release/plugin-completeness.json'), 'utf8'));
  const release = new Map(completeness.requiredResources.map(item => [`skills/${item.path}`, item.sha256]));
  const pluginFiles = new Map(plugin.files.map(item => [item.path, item.sha256]));
  for (const { key, group } of declared) {
    assert.equal(release.get(key), group.sha256, `release/completeness.json: ${key}`);
    assert.equal(pluginFiles.get(key), group.sha256, `release/plugin-completeness.json: ${key}`);
  }
});

test('the copy manifest and its maintainer tool stay out of the npm package', () => {
  const files = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).files;
  assert.ok(files.includes('!tools/method-copies.mjs'));
  assert.ok(files.includes(`!${copyManifestPath}`));
});

// Install the real payloads once, then check every declared copy in each of them.
function install(t, mode, extra = []) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'cq method copies install ')));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const target = join(parent, 'owned');
  const args = extra.map(value => typeof value === 'function' ? value(parent) : value);
  const result = spawnSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', mode, target, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return target;
}
const sourceText = key => readFileSync(repoPath(root, key), 'utf8');
for (const [mode, library] of [['conquistador', 'library'], ['plugin', 'skills/conquistador/library'], ['single-agent', 'library']]) {
  test(`${mode} install carries every declared copy with its source bytes`, t => {
    const target = install(t, mode);
    for (const { key, group } of declared) {
      const installed = join(target, library, ...internalPath(key.slice('skills/'.length)).split('/'));
      assert.ok(existsSync(installed), `${mode} is missing ${key}`);
      assert.equal(readFileSync(installed, 'utf8'), internalText(sourceText(group.source)), `${mode}: ${key}`);
    }
  });
}

test('domain installs keep selected copies, omit unselected ones, and adapt only links', t => {
  const domain = { schemaVersion: 'conquistador.domain-package/v1', id: 'domain:video-measure', agentPackageSchemaVersion: 'conquistador.agent-package/v2',
    allowed: { roles: [], skills: ['video', 'social', 'measure', 'creative'], workflows: ['report'], tools: ['host-model'], knowledgeHandles: [] } };
  const target = install(t, 'plugin', ['--domain', parent => { writeFileSync(join(parent, 'domain.json'), JSON.stringify(domain)); return join(parent, 'domain.json'); }]);
  const selection = resolveDomainSelection(root, domain);
  const files = regularFiles(join(root, 'skills')).filter(file => shouldStageSkillPath(`skills/${file}`, selection));
  let kept = 0, omitted = 0;
  for (const { key, group } of declared) {
    const libraryKey = key.slice('skills/'.length);
    const installed = join(target, 'skills/conquistador/library', ...internalPath(libraryKey).split('/'));
    if (!files.includes(libraryKey)) { assert.equal(existsSync(installed), false, `unselected ${key}`); omitted += 1; continue; }
    assert.ok(methodOwner(libraryKey), key);
    assert.equal(readFileSync(installed, 'utf8'), internalText(subsetLinks(sourceText(group.source), libraryKey, files)), `domain: ${key}`);
    kept += 1;
  }
  assert.ok(kept > 0 && omitted > 0, 'the domain fixture must keep some copies and omit others');
});

// ---- Drift detection and sync ---------------------------------------------------------------

test('a clean fixture passes the check, and sync changes nothing', t => {
  const f = fixture(t);
  assert.deepEqual(checkCopies(f.dir), []);
  assert.deepEqual(syncCopies(f.dir), { written: [], recorded: [] });
});

test('one changed byte, line ending, final newline, or BOM in a copy is drift', t => {
  for (const variant of [
    text => text.replace('rule', 'rulf'),
    text => text.replace(/\n/g, '\r\n'),
    text => text.slice(0, -1),
    text => `\uFEFF${text}`,
  ]) {
    const f = fixture(t);
    f.write(COPIES[0], variant(f.text));
    assert.equal(Buffer.compare(f.read(COPIES[0]), f.read(SOURCE)) !== 0, true);
    const problems = checkCopies(f.dir);
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0], new RegExp(`${COPIES[0]}.*edited directly`));
    assert.equal(findDuplicateGroups(f.dir).some(keys => keys.includes(COPIES[0])), false);
  }
});

test('an edited copy is reported and sync refuses without writing anything', t => {
  const f = fixture(t);
  f.write(COPIES[1], `${f.text}Local edit.\n`);
  const before = [SOURCE, ...COPIES, copyManifestPath].map(key => f.read(key));
  assert.match(checkCopies(f.dir).join('\n'), new RegExp(`${COPIES[1]} was edited directly.*${SOURCE}`));
  assert.throws(() => syncCopies(f.dir), new RegExp(`${COPIES[1]} was edited directly`));
  assert.deepEqual([SOURCE, ...COPIES, copyManifestPath].map(key => f.read(key)), before);
});

test('an edited source is reported, then sync updates every copy and the recorded hash', t => {
  const f = fixture(t);
  const edited = `${f.text}New synthetic rule.\n`;
  f.write(SOURCE, edited);
  assert.match(checkCopies(f.dir).join('\n'), new RegExp(`${COPIES[0]} is out of date\\. Run node tools/method-copies\\.mjs`));
  const result = syncCopies(f.dir);
  assert.deepEqual(result.written, COPIES);
  assert.deepEqual(result.recorded, [SOURCE]);
  for (const key of COPIES) assert.equal(f.read(key).toString(), edited);
  assert.equal(readCopyManifest(f.dir).groups[0].sha256, sha(Buffer.from(edited)));
  assert.deepEqual(checkCopies(f.dir), []);
  // Copying the edit by hand still leaves a stale recorded hash, so the next copy edit stays detectable.
  for (const key of [SOURCE, ...COPIES]) f.write(key, f.text);
  assert.match(checkCopies(f.dir).join('\n'), new RegExp(`${SOURCE} changed after the last sync`));
  assert.deepEqual(syncCopies(f.dir), { written: [], recorded: [SOURCE] });
  assert.deepEqual(checkCopies(f.dir), []);
});

test('a missing copy or source fails the check, and sync does not recreate it', t => {
  for (const key of [COPIES[0], SOURCE]) {
    const f = fixture(t);
    rmSync(repoPath(f.dir, key));
    assert.match(checkCopies(f.dir).join('\n'), new RegExp(`Missing.*${key}`));
    assert.throws(() => syncCopies(f.dir), /Missing/);
    assert.equal(existsSync(repoPath(f.dir, key)), false);
  }
});

test('a new undeclared byte-identical file fails the check', t => {
  const f = fixture(t);
  const extra = 'skills/conquistador/commands/epsilon/references/pack.md';
  f.write(extra, f.text);
  assert.match(checkCopies(f.dir).join('\n'), new RegExp(`Undeclared.*${extra}`));
  const lone = 'skills/conquistador/commands/epsilon/references/other.md';
  f.write(lone, f.read(NEAR));
  assert.match(checkCopies(f.dir).join('\n'), new RegExp(`Undeclared.*${lone}`));
});

test('sync never writes an undeclared near-duplicate', t => {
  const f = fixture(t);
  const near = f.read(NEAR);
  f.write(SOURCE, `${f.text}Changed.\n`);
  syncCopies(f.dir);
  assert.deepEqual(f.read(NEAR), near);
});

// ---- Manifest shape and Windows paths ---------------------------------------------------------

test('manifest validation rejects unsafe, ambiguous, or inconsistent entries', () => {
  const good = { schemaVersion: 'conquistador.method-copies/v1', groups: [{ source: SOURCE, sha256: 'a'.repeat(64), copies: COPIES }] };
  assert.doesNotThrow(() => validateCopyManifest(good));
  const withGroup = change => ({ ...good, groups: [{ ...good.groups[0], ...change }] });
  for (const [label, value] of [
    ['schema', { ...good, schemaVersion: 'other' }],
    ['extra key', { ...good, extra: true }],
    ['backslash', withGroup({ copies: ['skills\\conquistador\\commands\\beta\\pack.md'] })],
    ['absolute', withGroup({ source: '/skills/conquistador/a.md' })],
    ['drive letter', withGroup({ source: 'C:/skills/conquistador/a.md' })],
    ['parent segment', withGroup({ copies: ['skills/conquistador/../../package.json'] })],
    ['dot segment', withGroup({ copies: ['skills/./conquistador/a.md'] })],
    ['outside skills', withGroup({ copies: ['tools/brief.mjs'] })],
    ['no copies', withGroup({ copies: [] })],
    ['source as copy', withGroup({ copies: [SOURCE] })],
    ['repeated copy', withGroup({ copies: [COPIES[0], COPIES[0]] })],
    ['bad hash', withGroup({ sha256: 'A'.repeat(64) })],
    ['group key', withGroup({ note: 'x' })],
    ['path in two groups', { ...good, groups: [good.groups[0], { source: NEAR, sha256: 'b'.repeat(64), copies: [COPIES[0]] }] }],
  ]) assert.throws(() => validateCopyManifest(value), Error, label);
});

test('manifest keys resolve with Windows separators and scan keys always use forward slashes', t => {
  assert.equal(repoPath('C:\\work\\conquistador', SOURCE, path.win32), 'C:\\work\\conquistador\\skills\\conquistador\\commands\\alpha\\references\\pack.md');
  assert.equal(repoPath('/work/conquistador', SOURCE, path.posix), `/work/conquistador/${SOURCE}`);
  assert.throws(() => repoPath('C:\\work', 'skills\\conquistador\\a.md', path.win32));
  const f = fixture(t);
  for (const keys of findDuplicateGroups(f.dir)) for (const key of keys) assert.doesNotMatch(key, /\\/);
});
