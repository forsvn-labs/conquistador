import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { containedPath } from '../../tools/plugin-contracts.mjs';
import { assertLoadAllowed, parseRestriction, RESTRICTION_NAME } from '../../tools/domain-package.mjs';

export const protocol = 'conquistador.specialist/v1';
export const digest = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
export const roleFiles = Object.freeze(Object.fromEntries([
  'ads', 'copy', 'dr-landing', 'saas-landing', 'data-diagnosis', 'campaign-data', 'creative-assets',
].map(id => [id, `skills/conquistador/specialists/${id}-agent.md`])));

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

export function validatePlan(plan) {
  closed(plan, ['schemaVersion', 'id', 'goal', 'assignments', 'limits']);
  assert.equal(plan.schemaVersion, protocol);
  identifier(plan.id); textField(plan.goal);
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
    assert.ok(Object.hasOwn(roleFiles, task.role) || task.role === 'outcome', 'Unknown specialist role');
    assert.ok(!ids.has(task.id) && !['integrate', 'review'].includes(task.id), 'Duplicate or reserved assignment id');
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
  const skillsRoot = posix.dirname(manifest.canonicalSkillRoot);
  assert.ok(['skills', 'agent/skills'].includes(skillsRoot), 'Unsupported canonical skills layout');
  const paths = [];
  if (task.role === 'parent') paths.push(`${skillsRoot}/conquistador/SKILL.md`);
  else if (Object.hasOwn(roleFiles, task.role)) paths.push(roleFiles[task.role].replace(/^skills/, skillsRoot));
  for (const skill of task.skills) {
    assert.ok(manifest.mayLoadSkills.includes(skill), `Undeclared skill ${skill}`);
    paths.push(`${skillsRoot}/${skill}/SKILL.md`);
  }
  for (const workflow of task.workflows) {
    assert.ok(manifest.mayLoadWorkflows.includes(workflow), `Undeclared workflow ${workflow}`);
    paths.push(`${skillsRoot}/conquistador/workflows/${workflow}.md`);
  }
  const methods = [];
  const seen = new Set();
  let contextBytes = 0;
  for (let index = 0; index < paths.length; index++) {
    const path = paths[index];
    if (seen.has(path)) continue;
    seen.add(path);
    const body = readFileSync(containedPath(root, `./${path}`, 'file'), 'utf8');
    contextBytes += Buffer.byteLength(body);
    assert.ok(contextBytes <= 196608 && seen.size <= 100, 'Selected method context exceeds budget');
    methods.push({ path, body });
    // Load contained outcome agents and references, without following links into sibling outcomes.
    const owner = task.skills.find(skill => path.startsWith(`${skillsRoot}/${skill}/`));
    if (!owner) continue;
    for (const match of body.matchAll(/\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      const link = match[1];
      if (/^(?:[a-z]+:|\/)/i.test(link) || !link.endsWith('.md')) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), link));
      if (target.startsWith(`${skillsRoot}/${owner}/`)) paths.push(target);
    }
  }
  const knowledge = [];
  for (const handle of task.knowledgeHandles) {
    assert.equal(typeof resolveKnowledge, 'function', `Missing knowledge connection ${handle}`);
    const body = await resolveKnowledge(handle);
    textField(body);
    contextBytes += Buffer.byteLength(body);
    assert.ok(contextBytes <= 196608, 'Selected knowledge exceeds context budget');
    knowledge.push({ handle, body });
  }
  return { methods, knowledge };
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
