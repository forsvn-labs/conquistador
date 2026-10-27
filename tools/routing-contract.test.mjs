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
const outcomes = readdirSync(join(root, 'skills/conquistador/commands')).filter(name => !name.startsWith('.')).sort();
// Meta commands (init, pin, check, ...) carry no routed method resources or agent declarations.
const routable = outcomes.filter(name => loadRoutingContract(root).methods[name]?.kind !== 'meta');

test('routing contract describes all 35 commands with required and deferred resources', () => {
  const contract = loadRoutingContract(root);
  assert.equal(Object.keys(contract.methods).sort().join(','), outcomes.join(','));
  assert.ok(outcomes.length >= 35);
  assert.ok(contract.parentMethods['connect-accounts']);
  for (const name of outcomes) {
    const method = contract.methods[name];
    assert.ok(method.path.endsWith(`/commands/${name}/COMMAND.md`));
    assert.ok(Array.isArray(method.requiredResources));
    assert.ok(Array.isArray(method.conditionalResources));
    assert.ok(method.explicitOnly === (name === 'feedback' || method.kind === 'meta'));
  }
});


test('every method prepares a bounded assignment without recursive overflow', async () => {
  const failingBefore = ['creative', 'brand', 'video', 'seo', 'position'];
  for (const name of routable) {
    const prepared = prepareAssignmentResources(root, name);
    assert.ok(prepared.required.includes(`skills/conquistador/commands/${name}/COMMAND.md`));
    const loaded = await loadAssignment(root, {
      id: 'work', role: 'outcome', goal: 'Produce a bounded draft.',
      skills: [name], workflows: [], knowledgeHandles: [], dependsOn: [],
    });
    assert.ok(loaded.methods.some(item => item.path === `skills/conquistador/commands/${name}/COMMAND.md`));
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
  assert.equal(Object.keys(built.methods).length, outcomes.length);
  // convert is a pass-through now (thin by default) and declares no required resource; architect keeps its fallback.
  assert.ok(built.methods['architect'].requiredResources.some(path => path.includes('fallbacks/')));
  assert.ok(built.methods['convert'].conditionalResources.some(path => path.includes('fallbacks/')));
});

test('all 35 commands load in fresh operator and plugin payloads with reachable deferred resources', async t => {
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
    for (const name of routable) {
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

// Failure modes for the generated contract's size and its compact conditions:
// S1 the contract or overlay grows past a reader's limit (doctor, MCP read, loader) and that reader refuses it;
// S2 it creeps to the limit with no warning, so the next routing change hits the wall;
// S3 an entry that omits its condition loads without one (in memory or from an older, expanded contract);
// S4 a condition that differs from the default loses its own text;
// S5 an entry omits its condition while the contract declares no default.
test('routing contract and overlay stay 10% under the smallest limit that reads them', async () => {
  const { readFileSync } = await import('node:fs');
  const { LIMITS } = await import('./skills-mcp.mjs');
  const { DIAGNOSTIC_FILE_LIMIT } = await import('./installation-doctor.mjs');
  const { CONTRACT_READ_LIMIT, RESOURCE_READ_LIMIT } = await import('./routing-contract.mjs');
  const files = {
    'skills/conquistador/routing-contract.json': [LIMITS.file, DIAGNOSTIC_FILE_LIMIT, CONTRACT_READ_LIMIT],
    'skills/conquistador/routing-overlay.json': [LIMITS.file, DIAGNOSTIC_FILE_LIMIT, RESOURCE_READ_LIMIT],
  };
  for (const [path, limits] of Object.entries(files)) {
    assert.ok(limits.every(Number.isInteger), `${path} limits must be numbers`);
    const smallest = Math.min(...limits);
    const bytes = Buffer.byteLength(readFileSync(join(root, path)));
    assert.ok(bytes <= smallest * 0.9, `${path} is ${bytes} bytes, within 10% of the ${smallest}-byte read limit`);
  }
  const built = Buffer.byteLength(`${JSON.stringify(buildRoutingContract(root), null, 2)}\n`);
  assert.ok(built <= Math.min(LIMITS.file, DIAGNOSTIC_FILE_LIMIT, CONTRACT_READ_LIMIT) * 0.9, `built contract is ${built} bytes`);
});

test('the contract states the default resource condition once and loads it into every entry', async () => {
  const { validateRoutingContract } = await import('./routing-contract.mjs');
  const built = buildRoutingContract(root);
  const fallback = built.defaultResourceCondition;
  assert.equal(typeof fallback, 'string');
  assert.ok(fallback.length > 20);
  const entries = Object.values(built.methods).flatMap(method => method.resourceConditions);
  assert.ok(entries.some(item => item.when === undefined), 'default conditions are omitted from entries');
  assert.ok(!entries.some(item => item.when === fallback), 'no entry repeats the default condition');
  // S4: own conditions keep their text.
  assert.ok(entries.some(item => item.when?.startsWith('Mode video.')));
  // S3: loaded entries always carry a condition, and the same paths as conditionalResources.
  const loaded = loadRoutingContract(root);
  for (const method of Object.values(loaded.methods)) {
    assert.deepEqual(method.resourceConditions.map(item => item.path), method.conditionalResources, method.name);
    for (const item of method.resourceConditions) assert.equal(typeof item.when, 'string', `${method.name} ${item.path}`);
  }
  assert.equal(loaded.methods.copy.resourceConditions.filter(item => item.when === fallback).length,
    built.methods.copy.resourceConditions.filter(item => item.when === undefined).length);
  const prepared = prepareAssignmentResources(root, 'copy');
  for (const item of prepared.deferred.filter(value => value.phase === 'conditional')) assert.equal(typeof item.when, 'string');
  // S5: an omitted condition needs a declared default.
  const broken = structuredClone(built);
  delete broken.defaultResourceCondition;
  assert.throws(() => validateRoutingContract(broken), /condition/i);
  // S3: an older contract with every condition written out still validates.
  const expanded = structuredClone(loaded);
  delete expanded.defaultResourceCondition;
  assert.doesNotThrow(() => validateRoutingContract(expanded));
});
