import { methodPath } from './method-library.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { copyPayload, missingPayload, payloadCurrent, productRoot, version } from './agents.mjs';
import { buildPluginManifest, invalidPayload, pluginManifestPath, readPluginManifest } from './plugin-payload.mjs';

const completeness = JSON.parse(readFileSync(join(productRoot, 'release/completeness.json'), 'utf8'));

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const resource = `skills/${completeness.requiredResources.find(item => item.path.startsWith('conquistador/commands/copy/references/')).path}`;

const checks = ['skills/conquistador/commands/copy/COMMAND.md', resource, 'hooks/conquistador-hook.mjs', '.codex-plugin/plugin.json', 'tools/skills-mcp.mjs', pluginManifestPath];

// All writes are disposable synthetic damage to public package copies. No agent binary,
// account, provider, model, or actual user installation is used by these tests.
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'conquistador payload fixture '));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  return { root, installed: join(root, 'plugin'), source: join(root, 'node_modules', '@forsvn', 'conquistador') };
}

test('generated plugin manifest includes every release method/resource and only the plugin subset', () => {
  const manifest = JSON.parse(readFileSync(join(productRoot, pluginManifestPath), 'utf8'));
  assert.deepEqual(manifest, buildPluginManifest(productRoot, completeness), 'Run node tools/update-completeness.mjs after intentional payload edits');
  const entries = new Map(manifest.files.map(item => [item.path, item.sha256]));

  for (const method of [completeness.parent, ...completeness.outcomes]) assert.equal(entries.get(`skills/${methodPath(method.name)}`), method.sha256);

  for (const item of completeness.requiredResources) assert.equal(entries.get(`skills/${item.path}`), item.sha256);
  assert.deepEqual([...entries.keys()].filter(path => /(^|\/)SKILL\.md$/.test(path) && path.startsWith('skills/')), ['skills/conquistador/SKILL.md']);
  // 35 method commands plus 6 meta commands (init, pin, check, connect, review, doctor).
  assert.equal([...entries.keys()].filter(path => /^skills\/conquistador\/commands\/[^/]+\/COMMAND\.md$/.test(path)).length, 41);
  assert.equal(entries.has('hosts/coding-agent/operator.mjs'), false);
  assert.equal(entries.has('runtime/bin/conquistador.js'), false);
  assert.equal(entries.has('release/completeness.json'), false);
  assert.ok(entries.has('hooks/conquistador-hook.mjs'));
  assert.ok(entries.has('mcp/server.mjs'));
});

test('copy and reuse verify complete plugin bytes, including a second copy from the stable plugin', t => {
  const f = fixture(t);
  copyPayload(f.source);
  mkdirSync(join(f.source, 'skills/node_modules'), { recursive: true });
  writeFileSync(join(f.source, 'skills/node_modules/extra.txt'), 'synthetic dependency');
  writeFileSync(join(f.source, 'skills/conquistador/commands/copy/unlisted.txt'), 'synthetic local extra');
  copyPayload(f.installed, { source: f.source });
  assert.equal(payloadCurrent(f.installed), true);
  assert.deepEqual(missingPayload(f.installed), []);
  assert.equal(existsSync(join(f.installed, 'skills/node_modules')), false);
  assert.equal(existsSync(join(f.installed, 'skills/conquistador/commands/copy/unlisted.txt')), false);
  assert.equal(existsSync(join(f.installed, 'runtime')), false);
  assert.equal(existsSync(join(f.installed, 'hosts')), false);
  assert.equal(existsSync(join(f.installed, 'release/completeness.json')), false);
  const cursor = join(f.root, 'cursor');
  copyPayload(cursor, { source: f.installed });
  assert.equal(payloadCurrent(cursor), true);
});

for (const path of checks) {
  test(`missing or changed ${path} is never current and is repaired`, t => {
    const f = fixture(t);
    copyPayload(f.installed);
    const file = join(f.installed, path);
    const before = readFileSync(file);

    for (const damage of ['missing', 'changed']) {
      if (damage === 'missing') rmSync(file);
      else writeFileSync(file, 'synthetic damaged bytes\n');
      assert.equal(payloadCurrent(f.installed), false, damage);
      copyPayload(f.installed);
      assert.equal(payloadCurrent(f.installed), true, damage);
      assert.deepEqual(readFileSync(file), before);
    }
  });
}

test('an installed manifest cannot remove requirements or authorize altered file hashes', t => {
  const f = fixture(t);
  copyPayload(f.installed);
  const file = join(f.installed, pluginManifestPath);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  rmSync(join(f.installed, 'skills/conquistador/commands/copy/COMMAND.md'));
  manifest.files = manifest.files.filter(item => item.path !== 'skills/conquistador/commands/copy/COMMAND.md');
  const altered = Buffer.from('// synthetic altered hook\n');
  writeFileSync(join(f.installed, 'hooks/conquistador-hook.mjs'), altered);
  manifest.files.find(item => item.path === 'hooks/conquistador-hook.mjs').sha256 = sha256(altered);
  writeFileSync(file, JSON.stringify(manifest));
  assert.equal(payloadCurrent(f.installed), false);
  assert.throws(() => copyPayload(join(f.root, 'cursor'), { source: f.installed }), /incomplete or damaged/);
  assert.equal(existsSync(join(f.root, 'cursor')), false);
});

test('invalid source bytes or manifest leave the last known good installation unchanged', t => {
  const f = fixture(t);
  copyPayload(f.source);
  copyPayload(f.installed);
  const expected = readPluginManifest(productRoot, version);
  const marker = readFileSync(join(f.installed, '.conquistador-owned.json'));

  for (const path of checks) {
    const file = join(f.source, path);
    const before = readFileSync(file);

    for (const damage of ['missing', 'changed']) {
      if (damage === 'missing') rmSync(file);
      else writeFileSync(file, 'synthetic invalid source\n');
      assert.throws(() => copyPayload(f.installed, { source: f.source }), error => error.message.includes(`${damage} ${path}`));
      assert.deepEqual(invalidPayload(f.installed, expected), []);
      assert.deepEqual(readFileSync(join(f.installed, '.conquistador-owned.json')), marker);
      assert.equal(readdirSync(f.root).some(name => /^plugin\.(tmp|old)-/.test(name)), false);
      writeFileSync(file, before);
    }
  }
});

test('an invalid source does not create a destination parent or staging directory', t => {
  const f = fixture(t);
  copyPayload(f.source);
  rmSync(join(f.source, 'skills/conquistador/commands/copy/COMMAND.md'));
  const destination = join(f.root, 'not-created', 'plugin');
  assert.throws(() => copyPayload(destination, { source: f.source }), /missing skills\/conquistador\/commands\/copy\/COMMAND.md/);
  assert.equal(existsSync(dirname(destination)), false);
});

test('same-byte symlink replacement cannot pass payload health or source validation', { skip: process.platform === 'win32' && 'Symlink creation needs Windows privileges' }, t => {
  const f = fixture(t);
  copyPayload(f.installed);
  const file = join(f.installed, 'skills/conquistador/commands/copy/COMMAND.md');
  const outside = join(f.root, 'synthetic-outside.md');
  writeFileSync(outside, readFileSync(file));
  rmSync(file);
  symlinkSync(outside, file);
  assert.equal(payloadCurrent(f.installed), false);
  assert.throws(() => copyPayload(f.source, { source: f.installed }), /non-regular skills\/conquistador\/commands\/copy\/COMMAND.md/);
});

test('wrong or missing ownership version is never current', t => {
  const f = fixture(t);
  copyPayload(f.installed);
  const marker = join(f.installed, '.conquistador-owned.json');
  writeFileSync(marker, JSON.stringify({ version: '0.0.0' }));
  assert.equal(payloadCurrent(f.installed), false);
  rmSync(marker);
  assert.equal(payloadCurrent(f.installed), false);
  assert.throws(() => copyPayload(f.installed), /not created by Conquistador/);
});
