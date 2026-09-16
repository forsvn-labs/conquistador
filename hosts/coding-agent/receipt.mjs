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

export function deriveReceipt({ plan, mode, independentReview, results = [], integrated = null, integratedDigest = null, review = null, additionalGaps = [] }) {
  const isolated = mode === 'isolated-workers';
  const presentation = derivePresentation(plan, { isolated });
  const byId = new Map((results ?? []).map(result => [result.assignmentId, result]));
  const receipt = {
    schemaVersion: receiptProtocol,
    runId: plan.id,
    outcome: presentation.outcome,
    capabilities: (presentation.capabilities ?? []).map(item => ({ id: item.id, label: publicCapabilities[item.id] })),
    specialists: plan.assignments.map(task => {
      const observed = byId.get(task.id);
      return {
        assignmentId: task.id,
        label: publicSpecialistLabel(task),
        executionId: observedExecutionId(observed?.executionId),
        status: observed ? observedStatus(observed) : 'blocked',
      };
    }),
    mode,
    independentReview: isolated && independentReview === true,
    integratedDigest: integratedDigest ?? null,
    evidence: boundUnique([
      ...(presentation.evidence ?? []),
      ...[...byId.values(), integrated, review].flatMap(result => result?.evidence ?? []),
    ]),
    gaps: boundUnique([
      ...[...byId.values(), integrated, review].flatMap(result => result?.gaps ?? []),
      ...additionalGaps,
    ]),
    externalActions: [],
    humanAccepted: false,
  };
  return validateReceipt(receipt);
}

function reviewLine(receipt, { review, corrected }) {
  const digestText = receipt.integratedDigest ?? 'unavailable';
  if (!receipt.independentReview) {
    return `${review?.status ?? receipt.specialists.find(Boolean)?.status ?? 'blocked'} same-context; not independent`;
  }
  if (corrected) return `revise, then ${review?.status ?? 'blocked'} on artifact ${digestText}`;
  return `${review?.status ?? 'blocked'} on artifact ${digestText}`;
}

export function formatReceiptMarkdown(receipt, { review = null, corrected = false } = {}) {
  const validated = validateReceipt(receipt);
  const specialistCount = validated.specialists.filter(item => item.executionId).length;
  const context = validated.mode === 'isolated-workers'
    ? `${specialistCount} isolated specialist contexts, 1 parent integration, ${validated.independentReview ? '1 independent review' : 'same-context review'}`
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
    `Review: ${reviewLine(validated, { review, corrected })}`,
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
    receiptMarkdown = formatReceiptMarkdown(receipt, { review: result.review, corrected: extras.corrected === true });
  } catch {
    receiptFormatError = true;
  }
  return { ...result, receipt, receiptMarkdown, receiptFormatError, protocol };
}

export { specialistTitle, digest };
