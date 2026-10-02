import assert from 'node:assert/strict';
import {
  boundUnique, closed, digest, identifier, labelField, protocol, publicCapabilities,
  publicSpecialists, publicSpecialistLabel, publicExecutionId, receiptProtocol, redactText,
  coordinatorIds, specialistTitle, validatePlan,
} from './contracts.mjs';

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const capabilityMethods = Object.freeze({
  positioning: ['position'],
  'launch-planning': ['campaign', 'event'],
  'conversion-copy': ['copy', 'article', 'social', 'vietnamese', 'convert', 'seo'],
  measurement: ['measure', 'funnel'],
  'paid-media': ['ads', 'results', 'budget'],
  outreach: ['outreach', 'results'],
  'creative-production': ['creative', 'video', 'results', 'watch'],
  'growth-diagnosis': ['diagnose', 'audit'],
  'product-strategy': ['pricing', 'prioritize', 'shape'],
  'product-engineering': ['ui', 'flow', 'architect', 'build', 'build', 'docs'],
  research: ['channels', 'ideas', 'factcheck'],
  brand: ['brand'],
});

function capabilitiesFor(assignments) {
  const methods = new Set(assignments.flatMap(task => task.skills));
  return Object.entries(capabilityMethods).filter(([, skills]) => skills.some(skill => methods.has(skill)))
    .map(([id]) => ({ id, label: publicCapabilities[id] }));
}

export function validateReceipt(value) {
  closed(value, [
    'schemaVersion', 'runId', 'outcome', 'capabilities', 'specialists', 'mode',
    'independentReview', 'integratedDigest', 'evidence', 'gaps', 'externalActions', 'humanAccepted',
  ], ['status']);
  assert.equal(value.schemaVersion, receiptProtocol);
  identifier(value.runId);
  assert.equal(redactText(value.runId), value.runId);
  labelField(value.outcome, 240);
  assert.equal(redactText(value.outcome), value.outcome);
  if (value.status !== undefined) assert.ok(['draft', 'revise', 'blocked'].includes(value.status));
  assert.ok(['isolated-workers', 'sequential-in-context'].includes(value.mode));
  assert.equal(typeof value.independentReview, 'boolean');
  if (value.mode === 'sequential-in-context') assert.equal(value.independentReview, false, 'Same-context review cannot claim independence');
  assert.ok(value.integratedDigest === null || digestPattern.test(value.integratedDigest), 'Invalid artifact digest');
  assert.deepEqual(value.externalActions, []);
  assert.equal(value.humanAccepted, false);
  assert.ok(Array.isArray(value.capabilities) && value.capabilities.length <= 12);
  const capabilityIds = new Set();
  for (const capability of value.capabilities) {
    closed(capability, ['id', 'label']);
    assert.ok(Object.hasOwn(publicCapabilities, capability.id), 'Unknown public capability');
    assert.equal(capability.label, publicCapabilities[capability.id]);
    assert.ok(!capabilityIds.has(capability.id));
    capabilityIds.add(capability.id);
  }
  assert.ok(Array.isArray(value.specialists) && value.specialists.length <= 12);
  const seen = new Set();
  for (const specialist of value.specialists) {
    closed(specialist, ['assignmentId', 'label', 'executionId', 'status'], ['reviewedDigest']);
    if (!coordinatorIds.includes(specialist.assignmentId)) identifier(specialist.assignmentId);
    assert.equal(redactText(specialist.assignmentId), specialist.assignmentId);
    assert.ok(['draft', 'revise', 'blocked', 'not-run'].includes(specialist.status));
    assert.ok(specialist.executionId === null || publicExecutionId(specialist.executionId) === specialist.executionId);
    if (specialist.status === 'not-run') assert.equal(specialist.executionId, null);
    assert.ok(!seen.has(specialist.assignmentId), 'Duplicate receipt specialist');
    seen.add(specialist.assignmentId);
    assert.ok(Object.values(publicSpecialists).includes(specialist.label), 'Receipt labels must use the public roster');
    if (coordinatorIds.includes(specialist.assignmentId)) assert.equal(specialist.label, publicSpecialistLabel({ id: specialist.assignmentId }));
    if (specialist.reviewedDigest !== undefined) assert.ok(specialist.reviewedDigest === null || digestPattern.test(specialist.reviewedDigest));
  }
  if (value.independentReview) {
    const lastReview = value.specialists.find(row => row.assignmentId === 'operator:final-review')
      ?? value.specialists.find(row => row.assignmentId === 'review');
    assert.ok(lastReview && lastReview.status !== 'not-run' && value.integratedDigest !== null, 'Independent review needs an observed review');
    if (lastReview.reviewedDigest !== undefined) assert.equal(lastReview.reviewedDigest, value.integratedDigest);
  }
  assert.deepEqual(value.evidence, boundUnique(value.evidence));
  assert.deepEqual(value.gaps, boundUnique(value.gaps));
  return structuredClone(value);
}

export function derivePresentation(input, { isolated }) {
  const plan = validatePlan(input);
  // Presentation strings are explicitly public caller input. Never infer them from
  // a private goal, knowledge body, method text, or model result.
  return {
    outcome: plan.presentation?.outcome ?? 'the requested draft',
    deliverable: plan.presentation?.deliverable ?? 'one integrated draft',
    capabilities: capabilitiesFor(plan.assignments),
    specialists: plan.assignments.map(task => ({ assignmentId: task.id, label: publicSpecialistLabel(task) })),
    evidence: plan.presentation?.evidence ?? [],
    review: isolated ? 'independent' : 'same-context',
  };
}

export function formatEngagementBrief(plan, { isolated }) {
  const presentation = derivePresentation(plan, { isolated });
  return [
    `Conquistador is preparing ${presentation.outcome}.`, '',
    `Planned capabilities: ${presentation.capabilities.map(item => item.label).join(', ') || 'none classified'}`,
    `Planned specialists: ${presentation.specialists.map(item => item.label).join(', ')}`,
    `Supplied evidence labels, use unverified: ${presentation.evidence.join('; ') || 'none declared'}`,
    `Review: ${isolated ? 'separate fresh-eyes review of the integrated draft' : 'same-context review in the parent thread; not independent'}`,
    `Deliverable: ${presentation.deliverable}`,
  ].join('\n');
}

function observedRow(assignment, result) {
  const ran = result && !result.skipped;
  return {
    assignmentId: assignment.id,
    label: publicSpecialistLabel(assignment),
    executionId: ran ? publicExecutionId(result.executionId) : null,
    status: ran ? result.status : 'not-run',
    reviewedDigest: ran ? result.reviewedDigest ?? null : null,
  };
}

export function deriveReceipt({
  plan, mode, results = [], integrated = null, integratedDigest = null,
  review = null, firstReview = null, finalReview = null, integration = null,
  correction = null, additionalGaps = [], status = 'blocked',
}) {
  const presentation = derivePresentation(plan, { isolated: mode === 'isolated-workers' });
  const byId = new Map(results.map(result => [result.assignmentId, result]));
  const integrationResult = integration ?? (integrated?.assignmentId === 'integrate' ? integrated : null);
  const correctionResult = correction ?? (integrated?.assignmentId === 'operator:correct' ? integrated : null);
  const initialReview = firstReview ?? (review?.assignmentId === 'review' ? review : null);
  const lastReview = finalReview ?? (review?.assignmentId === 'operator:final-review' ? review : null);
  const stages = [integrationResult, initialReview, correctionResult, lastReview].filter(Boolean);
  const observed = [...byId.values(), ...stages].filter(result => !result.skipped);
  const rows = [
    ...plan.assignments.map(task => observedRow(task, byId.get(task.id))),
    ...stages.map(result => observedRow({ id: result.assignmentId }, result)),
  ];
  const reviewed = lastReview ?? initialReview;
  const applied = plan.assignments.filter(task => {
    const result = byId.get(task.id);
    return result && !result.skipped && result.status !== 'blocked';
  });
  return validateReceipt({
    schemaVersion: receiptProtocol, runId: plan.id, status, outcome: presentation.outcome,
    capabilities: capabilitiesFor(applied), specialists: rows, mode,
    independentReview: mode === 'isolated-workers' && reviewed?.isolated === true
      && reviewed.reviewedDigest === integratedDigest && integratedDigest !== null,
    integratedDigest,
    // Counts describe observed result envelopes, not source verification. Private
    // model prose remains only in the private run result, never in this projection.
    evidence: [`${observed.length} validated assignment results; source use is not verified.`],
    gaps: boundUnique([
      ...additionalGaps,
      ...rows.filter(row => row.status === 'not-run').map(row => `${row.label} did not run because a required dependency was blocked.`),
      ...observed.filter(result => result.gaps?.length).map(result =>
        `${publicSpecialistLabel(plan.assignments.find(task => task.id === result.assignmentId) ?? { id: result.assignmentId })} reported ${result.gaps.length} limitation${result.gaps.length === 1 ? '' : 's'}; inspect the private result.`),
    ]),
    externalActions: [], humanAccepted: false,
  });
}

export function formatReceiptMarkdown(receipt) {
  const value = validateReceipt(receipt);
  const reviews = value.specialists.filter(row => ['review', 'operator:final-review'].includes(row.assignmentId));
  const ran = value.specialists.filter(row => row.status !== 'not-run');
  const lines = value.specialists.map(row => `${row.label}: ${row.status}${row.executionId ? ` (${row.executionId})` : ''}${row.reviewedDigest ? `; reviewed ${row.reviewedDigest}` : ''}`);
  return [
    'Conquistador receipt',
    `Status: ${value.status ?? 'unrecorded'}`,
    `Capability methods supplied to completed assignments: ${value.capabilities.map(item => item.label).join(', ') || 'none recorded'}`,
    ...lines,
    `Execution: ${ran.length} observed assignments; ${value.mode === 'isolated-workers' ? 'separate host contexts' : 'sequential in the parent context'}`,
    `Evidence: ${value.evidence.join('; ') || 'none recorded'}`,
    `Review: ${reviews.length === 0 ? 'not run' : `${reviews.length} ${value.independentReview ? 'independent review' : 'same-context or independence unverified'} executions`}`,
    `Final artifact digest: ${value.integratedDigest ?? 'unavailable'}`,
    `Open gaps: ${value.gaps.join('; ') || 'none recorded'}`,
    'External actions: none authorized; this receipt does not audit host tool activity',
    'Human acceptance: not recorded',
  ].join('\n');
}

export function formatReceiptJson(receipt) {
  return `${JSON.stringify(validateReceipt(receipt), null, 2)}\n`;
}

export function attachReceipt(result, plan, extras = {}) {
  const receipt = deriveReceipt({ plan, ...result, ...extras });
  let receiptMarkdown = null;
  let receiptFormatError = false;
  try { receiptMarkdown = formatReceiptMarkdown(receipt); }
  catch { receiptFormatError = true; }
  return { ...result, receipt, receiptMarkdown, receiptFormatError, protocol };
}

export { specialistTitle, digest };
