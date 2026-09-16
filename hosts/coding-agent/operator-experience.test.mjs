import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runSpecialistTeam } from './orchestrate.mjs';
import { createBbHost } from './bb.mjs';
import { digest, protocol, publicCapabilities, redactText, specialistTitle, validatePlan, validateResult } from './contracts.mjs';
import { deriveReceipt, formatEngagementBrief, formatReceiptJson, formatReceiptMarkdown, validateReceipt } from './receipt.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const task = (id, dependsOn = []) => ({ id, role: 'copy', goal: 'Write a short draft.', skills: ['write-copy'], workflows: [], knowledgeHandles: [], dependsOn });
const plan = () => ({ schemaVersion: protocol, id: 'test-team', goal: 'Prepare one coherent draft with no invented proof.',
  assignments: [task('first'), task('second')], limits: { concurrency: 2, timeoutSeconds: 10, maxAttempts: 1, maxDispatches: 6, maxOutputBytes: 4000 } });
const resultFor = packet => ({ schemaVersion: protocol, assignmentId: packet.assignment.id, status: 'draft',
  artifact: packet.phase === 'integrate' || packet.phase === 'correct' ? packet.dependencies.map(d => d.artifact).join('\n') : 'Synthetic test draft.',
  evidence: [], gaps: ['Synthetic protocol test; no live host evidence.'], reviewedDigest: packet.integratedDigest });
const presentation = () => ({
  outcome: 'the launch package',
  deliverable: 'landing-page copy, launch email, two-week campaign plan',
  capabilities: [
    { id: 'positioning', label: publicCapabilities.positioning },
    { id: 'conversion-copy', label: publicCapabilities['conversion-copy'] },
    { id: 'measurement', label: publicCapabilities.measurement },
  ],
  specialists: [
    { assignmentId: 'first', label: 'Copy' },
    { assignmentId: 'second', label: 'Copy' },
  ],
  evidence: ['docs/product.md', 'supplied analytics export'],
  review: 'independent',
});

test('plans without presentation remain valid and substantial runs emit a brief before dispatch', async () => {
  const p = plan();
  assert.equal(validatePlan(p).presentation, undefined);
  const events = [];
  const parent = { async execute(packet) {
    assert.ok(events.some(event => event.type === 'team.brief'));
    return { executionId: 'parent', isolated: false, result: resultFor(packet) };
  } };
  const out = await runSpecialistTeam({ plan: p, root, parent, onEvent: event => events.push(event) });
  assert.equal(events[0].type, 'team.started');
  assert.equal(events[1].type, 'team.brief');
  assert.match(events[1].markdown, /same-context review/);
  assert.equal(out.receipt.schemaVersion, 'conquistador.execution-receipt/v1');
  assert.equal(out.receipt.humanAccepted, false);
  assert.deepEqual(out.receipt.externalActions, []);
  assert.equal(out.independentReview, false);
  assert.match(out.receiptMarkdown, /External actions: none/);
});

test('presentation is bounded, roster-backed, and prior valid plans stay compatible', () => {
  const p = plan();
  p.presentation = presentation();
  assert.equal(validatePlan(p).presentation.review, 'independent');
  p.presentation.capabilities[0].label = 'secret routing';
  assert.throws(() => validatePlan(p), /public roster/);
  p.presentation = presentation();
  p.presentation.specialists[0].assignmentId = 'missing';
  assert.throws(() => validatePlan(p), /plan assignment/);
  p.presentation = presentation();
  p.presentation.evidence = ['docs/product.md', 'docs/product.md'];
  assert.throws(() => validatePlan(p), /already public/);
  p.presentation = presentation();
  p.presentation.evidence = [`token sk-${'abcdefghijklmnopqrstuvwxyz'}`];
  assert.throws(() => validatePlan(p), /already public/);
  p.presentation = presentation();
  p.presentation.review = 'fresh-eyes';
  assert.throws(() => validatePlan(p), /Unknown review mode/);
  p.presentation = presentation();
  p.presentation.outcome = '/Users/private/secret.md launch package';
  assert.throws(() => validatePlan(p), /secrets/);
  p.presentation = presentation();
  p.assignments[0].id = 'correct';
  assert.throws(() => validatePlan(p), /reserved/);
});

test('receipts derive host identity, redact secrets, bound duplicates, and never claim acceptance', async () => {
  const p = plan();
  p.presentation = presentation();
  const parent = { async execute(packet) {
    const result = resultFor(packet);
    result.evidence = [
      'supplied product facts',
      'supplied product facts',
      `bearer ${'secretvalue12'}`,
      '/Users/private/vault/notes.md',
      ...Array.from({ length: 20 }, (_, index) => `gap-source-${index}`),
    ];
    result.gaps = ['pricing proof', 'pricing proof', 'chain-of-thought dump'];
    return { executionId: 'same-parent', isolated: false, result };
  } };
  const out = await runSpecialistTeam({ plan: p, root, parent });
  assert.equal(out.receipt.independentReview, false);
  assert.equal(out.receipt.specialists[0].executionId, 'same-parent');
  assert.equal(out.receipt.specialists[0].label, 'Copy');
  assert.ok(out.receipt.evidence.every(item => !/bearer|\/Users\/private|sk-/.test(item)));
  assert.ok(out.receipt.evidence.length <= 12);
  assert.equal(new Set(out.receipt.evidence).size, out.receipt.evidence.length);
  assert.ok(out.receipt.gaps.includes('pricing proof'));
  assert.ok(out.receipt.gaps.some(item => item.includes('[redacted]')));
  assert.equal(out.receipt.humanAccepted, false);
  assert.throws(() => validateReceipt({ ...out.receipt, humanAccepted: true }));
  assert.throws(() => validateReceipt({ ...out.receipt, externalActions: ['publish'] }));
  assert.match(formatReceiptJson(out.receipt), /"humanAccepted": false/);
  assert.match(redactText('Use /Users/private/secret.md with bearer abcdefghij'), /\[redacted/);
});

test('same-context hosts cannot claim independent review even when the plan asked for it', async () => {
  const p = plan();
  p.presentation = presentation();
  const parent = { async execute(packet) {
    return { executionId: 'same-parent', isolated: false, result: resultFor(packet) };
  } };
  const out = await runSpecialistTeam({ plan: p, root, parent });
  assert.match(out.trace.find(event => event.type === 'team.brief').markdown, /not independent/);
  assert.equal(out.receipt.independentReview, false);
  assert.equal(out.mode, 'sequential-in-context');
});

test('isolated runs bind observed child ids and format a truthful receipt', async () => {
  const p = plan();
  p.presentation = presentation();
  let count = 0;
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 2 }, async execute(packet) {
    return { executionId: `thr_child${++count}`, isolated: true, result: resultFor(packet) };
  } };
  const out = await runSpecialistTeam({ plan: p, root, host });
  assert.equal(out.independentReview, true);
  assert.equal(out.receipt.independentReview, true);
  assert.equal(out.receipt.integratedDigest, digest(out.integrated.artifact));
  assert.deepEqual(out.receipt.specialists.map(item => item.executionId), ['thr_child1', 'thr_child2']);
  assert.match(out.receiptMarkdown, /1 independent review/);
  assert.match(formatEngagementBrief(p, { isolated: true }), /separate fresh-eyes review/);
});

test('one targeted correction follows a revise verdict, then one exact-digest re-review', async () => {
  const p = plan();
  p.limits.maxDispatches = 8;
  let reviews = 0;
  let count = 0;
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 2 }, async execute(packet) {
    const result = resultFor(packet);
    if (packet.phase === 'review' && ++reviews === 1) result.status = 'revise';
    if (packet.phase === 'correct') assert.equal(packet.dependencies[1].status, 'revise');
    if (packet.phase === 'review' && reviews > 1) assert.equal(result.reviewedDigest, packet.integratedDigest);
    return { executionId: `thr_fix${++count}`, isolated: true, result };
  } };
  const out = await runSpecialistTeam({ plan: p, root, host });
  assert.equal(count, 6);
  assert.equal(reviews, 2);
  assert.equal(out.status, 'draft');
  assert.equal(out.trace.some(event => event.type === 'team.correction'), true);
  assert.match(out.receiptMarkdown, /revise, then draft on artifact/);
});

test('correction is limited to one pass and remaining material failures stay visible', async () => {
  const p = plan();
  p.limits.maxDispatches = 8;
  let reviews = 0;
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 1 }, async execute(packet) {
    const result = resultFor(packet);
    if (packet.phase === 'review') {
      reviews += 1;
      result.status = 'revise';
      result.gaps = ['unsupported pricing claim'];
    }
    return { executionId: `thr_rev${packet.phase}-${packet.assignment.id}-${reviews}`, isolated: true, result };
  } };
  const out = await runSpecialistTeam({ plan: p, root, host });
  assert.equal(reviews, 2);
  assert.equal(out.status, 'revise');
  assert.ok(out.receipt.gaps.some(item => /Material issues remain|unsupported pricing/.test(item)));
  assert.equal(out.trace.filter(event => event.type === 'team.correction').length, 1);
  const tight = plan();
  tight.limits.maxDispatches = 4;
  let reviewOnce = false;
  const limited = { capabilities: { isolatedContexts: true, maxConcurrency: 1 }, async execute(packet) {
    const result = resultFor(packet);
    if (packet.phase === 'review') { reviewOnce = true; result.status = 'revise'; }
    return { executionId: `thr_tight-${packet.assignment.id}-${packet.phase}`, isolated: true, result };
  } };
  const skipped = await runSpecialistTeam({ plan: tight, root, host: limited });
  assert.equal(reviewOnce, true);
  assert.equal(skipped.status, 'revise');
  assert.equal(skipped.trace.some(event => event.type === 'team.correction-skipped'), true);
  assert.ok(skipped.receipt.gaps.some(item => /dispatch budget/.test(item)));
});

test('blocked specialists produce a receipt that does not report completion', async () => {
  const p = plan();
  let count = 0;
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 2 }, async execute(packet) {
    const result = resultFor(packet);
    if (packet.assignment.id === 'first') result.status = 'blocked';
    return { executionId: `thr_block${++count}`, isolated: true, result };
  } };
  const out = await runSpecialistTeam({ plan: p, root, host });
  assert.equal(out.status, 'blocked');
  assert.equal(out.independentReview, false);
  assert.equal(out.receipt.integratedDigest, null);
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'first').status, 'blocked');
  assert.equal(out.receipt.humanAccepted, false);
});

test('BB child titles use the public roster and observed thread identity', async () => {
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
  assert.equal(specialistTitle(packet.assignment), 'Conquistador: Copy');
  assert.ok(calls[0].includes('Conquistador: Copy'));
  assert.equal(calls[0].includes('codex'), false);
});

test('malformed specialist output is rejected and formatter errors do not drop JSON receipts', () => {
  const packet = { assignment: { id: 'review' }, phase: 'review', integratedDigest: digest('current'), maxOutputBytes: 4000 };
  assert.throws(() => validateResult({ ...resultFor(packet), extra: true }, packet), /Unknown field/);
  assert.throws(() => validateResult({ ...resultFor(packet), status: 'accepted' }, packet), /human acceptance/);
  assert.throws(() => formatReceiptMarkdown({}), /Missing/);
  const receipt = deriveReceipt({
    plan: plan(), mode: 'sequential-in-context', independentReview: true,
    results: [{ assignmentId: 'first', executionId: 'parent', status: 'draft', evidence: [], gaps: [] }],
  });
  assert.equal(receipt.independentReview, false);
  assert.equal(receipt.specialists[1].status, 'blocked');
  assert.equal(receipt.integratedDigest, null);
});

test('digest mismatch rejects the review and does not report completion', async () => {
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 1 }, async execute(packet) {
    const result = resultFor(packet);
    if (packet.phase === 'review') result.reviewedDigest = digest('stale-artifact');
    return { executionId: `thr_digest-${packet.assignment.id}`, isolated: true, result };
  } };
  await assert.rejects(runSpecialistTeam({ plan: plan(), root, host }), /exact integrated/);
});

test('long evidence and gaps are truncated; secret-like execution ids are dropped', async () => {
  const p = plan();
  const parent = { async execute(packet) {
    const result = resultFor(packet);
    result.gaps = [`${'unsupported pricing claim that exceeds the public receipt bound '.repeat(8)}end`];
    return { executionId: packet.assignment.id === 'first' ? `bearer ${'secretvalue12'}` : 'same-parent', isolated: false, result };
  } };
  const out = await runSpecialistTeam({ plan: p, root, parent });
  assert.equal(out.receipt.specialists[0].executionId, null);
  assert.equal(out.receipt.specialists[1].executionId, 'same-parent');
  assert.ok(out.receipt.gaps.every(item => Buffer.byteLength(item) <= 200));
  assert.equal(out.receipt.humanAccepted, false);
});

test('blocked correction keeps observed independent review and the prior integrated digest', async () => {
  const p = plan();
  p.limits.maxDispatches = 8;
  let reviews = 0;
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 1 }, async execute(packet) {
    const result = resultFor(packet);
    if (packet.phase === 'review' && ++reviews === 1) result.status = 'revise';
    if (packet.phase === 'correct') result.status = 'blocked';
    return { executionId: `thr_corr-${packet.phase}-${packet.assignment.id}`, isolated: true, result };
  } };
  const out = await runSpecialistTeam({ plan: p, root, host });
  assert.equal(out.status, 'blocked');
  assert.equal(out.receipt.independentReview, true);
  assert.equal(out.receipt.integratedDigest, digest(out.integrated.artifact));
  assert.ok(out.receipt.gaps.some(item => /Targeted correction was blocked/.test(item)));
});
