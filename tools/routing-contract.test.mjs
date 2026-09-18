import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadAssignment } from '../hosts/coding-agent/contracts.mjs';
import {
  ASSIGNMENT_BUDGET_BYTES, buildRoutingContract, loadRoutingContract, prepareAssignmentResources,
} from './routing-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outcomes = readdirSync(join(root, 'skills')).filter(name => name !== 'conquistador').sort();

test('routing contract describes all 38 methods with required and deferred resources', () => {
  const contract = loadRoutingContract(root);
  assert.equal(Object.keys(contract.methods).sort().join(','), outcomes.join(','));
  assert.equal(outcomes.length, 38);
  assert.ok(contract.parentMethods['connect-accounts']);
  for (const name of outcomes) {
    const method = contract.methods[name];
    assert.ok(method.path.endsWith(`/${name}/SKILL.md`));
    assert.ok(Array.isArray(method.requiredResources));
    assert.ok(Array.isArray(method.conditionalResources));
    assert.ok(method.explicitOnly === (name === 'submit-feedback'));
  }
});

test('every method prepares a bounded assignment without recursive overflow', async () => {
  const failingBefore = ['brief-creative', 'create-brand', 'create-shortform', 'optimize-search', 'research-positioning'];
  for (const name of outcomes) {
    const prepared = prepareAssignmentResources(root, name);
    assert.ok(prepared.required.includes(`skills/${name}/SKILL.md`));
    const loaded = await loadAssignment(root, {
      id: 'work', role: 'outcome', goal: 'Produce a bounded draft.',
      skills: [name], workflows: [], knowledgeHandles: [], dependsOn: [],
    });
    assert.ok(loaded.methods.some(item => item.path === `skills/${name}/SKILL.md`));
    const bytes = loaded.methods.reduce((sum, item) => sum + Buffer.byteLength(item.body), 0);
    assert.ok(bytes <= ASSIGNMENT_BUDGET_BYTES, `${name} loaded ${bytes} bytes`);
    assert.ok(loaded.methods.length <= 100, `${name} loaded ${loaded.methods.length} files`);
    assert.ok(Array.isArray(loaded.deferred));
    if (failingBefore.includes(name)) {
      assert.ok(loaded.deferred.length > 0, `${name} must list deferred resources instead of loading the tree`);
    }
  }
});

test('rebuilding the contract from overlay stays layout-faithful', () => {
  const built = buildRoutingContract(root);
  assert.equal(Object.keys(built.methods).length, 38);
  assert.ok(built.methods['write-copy'].requiredResources.some(path => path.includes('fallbacks/')));
});

test('all 38 methods load in fresh operator and plugin payloads with reachable deferred resources', async t => {
  const { mkdtempSync, realpathSync, rmSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'routing payload matrix ')));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  for (const mode of ['single-agent', 'plugin']) {
    const target = join(parent, mode);
    execFileSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', mode, target]);
    const { loadAssignment: installedLoad } = await import(pathToFileURL(join(target, 'hosts/coding-agent/contracts.mjs')));
    for (const name of outcomes) {
      const loaded = await installedLoad(target, { id: 'work', role: 'outcome', goal: 'Draft within scope.', skills: [name], workflows: [], knowledgeHandles: [], dependsOn: [] });
      assert.ok(loaded.methods.reduce((n, item) => n + Buffer.byteLength(item.body), 0) <= ASSIGNMENT_BUDGET_BYTES, name);
      for (const item of loaded.deferred) assert.ok(existsSync(join(target, item.path)), item.path);
    }
  }
});

test('private knowledge resolver stays inside the explicit index scope and labels missing sources', async t => {
  const { mkdtempSync, realpathSync, writeFileSync, rmSync, symlinkSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { createKnowledgeResolver } = await import('./knowledge-index.mjs');
  const { resolveOptionalKnowledge } = await import('./routing-contract.mjs');
  const folder = realpathSync(mkdtempSync(join(tmpdir(), 'knowledge resolver ')));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const file = join(folder, 'index.json');
  const entry = { handle: 'project:facts', source: 'Product brief', scope: 'launch draft', freshness: '2026-09-18', path: 'facts.md' };
  const save = item => writeFileSync(file, JSON.stringify({ schemaVersion: 'conquistador.knowledge-index/v1', handles: [item] }));
  save(entry);
  writeFileSync(join(folder, 'facts.md'), 'The preview is draft only.');
  const resolver = createKnowledgeResolver(file, { productRoot: root });
  const found = await resolveOptionalKnowledge('project:facts', { resolveKnowledge: resolver });
  assert.equal(found.status, 'resolved');
  assert.match(found.body, /Scope: launch draft/);
  assert.equal(found.body.includes(folder), false);
  assert.equal((await resolveOptionalKnowledge('project:unlisted', { resolveKnowledge: resolver })).status, 'missing-source');
  rmSync(join(folder, 'facts.md'));
  symlinkSync(join(root, 'README.md'), join(folder, 'facts.md'));
  assert.equal((await resolveOptionalKnowledge('project:facts', { resolveKnowledge: resolver })).status, 'missing-source');
  save({ ...entry, path: '../outside.md' });
  assert.throws(() => createKnowledgeResolver(file, { productRoot: root }));
});
