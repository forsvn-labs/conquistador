import { methodDocument, methodLibrary } from '../../tools/method-library.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { containedPath } from '../../tools/plugin-contracts.mjs';
import { assertLoadAllowed, parseRestriction, RESTRICTION_NAME } from '../../tools/domain-package.mjs';
import { loadBoundedDocuments, loadRoutingContract, prepareAssignmentResources, resolveOptionalKnowledge } from '../../tools/routing-contract.mjs';

export const protocol = 'conquistador.specialist/v1';
export const receiptProtocol = 'conquistador.execution-receipt/v1';
export const digest = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
export const roleFiles = Object.freeze(Object.fromEntries([
  'ads', 'copy', 'dr-landing', 'saas-landing', 'data-diagnosis', 'campaign-data', 'creative-assets',
].map(id => [id, `skills/conquistador/specialists/${id}-agent.md`])));
export const publicSpecialists = Object.freeze({
  ads: 'Ads',
  copy: 'Copy',
  'dr-landing': 'Direct-response landing',
  'saas-landing': 'SaaS landing',
  'data-diagnosis': 'Data diagnosis',
  'campaign-data': 'Campaign data',
  'creative-assets': 'Creative assets',
  outcome: 'Outcome',
  parent: 'Integration',
  correction: 'Correction',
  'final-review': 'Final review',
  review: 'Review',
});
export const publicCapabilities = Object.freeze({
  positioning: 'positioning',
  'launch-planning': 'launch planning',
  'conversion-copy': 'conversion copy',
  measurement: 'measurement',
  'paid-media': 'paid media',
  outreach: 'outreach',
  'creative-production': 'creative production',
  'growth-diagnosis': 'growth diagnosis',
  'product-strategy': 'product strategy',
  'product-engineering': 'product engineering',
  research: 'research',
  sales: 'sales',
  brand: 'brand',
});
export const reservedAssignmentIds = Object.freeze(['integrate', 'review']);
export const coordinatorIds = Object.freeze(['integrate', 'review', 'operator:correct', 'operator:final-review']);

export function closed(value, required, optional = []) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Expected object');
  for (const key of required) assert.ok(Object.hasOwn(value, key), `Missing ${key}`);
  for (const key of Object.keys(value)) assert.ok([...required, ...optional].includes(key), `Unknown field ${key}`);
}
export function identifier(value) {
  assert.ok(typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value), 'Expected logical identifier');
}
export function strings(values, limit = 40) {
  assert.ok(Array.isArray(values) && values.length <= limit && new Set(values).size === values.length, 'Expected unique bounded list');
  values.forEach(identifier);
}
function bounded(value, min, max) {
  assert.ok(Number.isInteger(value) && value >= min && value <= max, `Expected integer ${min}..${max}`);
}
export function textField(value, maximum = 32000) {
  assert.ok(typeof value === 'string' && value.trim().length > 0 && Buffer.byteLength(value) <= maximum, 'Expected bounded nonempty text');
}
export function labelField(value, maximum = 80) {
  textField(value, maximum);
  assert.ok(!/[\r\n]/.test(value), 'Labels must be single-line');
}

// Reject the entire public field when it resembles private content. Regexes are a
// secondary check; raw goals, knowledge, evidence and gaps never become public text.
const privateContent = /(?:sk-[a-z0-9_-]{8,}|github_pat_|gh[pousr]_[a-z0-9]{20,}|bearer\s+|PRIVATE KEY|(?:api[_-]?key|password|secret|token)\s*["']?\s*[:=]|(?:^|[\s(\[<`'"])(?:\/|~\/|[a-z]:[\\/]|file:\/\/)|(?:skills|library|agent)\/|https?:\/\/[^\s]*[?@]|chain[- ]of[- ]thought|hidden prompt|system prompt|token budget|routing score|[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069])/i;

export function redactText(value) {
  assert.ok(typeof value === 'string');
  if (privateContent.test(value)) return '[redacted]';
  return value.replace(/\s+/g, ' ').trim();
}
export function publicExecutionId(value) {
  return typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value)
    && redactText(value) === value ? value : null;
}
export function truncateText(value, maximum) {
  assert.ok(typeof value === 'string');
  let text = value;
  while (Buffer.byteLength(text) > maximum) text = text.slice(0, Math.max(0, text.length - 1));
  return text.trim();
}
export function boundUnique(values, { limit = 12, maximum = 200 } = {}) {
  assert.ok(Array.isArray(values));
  const seen = new Set();
  const out = [];
  for (const item of values) {
    if (typeof item !== 'string') continue;
    const redacted = truncateText(redactText(item), maximum);
    if (!redacted || seen.has(redacted)) continue;
    seen.add(redacted);
    out.push(redacted);
    if (out.length === limit) break;
  }
  return out;
}

export function publicSpecialistLabel(assignment) {
  const reserved = { integrate: 'Integration', review: 'Review', 'operator:correct': 'Correction', 'operator:final-review': 'Final review' };
  if (Object.hasOwn(reserved, assignment.id)) return reserved[assignment.id];
  return Object.hasOwn(publicSpecialists, assignment.role) ? publicSpecialists[assignment.role] : publicSpecialists.outcome;
}
export function specialistTitle(assignment) {
  return `Conquistador: ${publicSpecialistLabel(assignment)}`;
}

function validatePresentation(presentation, assignments) {
  closed(presentation, ['outcome', 'deliverable', 'capabilities', 'specialists', 'evidence', 'review']);
  labelField(presentation.outcome, 240);
  labelField(presentation.deliverable, 240);
  assert.ok(['independent', 'same-context', 'none'].includes(presentation.review), 'Unknown review mode');
  assert.ok(Array.isArray(presentation.capabilities) && presentation.capabilities.length <= 12);
  const capabilityIds = new Set();
  for (const capability of presentation.capabilities) {
    closed(capability, ['id', 'label']);
    identifier(capability.id);
    assert.ok(Object.hasOwn(publicCapabilities, capability.id), `Unknown public capability ${capability.id}`);
    assert.equal(capability.label, publicCapabilities[capability.id], 'Capability labels must use the public roster');
    assert.ok(!capabilityIds.has(capability.id), 'Duplicate capability');
    capabilityIds.add(capability.id);
  }
  assert.ok(Array.isArray(presentation.specialists) && presentation.specialists.length <= 12);
  const assignmentIds = new Set(assignments.map(task => task.id));
  const seen = new Set();
  for (const specialist of presentation.specialists) {
    closed(specialist, ['assignmentId', 'label']);
    identifier(specialist.assignmentId);
    assert.ok(assignmentIds.has(specialist.assignmentId), 'Presentation specialist must refer to a plan assignment');
    assert.ok(!seen.has(specialist.assignmentId), 'Duplicate presentation specialist');
    seen.add(specialist.assignmentId);
    const task = assignments.find(item => item.id === specialist.assignmentId);
    assert.equal(specialist.label, publicSpecialistLabel(task), 'Specialist labels must use the public roster');
  }
  assert.deepEqual(presentation.evidence, boundUnique(presentation.evidence), 'Evidence must be unique, bounded, and already public');
  assert.equal(redactText(presentation.outcome), presentation.outcome, 'Presentation must not include secrets');
  assert.equal(redactText(presentation.deliverable), presentation.deliverable, 'Presentation must not include secrets');
}

export function validatePlan(plan) {
  closed(plan, ['schemaVersion', 'id', 'goal', 'assignments', 'limits'], ['presentation']);
  assert.equal(plan.schemaVersion, protocol);
  identifier(plan.id); textField(plan.goal);
  assert.equal(redactText(plan.id), plan.id, 'Run id must be public');
  closed(plan.limits, ['concurrency', 'timeoutSeconds', 'maxAttempts', 'maxDispatches', 'maxOutputBytes']);
  bounded(plan.limits.concurrency, 1, 4);
  bounded(plan.limits.timeoutSeconds, 1, 1800);
  bounded(plan.limits.maxAttempts, 1, 2);
  bounded(plan.limits.maxDispatches, 3, 12);
  bounded(plan.limits.maxOutputBytes, 256, 128000);
  assert.ok(Array.isArray(plan.assignments) && plan.assignments.length > 0 && plan.assignments.length + 2 <= plan.limits.maxDispatches, 'Dispatch budget must include integration and review');
  const ids = new Set();
  for (const task of plan.assignments) {
    closed(task, ['id', 'role', 'goal', 'skills', 'workflows', 'knowledgeHandles', 'dependsOn']);
    identifier(task.id); identifier(task.role); textField(task.goal);
    assert.equal(redactText(task.id), task.id, 'Assignment id must be public');
    assert.ok(Object.hasOwn(roleFiles, task.role) || task.role === 'outcome', 'Unknown specialist role');
    assert.ok(!ids.has(task.id) && !reservedAssignmentIds.includes(task.id), 'Duplicate or reserved assignment id');
    ids.add(task.id);
    for (const field of ['skills', 'workflows', 'dependsOn']) strings(task[field]);
    assert.ok(Array.isArray(task.knowledgeHandles) && task.knowledgeHandles.length <= 20 && new Set(task.knowledgeHandles).size === task.knowledgeHandles.length, 'Invalid knowledge handles');
    for (const handle of task.knowledgeHandles) assert.ok(typeof handle === 'string' && handle.length <= 129 && /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/.test(handle), 'Expected logical knowledge handle');
    assert.ok(task.skills.length > 0, 'Assignment needs an existing outcome');
  }
  const complete = new Set();
  while (complete.size < ids.size) {
    const ready = plan.assignments.filter(t => !complete.has(t.id) && t.dependsOn.every(id => complete.has(id)));
    assert.ok(ready.length, 'Cyclic or missing assignment dependency');
    ready.forEach(t => complete.add(t.id));
  }
  if (Object.hasOwn(plan, 'presentation')) validatePresentation(plan.presentation, plan.assignments);
  return structuredClone(plan);
}

// Logical knowledge handles are resolved by the host. No vault root is part of a package.
export async function loadAssignment(root, task, { authorize = () => {}, resolveKnowledge, requiredTools = [] } = {}) {
  const restrictionPath = resolve(root, RESTRICTION_NAME);
  if (existsSync(restrictionPath)) {
    const restriction = parseRestriction(JSON.parse(readFileSync(containedPath(root, `./${RESTRICTION_NAME}`, 'file'), 'utf8')));
    if (Object.hasOwn(roleFiles, task.role)) assertLoadAllowed(restriction, { kind: 'role', name: task.role });
    if (task.role === 'parent') assertLoadAllowed(restriction, { kind: 'skill', name: 'conquistador' });
    for (const [field, kind] of [['skills', 'skill'], ['workflows', 'workflow'], ['knowledgeHandles', 'knowledgeHandle']]) {
      for (const name of task[field]) assertLoadAllowed(restriction, { kind, name });
    }
    assertLoadAllowed(restriction, { kind: 'tool', name: 'host-model' });
    for (const name of requiredTools) assertLoadAllowed(restriction, { kind: 'tool', name });
  }
  await authorize(task);
  const manifestPath = existsSync(resolve(root, 'agent/agent.json')) ? './agent/agent.json' : './agents/conquistador/agent.json';
  const manifest = JSON.parse(readFileSync(containedPath(root, manifestPath, 'file'), 'utf8'));
  assert.equal(manifest.schemaVersion, 'conquistador.agent-package/v2', 'Master execution requires v2');
  assert.ok(['.', 'skills/conquistador', 'agent/skills/conquistador'].includes(manifest.canonicalSkillRoot), 'Unsupported canonical skills layout');
  const layouts = methodLibrary(root);
  assert.equal(layouts.length, 1, 'Ambiguous or missing method library');
  const { layout: skillsRoot, internal } = layouts[0];
  const document = internal ? methodDocument : 'SKILL.md';
  const paths = [...loadRoutingContract(root).requiredStandards];
  if (task.role === 'parent') paths.push(`${skillsRoot}/conquistador/${document}`);
  else if (Object.hasOwn(roleFiles, task.role)) paths.push(roleFiles[task.role].replace(/^skills/, skillsRoot));
  for (const skill of task.skills) {
    assert.ok(manifest.mayLoadSkills.includes(skill), `Undeclared skill ${skill}`);
    paths.push(`${skillsRoot}/${skill}/${document}`);
  }
  for (const workflow of task.workflows) {
    assert.ok(manifest.mayLoadWorkflows.includes(workflow), `Undeclared workflow ${workflow}`);
    paths.push(`${skillsRoot}/conquistador/workflows/${workflow}.md`);
  }
  const extra = [];
  const deferred = [];
  for (const skill of task.skills) {
    const prepared = prepareAssignmentResources(root, skill);
    extra.push(...prepared.required.filter(path => !paths.includes(path)));
    deferred.push(...prepared.deferred);
  }
  const loaded = loadBoundedDocuments(root, [...paths, ...extra]);
  const knowledge = [];
  let contextBytes = loaded.contextBytes;
  for (const handle of task.knowledgeHandles) {
    const resolved = await resolveOptionalKnowledge(handle, { resolveKnowledge });
    if (resolved.body) {
      textField(resolved.body);
      contextBytes += Buffer.byteLength(resolved.body);
      assert.ok(contextBytes <= 196608, 'Selected knowledge exceeds context budget');
    }
    knowledge.push(resolved);
  }
  return { methods: loaded.methods, knowledge, deferred, resourceRoot: resolve(root),
    retrieval: 'Read only declared deferred paths under resourceRoot as their method requires. Follow nested contained resource links for that stage. If the host cannot read them, block that stage or split the assignment; never omit mandatory instructions.' };
}

export function validateResult(value, packet) {
  closed(value, ['schemaVersion', 'assignmentId', 'status', 'artifact', 'evidence', 'gaps', 'reviewedDigest']);
  assert.equal(value.schemaVersion, protocol);
  assert.equal(value.assignmentId, packet.assignment.id, 'Result belongs to another assignment');
  assert.ok(['draft', 'blocked', 'revise'].includes(value.status), 'A specialist cannot grant human acceptance');
  textField(value.artifact, packet.maxOutputBytes);
  for (const key of ['evidence', 'gaps']) {
    assert.ok(Array.isArray(value[key]) && value[key].length <= 30);
    value[key].forEach(item => textField(item, 4000));
  }
  assert.ok(Buffer.byteLength(JSON.stringify(value)) <= packet.maxOutputBytes, 'Result exceeds output budget');
  assert.equal(value.reviewedDigest, packet.phase === 'review' ? packet.integratedDigest : null, 'Review must bind the exact integrated artifact');
  return structuredClone(value);
}
