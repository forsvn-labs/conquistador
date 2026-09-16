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
  delete p.presentation;
  p.assignments[0].id = 'correct';
  assert.equal(validatePlan(p).assignments[0].id, 'correct');
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
  assert.ok(out.receipt.gaps.some(item => /reported 3 limitations/.test(item)));
  assert.equal(JSON.stringify(out.receipt).includes('pricing proof'), false);
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
  assert.deepEqual(out.receipt.specialists.map(item => item.assignmentId), ['first', 'second', 'integrate', 'review']);
  assert.deepEqual(out.receipt.specialists.map(item => item.executionId), ['thr_child1', 'thr_child2', 'thr_child3', 'thr_child4']);
  assert.deepEqual(out.receipt.specialists.map(item => item.label), ['Copy', 'Copy', 'Integration', 'Review']);
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
  assert.deepEqual(out.receipt.specialists.map(item => item.assignmentId), ['first', 'second', 'integrate', 'review', 'operator:correct', 'operator:final-review']);
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'integrate').executionId, 'thr_fix3');
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'operator:correct').executionId, 'thr_fix5');
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'review').executionId, 'thr_fix4');
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'operator:final-review').executionId, 'thr_fix6');
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'review').reviewedDigest, digest(out.integration.artifact));
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'operator:final-review').reviewedDigest, out.integratedDigest);
  assert.match(out.receiptMarkdown, /2 independent review executions/);
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
  assert.equal(out.receipt.specialists.some(item => item.assignmentId === 'review'), false);
  assert.equal(out.receipt.humanAccepted, false);
});

test('blocked pre-review receipts report the overall blocked state, not a specialist draft', async () => {
  const p = plan();
  const parent = { async execute(packet) {
    const result = resultFor(packet);
    if (packet.assignment.id === 'second') result.status = 'blocked';
    return { executionId: 'same-parent', isolated: false, result };
  } };
  const out = await runSpecialistTeam({ plan: p, root, parent });
  assert.equal(out.status, 'blocked');
  assert.equal(out.receipt.specialists[0].status, 'draft');
  assert.equal(out.receipt.specialists[1].status, 'blocked');
  assert.equal(out.receipt.specialists.some(item => item.assignmentId === 'review'), false);
  assert.match(out.receiptMarkdown, /Status: blocked[\s\S]*Review: not run/);
  assert.equal(out.receiptMarkdown.includes('Review: draft same-context'), false);
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

test('malformed specialist output is rejected and invalid receipts are rejected', () => {
  const packet = { assignment: { id: 'review' }, phase: 'review', integratedDigest: digest('current'), maxOutputBytes: 4000 };
  assert.throws(() => validateResult({ ...resultFor(packet), extra: true }, packet), /Unknown field/);
  assert.throws(() => validateResult({ ...resultFor(packet), status: 'accepted' }, packet), /human acceptance/);
  assert.throws(() => formatReceiptMarkdown({}), /Missing/);
  const receipt = deriveReceipt({
    plan: plan(), mode: 'sequential-in-context', independentReview: true,
    results: [{ assignmentId: 'first', executionId: 'parent', status: 'draft', evidence: [], gaps: [] }],
  });
  assert.equal(receipt.independentReview, false);
  assert.equal(receipt.specialists[1].status, 'not-run');
  assert.equal(receipt.integratedDigest, null);
  const overflowPlan = plan();
  overflowPlan.assignments = Array.from({ length: 11 }, (_, index) => task(`item${String.fromCharCode(97 + index)}`));
  assert.throws(() => deriveReceipt({
    plan: overflowPlan, mode: 'isolated-workers', independentReview: true, results: [],
    integration: { assignmentId: 'integrate', executionId: 'thr_i', status: 'draft', evidence: [], gaps: [] },
    review: { assignmentId: 'review', executionId: 'thr_r', status: 'draft', evidence: [], gaps: [] },
  }), /Dispatch budget/);
});

test('digest mismatch rejects the review and does not report completion', async () => {
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 1 }, async execute(packet) {
    const result = resultFor(packet);
    if (packet.phase === 'review') result.reviewedDigest = digest('stale-artifact');
    return { executionId: `thr_digest-${packet.assignment.id}`, isolated: true, result };
  } };
  await assert.rejects(runSpecialistTeam({ plan: plan(), root, host }), /exact integrated/);
});

test('raw evidence and gaps are omitted; secret-like execution ids are dropped', async () => {
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
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'integrate').status, 'draft');
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'review').status, 'revise');
  assert.equal(out.receipt.specialists.find(item => item.assignmentId === 'operator:correct').status, 'blocked');
  assert.ok(out.receipt.gaps.some(item => /Targeted correction was blocked/.test(item)));
});

test('public projection omits raw goals and arbitrary model knowledge, even without credential markers', async () => {
  const p = plan();
  p.goal = 'Private acquisition target is Example Confidential Company. Internal reasoning follows.';
  const parent = { async execute(packet) {
    return { executionId: 'parent', isolated: false, result: { ...resultFor(packet),
      evidence: ['Example Confidential Company, purchase price 4200000'], gaps: ['Internal reasoning: secretly acquire the competitor.'] } };
  } };
  const out = await runSpecialistTeam({ plan: p, root, parent });
  const visible = out.receiptMarkdown + JSON.stringify(out.receipt) + out.trace.find(event => event.type === 'team.brief').markdown;
  assert.doesNotMatch(visible, /Confidential|4200000|secretly acquire|Internal reasoning/);
  assert.match(out.integrated.artifact, /Synthetic/);
  assert.match(out.receiptMarkdown, /source use is not verified/);
  assert.doesNotMatch(out.receiptMarkdown, /supplied project sources|no live account data/);
});

test('public fields reject multiple secrets, paths, prompt residue and unsafe execution ids', () => {
  for (const text of [
    'bearer firstvalue12 and bearer secondvalue12',
    'system prompt: private policy goes here',
    'Read (/workspace/private.txt)', 'Read ~/vault/secrets.md', 'Read C:/private/secret.txt',
    'api_key="very-secret" password="also-secret"', 'https://example.invalid/?token=private',
  ]) {
    assert.equal(redactText(text), '[redacted]');
    const p = plan(); p.presentation = { ...presentation(), outcome: text };
    assert.throws(() => validatePlan(p));
  }
  const receipt = deriveReceipt({ plan: plan(), mode: 'sequential-in-context' });
  assert.throws(() => validateReceipt({ ...receipt, outcome: 'system prompt: private rules' }));
  assert.throws(() => validateReceipt({ ...receipt, specialists: [{ assignmentId: 'first', label: 'Copy', executionId: '<script>test</script>', status: 'draft' }] }));
});

test('brief describes actual assignments and review mode; receipt capabilities require completed methods', async () => {
  const p = plan(); p.presentation = presentation(); p.presentation.specialists = []; p.presentation.review = 'none';
  const parent = { async execute(packet) { return { executionId: 'parent', isolated: false,
    result: { ...resultFor(packet), status: 'blocked' } }; } };
  const out = await runSpecialistTeam({ plan: p, root, parent });
  assert.match(out.trace.find(event => event.type === 'team.brief').markdown, /Planned specialists: Copy, Copy[\s\S]*same-context review/);
  assert.deepEqual(out.receipt.capabilities, []);
  assert.equal(out.receipt.independentReview, false);
});

test('blocked dependency chains finish with not-run rows and no invented integration or review', async () => {
  const p = plan(); p.assignments[1].dependsOn = ['first']; p.assignments.push(task('third', ['second']));
  const seen = [];
  const parent = { async execute(packet) { seen.push(packet.assignment.id); return { executionId: 'parent', isolated: false,
    result: { ...resultFor(packet), status: 'blocked' } }; } };
  const out = await runSpecialistTeam({ plan: p, root, parent });
  assert.deepEqual(seen, ['first']);
  assert.equal(out.status, 'blocked');
  assert.deepEqual(out.receipt.specialists.map(row => row.status), ['blocked', 'not-run', 'not-run']);
  assert.deepEqual(out.receipt.specialists.map(row => row.executionId), ['parent', null, null]);
  assert.match(out.receiptMarkdown, /Review: not run/);
});

test('same-context correction keeps both review executions without claiming independence', async () => {
  let reviews = 0;
  const parent = { async execute(packet) { const result = resultFor(packet);
    if (packet.phase === 'review' && ++reviews === 1) result.status = 'revise';
    return { executionId: 'parent', isolated: false, result }; } };
  const out = await runSpecialistTeam({ plan: plan(), root, parent });
  assert.equal(reviews, 2);
  assert.equal(out.receipt.specialists.length, 6);
  assert.equal(out.receipt.independentReview, false);
  assert.match(out.receiptMarkdown, /2 same-context or independence unverified executions/);
});

test('accepted correction is never retried even if the host incorrectly marks the failure preDispatch', async () => {
  const p = plan(); p.limits.maxAttempts = 2; p.limits.concurrency = 1; p.limits.maxDispatches = 8;
  let corrections = 0;
  const parent = { async execute(packet, { onDispatch }) {
    const result = resultFor(packet);
    if (packet.phase === 'review') result.status = 'revise';
    if (packet.phase === 'correct') { corrections++; onDispatch('parent'); throw Object.assign(new Error('accepted failure'), { preDispatch: true }); }
    return { executionId: 'parent', isolated: false, result };
  } };
  await assert.rejects(runSpecialistTeam({ plan: p, root, parent }), /accepted failure/);
  assert.equal(corrections, 1);
});

test('final re-review rejects a stale digest and never starts a second correction', async () => {
  let corrections = 0;
  const parent = { async execute(packet) {
    const result = resultFor(packet);
    if (packet.assignment.id === 'review') result.status = 'revise';
    if (packet.phase === 'correct') { corrections++; result.artifact = 'Corrected draft.'; }
    if (packet.assignment.id === 'operator:final-review') result.reviewedDigest = digest('stale');
    return { executionId: 'parent', isolated: false, result };
  } };
  await assert.rejects(runSpecialistTeam({ plan: plan(), root, parent }), /exact integrated/);
  assert.equal(corrections, 1);
});

test('maximum dispatch plan retains every observed row including both reviews', async () => {
  const p = plan(); p.assignments = Array.from({ length: 8 }, (_, i) => task(`item${i}`)); p.limits.maxDispatches = 12;
  let count = 0;
  const host = { capabilities: { isolatedContexts: true, maxConcurrency: 4 }, async execute(packet) {
    return { executionId: `host-${++count}`, isolated: true, result: { ...resultFor(packet),
      status: packet.assignment.id === 'review' ? 'revise' : 'draft' } };
  } };
  const out = await runSpecialistTeam({ plan: p, root, host });
  assert.equal(count, 12); assert.equal(out.receipt.specialists.length, 12);
  assert.equal(out.receipt.specialists.at(-1).assignmentId, 'operator:final-review');
});

test('correction and final-review get only one attempt even on a known pre-dispatch failure', async () => {
  for (const failed of ['operator:correct', 'operator:final-review']) {
    const p = plan(); p.limits.maxAttempts = 2; p.limits.maxDispatches = 8;
    let attempts = 0;
    const parent = { async execute(packet) {
      if (packet.assignment.id === failed) { attempts++; throw Object.assign(new Error('preflight unavailable'), { preDispatch: true }); }
      return { executionId: 'parent', isolated: false, result: { ...resultFor(packet), status: packet.assignment.id === 'review' ? 'revise' : 'draft' } };
    } };
    await assert.rejects(runSpecialistTeam({ plan: p, root, parent }), /preflight unavailable/);
    assert.equal(attempts, 1);
  }
});

test('legacy user assignments named correct and final-review cannot collide with correction stages', async () => {
  const p = plan(); p.assignments = [task('correct'), task('final-review')];
  const parent = { async execute(packet) {
    return { executionId: 'parent', isolated: false, result: { ...resultFor(packet),
      status: packet.assignment.id === 'review' ? 'revise' : 'draft' } };
  } };
  const out = await runSpecialistTeam({ plan: p, root, parent });
  assert.deepEqual(out.receipt.specialists.map(row => row.assignmentId),
    ['correct', 'final-review', 'integrate', 'review', 'operator:correct', 'operator:final-review']);
  assert.deepEqual(out.receipt.specialists.map(row => row.label), ['Copy', 'Copy', 'Integration', 'Review', 'Correction', 'Final review']);
  assert.equal(out.status, 'draft');
});
