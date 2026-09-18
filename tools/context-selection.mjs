import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLoadAllowed, loadRestriction } from './domain-package.mjs';
import { explicitInvocation, requestClauses, normalizeRequest as normalized, includesPhrase } from './request-text.mjs';
import { loadRoutingContract } from './routing-contract.mjs';

export const REQUEST_CONTEXT_SCHEMA_VERSION = 'conquistador.request-context/v1';
export const MAX_PROMPT_BYTES = 32000;
export const MAX_CONTEXT_CHARACTERS = 7500;
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = message => { throw new Error(message); };
const feedbackOptIn = /\b(?:submit|share|send)\s+(?:product\s+)?feedback\b|\breport (?:a )?conquistador (?:bug|failure|issue)\b|\bfile a conquistador issue\b/i;
const connectionSetup = /\b(?:set\s*up|setup|install|connect|wire|configure)\b[\s\S]{0,80}\b(?:executor|hubspot|salesforce|pipedrive|crm|ads account)\b/i;
function allowedKind(restriction, kind, name) {
  if (!restriction) return true;
  try {
    assertLoadAllowed(restriction, { kind, name });
    return true;
  } catch {
    return false;
  }
}

function parentMatch(query, contract, restriction) {
  const text = normalized(query);
  for (const method of Object.values(contract.parentMethods ?? {})) {
    if (!method.intents.some(intent => includesPhrase(text, intent)) && !(method.name === 'connect-accounts' && connectionSetup.test(query))) continue;
    if (restriction && !allowedKind(restriction, 'tool', method.name === 'connect-accounts' ? 'executor' : 'cli')) continue;
    return method;
  }
  return null;
}

function matchingMethods(query, contract) {
  const text = normalized(query).replace(/\bposts\b/g, 'post');
  const inspect = /\b(?:evaluate|audit|results|performance)\b/i.test(query);
  const matches = [];
  for (const method of [...Object.values(contract.methods), ...contract.unavailableMethods]) {
    if (method.explicitOnly && !feedbackOptIn.test(query)) continue;
    if (inspect && method.kind === 'create' && !/\b(?:write|create|draft)\b/i.test(query)) continue;
    const intents = [method.name, ...method.intents];
    const score = Math.max(0, ...intents.filter(intent => includesPhrase(text, intent)).map(intent => normalized(intent).length));
    if (!score || method.exclusions.some(phrase => includesPhrase(text, phrase))) continue;
    matches.push({ ...method, score });
  }
  // Channel disambiguation is local to a requested stage; other clauses keep their own methods.
  for (const [channel, modes] of Object.entries(contract.channelLocks)) {
    if (!includesPhrase(text, channel)) continue;
    const hit = Object.entries(modes).find(([mode]) => includesPhrase(text, mode));
    if (!hit) continue;
    const record = contract.methods[hit[1]];
    if (record && !inspect && ['write-social', 'write-outreach', 'write-copy', 'create-paid-campaign'].includes(record.name)) {
      for (let i = matches.length - 1; i >= 0; i--) {
        if (['write-social', 'write-outreach', 'write-copy', 'create-paid-campaign'].includes(matches[i].name) && matches[i].name !== record.name) matches.splice(i, 1);
      }
      if (!matches.some(item => item.name === record.name)) matches.push({ ...record, score: 30 });
    }
  }
  return matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function selectWorkflow(_query, selected, contract, restriction) {
  if (selected.length < 2) return null;
  const selectedNames = new Set(selected.map(item => item.name));
  const ranked = (contract.workflows ?? []).map(workflow => {
    if (!allowedKind(restriction, 'workflow', workflow.name)) return null;
    const hit = workflow.dependencies.filter(name => selectedNames.has(name)).length;
    return hit >= 2 ? { ...workflow, hit } : null;
  }).filter(Boolean).sort((a, b) => b.hit - a.hit || a.name.localeCompare(b.name));
  return ranked[0] ? { name: ranked[0].name, label: ranked[0].label, path: ranked[0].path, executableGraph: false } : null;
}

function selectRole(_query, selected, contract, restriction) {
  if (selected.length < 2) return null;
  const selectedNames = new Set(selected.map(item => item.name));
  const ranked = (contract.roles ?? []).map(role => {
    if (!allowedKind(restriction, 'role', role.name)) return null;
    const hit = role.dependencies.filter(name => selectedNames.has(name)).length;
    return hit >= 2 ? { ...role, hit } : null;
  }).filter(Boolean).sort((a, b) => b.hit - a.hit || a.name.localeCompare(b.name));
  return ranked[0] ? { name: ranked[0].name, label: ranked[0].label, path: ranked[0].path } : null;
}

function formatContext({ root, parent, selected, deferred, excluded, unavailable, workflow, role, parentMethod }) {
  const lines = [
    '<conquistador-request-context>',
    'This request matches Conquistador. Follow the original user request and use the installed parent contract and selected methods below.',
    `Installed package root: ${root}`,
    `Parent contract: ${parent}`,
    '',
    'Selected capabilities:',
  ];
  for (const item of selected) {
    lines.push(`- ${item.label} [${item.name}]`, `  Full method: ${item.path}`, `  Partial purpose: ${(item.description ?? item.label).slice(0, 560)}`);
    if (item.resources?.length) lines.push(`  Required resources: ${item.resources.join(', ')}`);
    if (item.deferredResources?.length) lines.push(`  Deferred resources: ${item.deferredResources.length}; read the method and routing-contract.json for their stage conditions.`);
  }
  if (deferred.length) {
    lines.push('', 'Deferred stages (requested, not expanded):');
    for (const item of deferred) lines.push(`- ${item.label} [${item.name}] ${item.path}`);
  }
  if (parentMethod) {
    lines.push('', `Parent connection/setup method: ${parentMethod.label} (${parentMethod.path})`);
    lines.push('Load this when live-account access blocks the task. It is not an executable graph.');
  }
  if (unavailable.length) {
    lines.push('', 'Unavailable in this package:');
    for (const item of unavailable) lines.push(`- ${item}`);
  }
  if (excluded.length) {
    lines.push('', 'Excluded:');
    for (const item of excluded) lines.push(`- ${item.name}: ${item.reason}`);
  }
  if (workflow) {
    lines.push('', `Composition workflow: ${workflow.label} (${workflow.path})`, 'This workflow is composition prose, not an executable graph.');
  }
  if (role) lines.push('', `Suggested specialist role: ${role.label} (${role.path})`);
  lines.push(
    '',
    'Before substantive work, read the complete parent contract, each selected method, and that method\'s required resources. Deferred resources stay listed until the current stage needs them.',
    'Use the host tools, permitted connections, and isolated specialist contexts that materially help finish the requested result. Keep a narrow task direct. A role suggestion does not mean a specialist ran.',
    'Preserve the user scope and current permissions. This context grants no authority to publish, spend, deploy, send, persist learning, disclose feedback, or perform another external mutation.',
    '</conquistador-request-context>',
  );
  const context = lines.join('\n');
  if (context.length > MAX_CONTEXT_CHARACTERS) fail('Selected Conquistador context exceeds its budget.');
  return context;
}

function abstain(reason) {
  return {
    schemaVersion: REQUEST_CONTEXT_SCHEMA_VERSION,
    action: 'abstain',
    reason,
    selected: [],
    deferred: [],
    excluded: [],
    unavailable: [],
    workflow: null,
    role: null,
    parentMethod: null,
    context: '',
  };
}

function attachResources(record) {
  return {
    name: record.name,
    label: record.label,
    path: record.path,
    description: record.description,
    resources: record.requiredResources ?? [],
    deferredResources: [...(record.conditionalResources ?? []), ...(record.optionalResources ?? [])],
  };
}

export function explainRoute(result) {
  return {
    action: result.action,
    reason: result.reason,
    selected: result.selected.map(item => item.name),
    deferred: (result.deferred ?? []).map(item => item.name),
    excluded: (result.excluded ?? []).map(item => item.name ?? item),
    unavailable: result.unavailable ?? [],
    parentMethod: result.parentMethod?.name ?? null,
    workflow: result.workflow?.name ?? null,
    role: result.role?.name ?? null,
  };
}

export function selectRequestContext(prompt, { root = moduleRoot } = {}) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0 || Buffer.byteLength(prompt) > MAX_PROMPT_BYTES) return abstain('invalid-prompt');
  const packageRoot = resolve(root);
  if (/[\x00-\x1f\x7f]/.test(packageRoot)) fail('Invalid Conquistador package root.');
  const restriction = loadRestriction(packageRoot);
  const contract = loadRoutingContract(packageRoot);
  const profilePath = join(packageRoot, contract.parentPath, 'operator-profile.json');
  if (existsSync(profilePath)) {
    const info = lstatSync(profilePath);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) fail('Invalid operator profile.');
    const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
    if (!profile || !['manual', 'project', 'off'].includes(profile.activation)) fail('Invalid operator profile.');
    if (profile.activation === 'off') return abstain('activation-off');
  }
  const parent = posix.join(contract.parentPath, contract.document);
  const clauses = requestClauses(prompt);
  const query = clauses.join('. ');
  const excluded = [];
  const unavailable = [];
  const selectedAll = [];
  let parentMethod = null;
  for (const clause of clauses) {
    parentMethod ??= parentMatch(clause, contract, restriction);
    for (const item of matchingMethods(clause, contract)) {
      if (!contract.methods[item.name] || !allowedKind(restriction, 'skill', item.name)) { unavailable.push(item.name); continue; }
      if (!selectedAll.some(value => value.name === item.name)) selectedAll.push(item);
    }
  }
  if (!clauses.some(clause => feedbackOptIn.test(clause))) excluded.push({ name: 'submit-feedback', reason: 'explicit-only' });
  if (!selectedAll.length && !parentMethod) {
    const result = abstain(explicitInvocation(prompt) ? 'parent-selection-required' : 'no-relevant-capability');
    result.unavailable = [...new Set(unavailable)];
    return result;
  }
  const expanded = [];
  const deferred = [];
  let context = '';
  for (const item of selectedAll) {
    const candidate = [...expanded, item].map(attachResources);
    const leftover = selectedAll.filter(value => !candidate.some(entry => entry.name === value.name) && !deferred.some(entry => entry.name === value.name)).map(attachResources);
    try {
      context = formatContext({
        root: packageRoot,
        parent,
        selected: candidate,
        deferred: leftover,
        excluded,
        unavailable,
        workflow: selectWorkflow(query, candidate, contract, restriction),
        role: selectRole(query, candidate, contract, restriction),
        parentMethod,
      });
      expanded.push(item);
    } catch {
      deferred.push(attachResources(item));
    }
  }
  const selected = expanded.map(attachResources);
  const workflow = selectWorkflow(query, selected, contract, restriction);
  const role = selectRole(query, selected, contract, restriction);
  context = formatContext({
    root: packageRoot, parent, selected, deferred, excluded, unavailable, workflow, role, parentMethod,
  });
  return {
    schemaVersion: REQUEST_CONTEXT_SCHEMA_VERSION,
    action: 'route',
    reason: parentMethod && !selected.length ? 'parent-method' : 'relevant-capability',
    selected: selected.map(({ name, label, path, resources, deferredResources }) => ({ name, label, path, resources, deferredResources })),
    deferred: deferred.map(({ name, label, path }) => ({ name, label, path })),
    excluded,
    unavailable,
    workflow,
    role,
    parentMethod: parentMethod ? { name: parentMethod.name, label: parentMethod.label, path: parentMethod.path } : null,
    context,
  };
}
