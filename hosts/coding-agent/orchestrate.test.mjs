import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSpecialistTeam } from './orchestrate.mjs';
import { createBbHost } from './bb.mjs';
import { digest, protocol, validatePlan, validateResult } from './contracts.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const task = (id, dependsOn = []) => ({ id, role: 'copy', goal: 'Write a short draft.', skills: ['write-copy'], workflows: [], knowledgeHandles: [], dependsOn });
const plan = () => ({ schemaVersion: protocol, id: 'test-team', goal: 'Prepare one coherent draft with no invented proof.',
  assignments: [task('first'), task('second')], limits: { concurrency: 2, timeoutSeconds: 10, maxAttempts: 1, maxDispatches: 6, maxOutputBytes: 4000 } });
const resultFor = packet => ({ schemaVersion: protocol, assignmentId: packet.assignment.id, status: 'draft',
  artifact: packet.phase === 'integrate' ? packet.dependencies.map(d => d.artifact).join('\n') : 'Synthetic test draft.',
  evidence: [], gaps: ['Synthetic protocol test; no live host evidence.'], reviewedDigest: packet.integratedDigest });

test('dependency ordering, finite concurrency, integration and exact review binding', async () => {
  const p = plan(); p.assignments.push(task('dependent', ['first', 'second']));
  let active = 0; let peak = 0; let count = 0;
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 2 }, async execute(packet) {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    if (packet.assignment.id === 'dependent') assert.equal(packet.dependencies.length, 2);
    return { executionId: `test-${++count}`, isolated: true, result: resultFor(packet) };
  } };
  const out = await runSpecialistTeam({ plan: p, root, host });
  assert.equal(peak, 2); assert.equal(count, 5);
  assert.equal(out.independentReview, true); assert.equal(out.humanAccepted, false);
  assert.equal(out.review.reviewedDigest, digest(out.integrated.artifact));
  assert.equal(out.trace.filter(e => e.type === 'assignment.finished').length, 5);
});

test('fallback calls the supplied parent sequentially and never claims independent review', async () => {
  let active = 0;
  const parent = { async execute(packet) {
    assert.equal(++active, 1); await Promise.resolve(); active--;
    return { executionId: 'same-parent', isolated: false, result: resultFor(packet) };
  } };
  const out = await runSpecialistTeam({ plan: plan(), root, parent });
  assert.equal(out.mode, 'sequential-in-context'); assert.equal(out.independentReview, false);
  await assert.rejects(runSpecialistTeam({ plan: plan(), root }), /explicit host callback/);
});

test('rejects unknown roles, dependency cycles, reuse of isolated context and stale reviews', async () => {
  const p = plan(); p.assignments[0].role = '../private';
  assert.throws(() => validatePlan(p), /identifier/);
  p.assignments[0] = task('first', ['second']); p.assignments[1].dependsOn = ['first'];
  assert.throws(() => validatePlan(p), /Cyclic/);
  const packet = { assignment: { id: 'review' }, phase: 'review', integratedDigest: digest('current'), maxOutputBytes: 4000 };
  assert.throws(() => validateResult({ ...resultFor(packet), reviewedDigest: digest('old') }, packet), /exact integrated/);
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 1 }, async execute(packet) {
    return { executionId: 'reused', isolated: true, result: resultFor(packet) };
  } };
  await assert.rejects(runSpecialistTeam({ plan: plan(), root, host }), /reused/);
});

test('preflight refuses unknown knowledge and domain denials before any dispatch', async () => {
  let called = false;
  const parent = { execute() { called = true; } };
  const p = plan(); p.assignments[0].knowledgeHandles = ['project:private-source'];
  await assert.rejects(runSpecialistTeam({ plan: p, root, parent }), /Missing knowledge connection/);
  await assert.rejects(runSpecialistTeam({ plan: plan(), root, parent, authorize: () => { throw new Error('domain denied'); } }), /domain denied/);
  assert.equal(called, false);
});

test('only known pre-dispatch failures retry, and cancellation reaches running siblings', async () => {
  const p = plan(); p.limits.maxAttempts = 2;
  let count = 0;
  const parent = { async execute(packet) {
    if (++count === 1) throw Object.assign(new Error('unavailable before dispatch'), { preDispatch: true });
    return { executionId: 'parent', isolated: false, result: resultFor(packet) };
  } };
  await runSpecialistTeam({ plan: p, root, parent }); assert.equal(count, 5);
  count = 0;
  parent.execute = async () => { count++; throw new Error('unknown dispatch'); };
  await assert.rejects(runSpecialistTeam({ plan: p, root, parent }), /unknown dispatch/); assert.equal(count, 1);
  let cancelled = false;
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 2 }, async execute(packet, { signal }) {
    if (packet.assignment.id === 'first') { await Promise.resolve(); throw new Error('failed'); }
    await new Promise(resolve => signal.addEventListener('abort', () => { cancelled = true; resolve(); }, { once: true }));
    throw new Error('cancelled');
  } };
  await assert.rejects(runSpecialistTeam({ plan: p, root, host })); assert.equal(cancelled, true);
});

test('BB adapter uses explicit project/parent, checks identity, and stops a failed child', async () => {
  const calls = [];
  const packet = { assignment: task('copy'), phase: 'work', maxOutputBytes: 4000, integratedDigest: null };
  const config = { projectId: 'proj_test', environmentId: 'env_test', parentThreadId: 'thr_parent' };
  const cli = async args => {
    calls.push(args);
    if (args[1] === 'spawn') return { thread: { id: 'thr_child' } };
    if (args[1] === 'show') return { thread: { id: 'thr_child', projectId: config.projectId, environmentId: config.environmentId, parentThreadId: config.parentThreadId, status: 'idle' } };
    if (args[1] === 'output') return { output: JSON.stringify(resultFor(packet)) };
    return {};
  };
  const host = createBbHost({ ...config, cli });
  const out = await host.execute(packet, { signal: new AbortController().signal });
  assert.equal(out.executionId, 'thr_child');
  assert.ok(calls[0].includes('--parent-thread')); assert.ok(calls[0].includes('proj_test'));
  const bad = createBbHost({ ...config, cli: args => args[1] === 'output' ? Promise.resolve({ output: 'not JSON' }) : cli(args) });
  await assert.rejects(bad.execute(packet, { signal: new AbortController().signal }));
  assert.ok(calls.some(args => args[1] === 'stop'));
});

test('cancellation joins the underlying host cleanup and reports unresolved dispatches', async () => {
  const controller = new AbortController();
  let cleaned = false;
  const parent = { cleanupTimeoutMs: 100, execute: async (_packet, { signal }) => {
    controller.abort();
    assert.equal(signal.aborted, true);
    await new Promise(resolve => setTimeout(resolve, 15)); cleaned = true;
    throw new Error('cancelled after cleanup');
  } };
  await assert.rejects(runSpecialistTeam({ plan: plan(), root, parent, signal: controller.signal }));
  assert.equal(cleaned, true);
  const stuck = { cleanupTimeoutMs: 10, execute: () => new Promise(() => {}) };
  const stop = new AbortController();
  const pending = runSpecialistTeam({ plan: plan(), root, parent: stuck, signal: stop.signal });
  setTimeout(() => stop.abort(), 20);
  await assert.rejects(pending, error => error.unresolved?.[0].assignmentId === 'first');
});

test('BB never stops an unverified parent or foreign child returned by spawn', async () => {
  for (const returnedId of ['thr_parent', 'thr_foreign']) {
    const calls = [];
    const host = createBbHost({ projectId: 'proj_test', environmentId: 'env_test', parentThreadId: 'thr_parent', cli: async args => {
      calls.push(args);
      if (args[1] === 'spawn') return { id: returnedId };
      if (args[1] === 'show') return { thread: { id: returnedId, parentThreadId: 'thr_other', projectId: 'proj_other', environmentId: 'env_other', status: 'active' } };
      return {};
    } });
    await assert.rejects(host.execute({ assignment: task('copy'), maxOutputBytes: 4000 }, { signal: new AbortController().signal }));
    assert.equal(calls.some(args => args[1] === 'stop'), false);
  }
});

test('BB rechecks ownership before cleanup and records missing spawn identities', async () => {
  const packet = { assignment: task('copy'), maxOutputBytes: 4000 };
  const config = { projectId: 'proj_test', environmentId: 'env_test', parentThreadId: 'thr_parent' };
  const calls = [];
  let inspections = 0;
  const transferred = createBbHost({ ...config, cli: async args => {
    calls.push(args);
    if (args[1] === 'spawn') return { id: 'thr_child' };
    if (args[1] === 'show') return { thread: { id: 'thr_child', projectId: config.projectId,
      environmentId: config.environmentId, parentThreadId: ++inspections === 1 ? config.parentThreadId : 'thr_foreign', status: 'idle' } };
    if (args[1] === 'output') return { output: 'invalid JSON' };
    return {};
  } });
  await assert.rejects(transferred.execute(packet, { signal: new AbortController().signal }),
    error => error.unverifiedChildId === 'thr_child');
  assert.equal(calls.some(args => args[1] === 'stop'), false);
  for (const response of [null, {}, { id: '../bad' }, { thread: { id: null } }]) {
    const unknown = createBbHost({ ...config, cli: async args => {
      assert.equal(args[1], 'spawn'); return response;
    } });
    await assert.rejects(unknown.execute(packet, { signal: new AbortController().signal }),
      error => error.unverifiedChildId === 'unknown-spawn');
  }
});

test('installed plugin and harness loaders enforce domain restrictions during execution', async () => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-domain-execution-')));
  try {
    const manifest = join(temporary, 'domain.json');
    writeFileSync(manifest, JSON.stringify({ schemaVersion: 'conquistador.domain-package/v1', id: 'domain:copy',
      agentPackageSchemaVersion: 'conquistador.agent-package/v2', allowed: {
        roles: [], skills: ['write-copy'], workflows: [], tools: ['host-model'], knowledgeHandles: [],
      } }));
    for (const mode of ['plugin', 'single-agent']) {
      const installed = join(temporary, mode);
      execFileSync(process.execPath, [join(root, 'tools/install.mjs'), 'install', mode, installed, '--domain', manifest]);
      const installedModule = await import(join(installed, 'hosts/coding-agent/orchestrate.mjs'));
      const p = plan(); p.assignments = [{ ...task('copy'), role: 'outcome' }];
      const parent = { async execute(packet) { return { executionId: 'parent', isolated: false, result: resultFor(packet) }; } };
      const out = await installedModule.runSpecialistTeam({ plan: p, root: installed, parent });
      assert.equal(out.mode, 'sequential-in-context');
      const skillRoot = mode === 'plugin' ? 'skills' : 'agent/skills';
      cpSync(join(root, 'skills/create-paid-campaign'), join(installed, skillRoot, 'create-paid-campaign'), { recursive: true });
      p.assignments[0].skills = ['create-paid-campaign'];
      await assert.rejects(installedModule.runSpecialistTeam({ plan: p, root: installed, parent }), /Domain restriction forbids skill/);
      p.assignments[0].skills = ['write-copy'];
      await assert.rejects(installedModule.runSpecialistTeam({ plan: p, root: installed,
        host: { ...parent, capabilities: { isolatedContexts: true, maxConcurrency: 1 } } }), /host-worker-context/);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
