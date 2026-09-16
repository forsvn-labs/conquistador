import assert from 'node:assert/strict';
import {
  boundUnique, closed, digest, identifier, labelField, protocol, publicCapabilities,
  publicSpecialists, publicSpecialistLabel, receiptProtocol, redactText, specialistTitle,
  truncateText,
} from './contracts.mjs';

const digestPattern = /^sha256:[a-f0-9]{64}$/;

export function validateReceipt(value) {
  closed(value, [
    'schemaVersion', 'runId', 'outcome', 'capabilities', 'specialists', 'mode',
    'independentReview', 'integratedDigest', 'evidence', 'gaps', 'externalActions', 'humanAccepted',
  ]);
  assert.equal(value.schemaVersion, receiptProtocol);
  identifier(value.runId);
  labelField(value.outcome, 240);
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
    identifier(capability.id);
    assert.ok(Object.hasOwn(publicCapabilities, capability.id), `Unknown public capability ${capability.id}`);
    assert.equal(capability.label, publicCapabilities[capability.id]);
    assert.ok(!capabilityIds.has(capability.id));
    capabilityIds.add(capability.id);
  }
  assert.ok(Array.isArray(value.specialists) && value.specialists.length <= 12);
  const seen = new Set();
  for (const specialist of value.specialists) {
    closed(specialist, ['assignmentId', 'label', 'executionId', 'status']);
    identifier(specialist.assignmentId);
    labelField(specialist.label, 80);
    assert.ok(['draft', 'revise', 'blocked'].includes(specialist.status));
    assert.ok(specialist.executionId === null || (typeof specialist.executionId === 'string' && specialist.executionId.length > 0 && specialist.executionId.length <= 80 && redactText(specialist.executionId) === specialist.executionId));
    assert.ok(!seen.has(specialist.assignmentId), 'Duplicate receipt specialist');
    seen.add(specialist.assignmentId);
    assert.ok(Object.values(publicSpecialists).includes(specialist.label), 'Receipt labels must use the public roster');
    assert.equal(redactText(specialist.label), specialist.label);
  }
  assert.deepEqual(value.evidence, boundUnique(value.evidence));
  assert.deepEqual(value.gaps, boundUnique(value.gaps));
  return structuredClone(value);
}

export function derivePresentation(plan, { isolated }) {
  const review = isolated ? 'independent' : 'same-context';
  if (plan.presentation) {
    const presentation = structuredClone(plan.presentation);
    if (presentation.review === 'independent' && !isolated) presentation.review = 'same-context';
    return presentation;
  }
  return {
    outcome: truncateText(redactText(plan.goal), 240) || plan.id,
    deliverable: 'one integrated draft',
    capabilities: [],
    specialists: plan.assignments.map(task => ({ assignmentId: task.id, label: publicSpecialistLabel(task) })),
    evidence: [],
    review,
  };
}

export function formatEngagementBrief(plan, { isolated }) {
  const presentation = derivePresentation(plan, { isolated });
  const reviewText = {
    independent: 'separate fresh-eyes review of the integrated draft',
    'same-context': 'same-context review in the parent thread; not independent',
    none: 'no separate review',
  }[presentation.review];
  const specialists = presentation.specialists.length
    ? presentation.specialists.map(item => item.label).join(', ')
    : 'direct parent work';
  const capabilities = presentation.capabilities.length
    ? presentation.capabilities.map(item => item.label).join(', ')
    : 'selected for the requested outcome';
  const evidence = presentation.evidence.length ? presentation.evidence.join('; ') : 'supplied request context';
  return [
    `Conquistador is preparing ${presentation.outcome}.`,
    '',
    `Capabilities: ${capabilities}`,
    `Specialists: ${specialists}`,
    `Evidence: ${evidence}`,
    `Review: ${reviewText}`,
    `Deliverable: ${presentation.deliverable}`,
  ].join('\n');
}

function observedStatus(result) {
  return ['draft', 'revise', 'blocked'].includes(result?.status) ? result.status : 'blocked';
}
function observedExecutionId(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 80) return null;
  return redactText(value) === value ? value : null;
}

const coordinatorIds = Object.freeze(['integrate', 'review', 'correct']);

function observedRow(assignment, result) {
  return {
    assignmentId: assignment.id,
    label: publicSpecialistLabel(assignment),
    executionId: observedExecutionId(result?.executionId),
    status: result ? observedStatus(result) : 'blocked',
  };
}

export function deriveReceipt({
  plan, mode, independentReview, results = [], integrated = null, integratedDigest = null,
  review = null, integration = null, correction = null, additionalGaps = [],
}) {
  const isolated = mode === 'isolated-workers';
  const presentation = derivePresentation(plan, { isolated });
  const byId = new Map((results ?? []).map(result => [result.assignmentId, result]));
  const integrationResult = integration ?? (integrated?.assignmentId === 'integrate' ? integrated : null);
  const correctionResult = correction ?? (integrated?.assignmentId === 'correct' ? integrated : null);
  const planRows = plan.assignments.map(task => observedRow(task, byId.get(task.id)));
  const coordinatorRows = [];
  if (integrationResult) coordinatorRows.push(observedRow({ id: 'integrate', role: 'parent' }, integrationResult));
  if (correctionResult) coordinatorRows.push(observedRow({ id: 'correct', role: 'parent' }, correctionResult));
  if (review) coordinatorRows.push(observedRow({ id: 'review', role: 'outcome' }, review));
  assert.ok(planRows.length <= 12, 'Plan specialists exceed receipt bound');
  assert.ok(planRows.length + coordinatorRows.length <= 12, 'Receipt cannot drop plan specialists to fit coordinator rows');
  const receipt = {
    schemaVersion: receiptProtocol,
    runId: plan.id,
    outcome: presentation.outcome,
    capabilities: (presentation.capabilities ?? []).map(item => ({ id: item.id, label: publicCapabilities[item.id] })),
    specialists: [...planRows, ...coordinatorRows],
    mode,
    independentReview: isolated && independentReview === true,
    integratedDigest: integratedDigest ?? null,
    evidence: boundUnique([
      ...(presentation.evidence ?? []),
      ...[...byId.values(), integrationResult, correctionResult, integrated, review].flatMap(result => result?.evidence ?? []),
    ]),
    gaps: boundUnique([
      ...[...byId.values(), integrationResult, correctionResult, integrated, review].flatMap(result => result?.gaps ?? []),
      ...additionalGaps,
    ]),
    externalActions: [],
    humanAccepted: false,
  };
  return validateReceipt(receipt);
}

function reviewLine(receipt, { review, corrected, status }) {
  const digestText = receipt.integratedDigest ?? 'unavailable';
  const reviewRow = receipt.specialists.find(item => item.assignmentId === 'review');
  const overall = status ?? review?.status ?? reviewRow?.status ?? 'blocked';
  if (!review && !reviewRow) {
    return receipt.independentReview ? `${overall}; no separate review` : `${overall} same-context; not independent`;
  }
  const reviewStatus = review?.status ?? reviewRow?.status ?? overall;
  if (!receipt.independentReview) return `${reviewStatus} same-context; not independent`;
  if (corrected) return `revise, then ${reviewStatus} on artifact ${digestText}`;
  return `${reviewStatus} on artifact ${digestText}`;
}

export function formatReceiptMarkdown(receipt, { review = null, corrected = false, status = null } = {}) {
  const validated = validateReceipt(receipt);
  const planCount = validated.specialists.filter(item => item.executionId && !coordinatorIds.includes(item.assignmentId)).length;
  const hasIntegration = validated.specialists.some(item => item.assignmentId === 'integrate');
  const hasCorrection = validated.specialists.some(item => item.assignmentId === 'correct');
  const hasReview = validated.specialists.some(item => item.assignmentId === 'review');
  const context = validated.mode === 'isolated-workers'
    ? `${planCount} isolated specialist contexts${hasIntegration ? ', 1 parent integration' : ''}${hasCorrection ? ', 1 correction' : ''}, ${validated.independentReview ? '1 independent review' : (hasReview ? 'same-context review' : 'no separate review')}`
    : 'sequential in the parent context; review is not independent';
  const evidence = validated.evidence.length
    ? `${validated.evidence.length} supplied project sources; no live account data`
    : 'no live account data';
  const gaps = validated.gaps.length ? validated.gaps.join('; ') : 'none recorded';
  return [
    'Conquistador receipt',
    `Capabilities used: ${validated.capabilities.length ? validated.capabilities.map(item => item.label).join(', ') : 'parent-selected'}`,
    `Specialists run: ${validated.specialists.map(item => item.label).join(', ') || 'none'}`,
    `Execution: ${context}`,
    `Evidence used: ${evidence}`,
    `Review: ${reviewLine(validated, { review, corrected, status })}`,
    `Open gaps: ${gaps}`,
    'External actions: none',
  ].join('\n');
}

export function formatReceiptJson(receipt) {
  return `${JSON.stringify(validateReceipt(receipt), null, 2)}\n`;
}

export function attachReceipt(result, plan, extras = {}) {
  const receipt = deriveReceipt({ plan, ...result, ...extras });
  let receiptMarkdown = null;
  let receiptFormatError = false;
  try {
    receiptMarkdown = formatReceiptMarkdown(receipt, {
      review: result.review, corrected: extras.corrected === true, status: result.status,
    });
  } catch {
    receiptFormatError = true;
  }
  return { ...result, receipt, receiptMarkdown, receiptFormatError, protocol };
}

export { specialistTitle, digest };
