import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostFolders, projectLifecycle, treeDigest } from './project-installation.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'runtime/bin/conquistador.js');
function fixture(t) { const project = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador project '))); t.after(() => rmSync(project, { recursive: true, force: true })); return project; }
function run(project, ...args) { return spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8' }); }
function ok(project, ...args) { const result = run(project, ...args); assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout; }

test('complete operator installs an obvious parent and each selected native skill with one owned lifecycle', t => {
  const project = fixture(t);
  for (const host of Object.keys(hostFolders)) {
    ok(project, 'install', '--host', host);
    assert.ok(existsSync(join(project, '.conquistador/SKILL.md')));
    assert.ok(existsSync(join(project, hostFolders[host], 'SKILL.md')));
    assert.ok(existsSync(join(project, hostFolders[host], 'library/write-copy/METHOD.md')));
    const bypass = spawnSync(process.execPath, [join(root, 'tools/install.mjs'), 'remove', 'single-agent', join(project, '.conquistador')], { encoding: 'utf8' });
    assert.equal(bypass.status, 1); assert.match(bypass.stderr, /owns a native skill/);
    const doctor = JSON.parse(ok(project, 'operator', 'doctor', '--json'));
    assert.equal(doctor.library.available, 38); assert.equal(doctor.bbAdapterPresent, true); assert.equal(doctor.discovery.count, 1);
    assert.match(ok(project, 'start'), /first|launch plan/);
    assert.match(ok(project, 'skills'), /Write product or campaign copy/);
    ok(project, 'operator', 'update'); ok(project, 'operator', 'uninstall');
    assert.deepEqual(readdirSync(project), []);
  }
});

test('modified native skill prevents both operator update and removal without changing either copy', t => {
  const project = fixture(t); ok(project, 'install');
  const receipt = readFileSync(join(project, '.conquistador/.conquistador-install.json'));
  const skill = join(project, '.agents/skills/conquistador/SKILL.md'); writeFileSync(skill, 'User edits');
  for (const action of ['update', 'uninstall']) {
    assert.notEqual(run(project, 'operator', action).status, 0);
    assert.deepEqual(readFileSync(join(project, '.conquistador/.conquistador-install.json')), receipt);
    assert.equal(readFileSync(skill, 'utf8'), 'User edits');
  }
  assert.equal(JSON.parse(run(project, 'operator', 'doctor', '--json').stdout).status, 'incomplete');
});

test('unowned root, native folder, and symlink destinations are preserved', t => {
  for (const location of ['.conquistador', '.agents/skills/conquistador', '.agents']) {
    const project = fixture(t); const path = join(project, location);
    mkdirSync(dirname(path), { recursive: true });
    if (location === '.agents') { const outside = fixture(t); symlinkSync(outside, path); }
    else { mkdirSync(path); writeFileSync(join(path, 'mine.txt'), 'Keep'); }
    assert.notEqual(run(project, 'install').status, 0);
    if (location !== '.agents') assert.equal(readFileSync(join(path, 'mine.txt'), 'utf8'), 'Keep');
    assert.equal(readdirSync(project).some(name => name.startsWith('.conquistador-transaction-')), false);
  }
});

test('legacy operator migration keeps an existing unchanged skill and removes the old folder only after staging', t => {
  const project = fixture(t), legacy = join(project, '.conquistador-operator');
  execFileSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', 'single-agent', legacy]);
  ok(project, 'setup', 'install', '--target', 'codex', '--project', project);
  assert.match(ok(project, 'operator', 'status'), /unchanged/);
  ok(project, 'operator', 'update');
  assert.equal(existsSync(legacy), false);
  assert.ok(existsSync(join(project, '.conquistador/SKILL.md')));
  assert.equal(JSON.parse(ok(project, 'operator', 'doctor', '--json')).library.available, 38);
  ok(project, 'operator', 'uninstall'); assert.deepEqual(readdirSync(project), []);
});

test('a conflicting current root and legacy operator require an explicit decision', t => {
  const project = fixture(t);
  execFileSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', 'single-agent', join(project, '.conquistador-operator')]);
  mkdirSync(join(project, '.conquistador')); writeFileSync(join(project, '.conquistador/runs'), 'Keep run state');
  assert.notEqual(run(project, 'operator', 'update').status, 0);
  assert.equal(readFileSync(join(project, '.conquistador/runs'), 'utf8'), 'Keep run state');
  assert.ok(existsSync(join(project, '.conquistador-operator/SKILL.md')));
});

test('legacy domain migration creates the same restricted native library and preserves an omitted method', t => {
  const project = fixture(t); const domain = join(project, 'domain.json');
  writeFileSync(domain, JSON.stringify({ schemaVersion: 'conquistador.domain-package/v1', id: 'domain:diagnosis', agentPackageSchemaVersion: 'conquistador.agent-package/v2',
    allowed: { roles: ['data-diagnosis'], skills: [], workflows: [], tools: ['host-model'], knowledgeHandles: [] } }));
  execFileSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', 'single-agent', join(project, '.conquistador-operator'), '--domain', domain]);
  ok(project, 'operator', 'update');
  const operator = join(project, '.conquistador'), skill = join(project, hostFolders.codex);
  assert.deepEqual(JSON.parse(readFileSync(join(operator, 'domain-restriction.json'))), JSON.parse(readFileSync(join(skill, 'domain-restriction.json'))));
  assert.equal(existsSync(join(skill, 'library/write-copy')), false);
  assert.ok(existsSync(join(skill, 'library/diagnose-growth/METHOD.md')));
  ok(project, 'operator', 'uninstall'); assert.deepEqual(readdirSync(project), ['domain.json']);
});

test('a symlink receipt is refused before reading it and legacy removal does not adopt a separate skill', t => {
  const project = fixture(t), native = join(project, hostFolders.codex), legacy = join(project, '.conquistador-operator');
  ok(project, 'setup', 'install', '--target', 'codex', '--project', project);
  const saved = readFileSync(join(native, '.conquistador-install.json'));
  execFileSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', 'single-agent', legacy]);
  ok(project, 'operator', 'uninstall'); assert.equal(existsSync(legacy), false);
  assert.deepEqual(readFileSync(join(native, '.conquistador-install.json')), saved);
  const external = join(project, 'outside.json'); writeFileSync(external, '{}');
  rmSync(join(native, '.conquistador-install.json')); symlinkSync(external, join(native, '.conquistador-install.json'));
  assert.notEqual(run(project, 'install').status, 0);
  assert.equal(readFileSync(external, 'utf8'), '{}');
  assert.equal(existsSync(join(project, '.conquistador')), false);
});


test('a failed second replacement rolls the operator and native skill back to their exact prior bytes', t => {
  const project = fixture(t); ok(project, 'install');
  const path = join(project, '.conquistador'), native = join(project, hostFolders.codex);
  const before = [treeDigest(path), treeDigest(native)];
  assert.throws(() => projectLifecycle(root, { action: 'update', path, project }, { rename(from, to) {
    if (to === native && from.includes('stage-')) throw Error('Injected filesystem failure');
    renameSync(from, to);
  } }), /Injected filesystem failure/);
  assert.deepEqual([treeDigest(path), treeDigest(native)], before);
  assert.equal(readdirSync(project).some(name => name.startsWith('.conquistador-transaction-')), false);
  ok(project, 'operator', 'uninstall');
});
