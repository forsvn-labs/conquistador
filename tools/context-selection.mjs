import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLoadAllowed, loadRestriction } from './domain-package.mjs';
import { explicitInvocation, invokedCommand, requestClauses, normalizeRequest as normalized, includesPhrase } from './request-text.mjs';
import { loadRoutingContract } from './routing-contract.mjs';

export const REQUEST_CONTEXT_SCHEMA_VERSION = 'conquistador.request-context/v1';
export const MAX_PROMPT_BYTES = 32000;
export const MAX_CONTEXT_CHARACTERS = 7500;
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = message => { throw new Error(message); };
const feedbackOptIn = /\b(?:submit|share|send)\s+(?:product\s+)?feedback\b|\breport (?:a )?conquistador (?:bug|failure|issue)\b|\bfile a conquistador issue\b/i;
const connectionSetup = /\b(?:set\s*up|setup|install|connect|wire|configure)\b[\s\S]{0,80}\b(?:executor|hubspot|salesforce|pipedrive|crm|ads account)\b/i;

const technicalNoun = /\b(?:code|functions?|handlers?|middleware|components?|modules?|files?|tests?|validation)\b/i;
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

function matchingMethods(query, contract, { permitGrowthInference = true } = {}) {
  const text = normalized(query).replace(/\bposts\b/g, 'post');
  const inspect = /\b(?:evaluate|audit|results|performance)\b/i.test(query);
  const matches = [];
  for (const method of [...Object.values(contract.methods), ...contract.unavailableMethods]) {
    if (method.explicitOnly && !feedbackOptIn.test(query)) continue;
    // A one-word command name selects only through explicit invocation (see resolveCommand).
    // An old method ID (write-copy) still names its command anywhere in the request.
    const legacy = new Set(method.legacy ?? []);
    const intents = [...(method.legacy ?? []), ...method.intents, ...(method.aliases ?? []).filter(alias => !legacy.has(alias))];

    const hit = intents.flatMap(intent => includesPhrase(text, intent)
      ? [{ phrase: intent, kind: legacy.has(intent) ? 'name' : 'intent', score: normalized(intent).length }]
      : [])
      .sort((a, b) => (b.kind === 'name') - (a.kind === 'name') || b.score - a.score)[0];

    if (!hit || method.exclusions.some(phrase => includesPhrase(text, phrase))) continue;
    if (inspect && method.kind === 'create' && hit.kind !== 'name' && !/\b(?:write|create|draft)\b/i.test(query)) continue;
    matches.push({ ...method, score: hit.score, matchKind: hit.kind, matchPhrase: hit.phrase });
  }
  return finishMatches(query, text, matches, contract, { permitGrowthInference, inspect });
}

function finishMatches(query, text, matches, contract, { permitGrowthInference, inspect }) {

  const growthMetric = /\b(?:growth|revenue|signups?|upgrades?|conversion|activation|retention|funnel|churn|trials?|leads?|orders?|sales|trial to paid|(?:sales|deal|revenue|lead) pipeline)\b/.test(text);
  const adverseChange = /\b(?:stall(?:ed|ing)?|flat|flattened|fall(?:ing)?|fell|drop(?:ped|ping)?|declin(?:e|ed|ing)|down|weak(?:en|ened|ening)?|slowed|missed target)\b/.test(text);
  const creationRequest = /\b(?:write|draft|create|publish|post)\b/.test(text);
  const asksForDiagnosis = /\b(?:diagnos(?:e|is)|investigat(?:e|ion)|analy[sz]e|explain|why)\b/.test(text);

  if (permitGrowthInference && growthMetric && adverseChange && (!creationRequest || asksForDiagnosis) && !matches.some(item => item.name === 'diagnose')) {
    const method = contract.methods['diagnose'] ?? contract.unavailableMethods.find(item => item.name === 'diagnose');

    if (method && !method.exclusions.some(phrase => includesPhrase(text, phrase))) matches.push({ ...method, score: 30, matchKind: 'inferred-growth' });
  }

  const growthResults = /\bgrowth\b(?:\s+\w+){0,3}\s+\b(?:results|performance)\b/.test(text);
  const resultsReview = /\b(?:review|evaluate|assess|analy[sz]e|learn from)\b/.test(text);

  if (growthResults && resultsReview && !matches.some(item => item.name === 'measure')) {
    const method = contract.methods['measure'] ?? contract.unavailableMethods.find(item => item.name === 'measure');

    if (method && !method.exclusions.some(phrase => includesPhrase(text, phrase))) matches.push({ ...method, score: 30, matchKind: 'inferred-results' });
  }
  // Channel disambiguation is local to a requested stage; other clauses keep their own methods.
  for (const [channel, modes] of Object.entries(contract.channelLocks)) {
    if (!includesPhrase(text, channel)) continue;
    const hit = Object.entries(modes).find(([mode]) => includesPhrase(text, mode));
    if (!hit) continue;
    const record = contract.methods[hit[1]];
    if (record && !inspect && ['social', 'outreach', 'copy', 'ads'].includes(record.name)) {
      for (let i = matches.length - 1; i >= 0; i--) {
        if (['social', 'outreach', 'copy', 'ads'].includes(matches[i].name) && matches[i].name !== record.name) matches.splice(i, 1);
      }

      if (!matches.some(item => item.name === record.name)) matches.push({ ...record, score: 30, matchKind: 'channel-lock' });
    }
  }
  return matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

// A play wins over single commands when the request names the play, matches one of its intents at
// least as specifically as the best command phrase, or selects two or more commands it chains
// (and at least half of its unconditional commands).
export function selectPlay(query, selected, contract, restriction, invoked = null) {
  const text = normalized(query);
  const names = new Set(selected.map(item => item.name));
  const best = Math.max(0, ...selected.filter(item => item.matchKind === 'intent').map(item => item.score));
  const ranked = (contract.plays ?? []).map(play => {
    if (!allowedKind(restriction, 'workflow', play.name)) return null;
    if (invoked === play.name) return { play, named: 1, intent: 0, hits: 0, coverage: 0 };
    const intent = [...play.intents, ...(play.legacy ?? [])].filter(phrase => includesPhrase(text, phrase))
      .reduce((longest, phrase) => Math.max(longest, normalized(phrase).length), 0);
    const hits = play.dependencies.filter(name => names.has(name)).length;
    const core = new Set(play.chain.filter(step => step.command && !step.when).map(step => step.command));
    const coreHits = [...core].filter(name => names.has(name)).length;
    const byIntent = intent > 0 && intent >= best;
    const byChain = hits >= 2 && coreHits * 2 >= core.size;
    if (!byIntent && !byChain) return null;
    return { play, named: 0, intent: byIntent ? intent : 0, hits, coverage: hits / play.dependencies.length };
  }).filter(Boolean).sort((a, b) => b.named - a.named || b.intent - a.intent || b.hits - a.hits || b.coverage - a.coverage || a.play.name.localeCompare(b.play.name));
  if (!ranked[0]) return null;
  const { play } = ranked[0];
  return { name: play.name, label: play.label, path: play.path, chain: play.chain, executableGraph: false };
}

// Resolve an invoked word to a command or play by name or legacy ID.
export function resolveCommand(word, contract) {
  if (!word) return null;
  const method = contract.methods[word] ?? Object.values(contract.methods).find(item => (item.legacy ?? []).includes(word));
  if (method) return { kind: 'command', name: method.name };
  const play = (contract.plays ?? []).find(item => item.name === word || (item.legacy ?? []).includes(word));
  return play ? { kind: 'play', name: play.name } : null;
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

function formatContext({ root, parent, selected, deferred, excluded, unavailable, play, role, parentMethod }) {
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
  if (play) {
    lines.push('', `Play: ${play.label} [${play.name}] (${play.path})`, 'Run these steps in order; skip a step whose condition is false:');
    play.chain.forEach((step, index) => lines.push(`${index + 1}. ${step.command ?? step.method}${step.mode ? ` (mode ${step.mode})` : ''}${step.when ? ` — when ${step.when}` : ''}${step.for ? ` — for ${step.for}` : ''}`));
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
    play: null,
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
    play: result.play?.name ?? null,
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
  const methods = [...Object.values(contract.methods), ...contract.unavailableMethods];

  const protectedPhrases = methods.flatMap(method => [method.name, ...method.intents, ...(method.aliases ?? [])])
    .filter(phrase => /\band\b/.test(normalized(phrase)));

  const clauses = requestClauses(prompt, { protectedPhrases });
  const query = clauses.join('. ');
  const excluded = [];
  const unavailable = [];
  const selectedAll = [];
  let parentMethod = null;

  const codingAction = /\b(?:refactor|rewrite|debug|implement|patch)\b/i.test(query)
    && technicalNoun.test(query);

  const businessDiagnosisRequested = clauses.some(clause =>
    /\b(?:diagnos(?:e|is)|investigat(?:e|ion)|analy[sz]e|explain|why|what is going on)\b/i.test(clause)
    && /\b(?:growth|revenue|signups?|upgrades?|conversion|activation|retention|funnel|churn|trials?|leads?|orders?|sales)\b/i.test(clause)
    && !technicalNoun.test(clause));

  const consider = item => {

    if (!contract.methods[item.name] || !allowedKind(restriction, 'skill', item.name)) {
      unavailable.push(item.name);

      return;
    }

    const strength = value => value.matchKind === 'name' ? 3 : value.matchKind === 'intent' && value.matchPhrase !== 'what should we do' ? 2 : value.matchKind === 'intent' ? 1 : 0;
    const existing = selectedAll.findIndex(value => value.name === item.name);

    if (existing === -1) selectedAll.push(item);
    else if (strength(item) > strength(selectedAll[existing])) selectedAll[existing] = item;
  };
  for (const clause of clauses) {
    parentMethod ??= parentMatch(clause, contract, restriction);

    const technicalStage = technicalNoun.test(clause);

    for (const item of matchingMethods(clause, contract, { permitGrowthInference: !codingAction || (businessDiagnosisRequested && !technicalStage) })) consider(item);
  }

  const invoked = resolveCommand(invokedCommand(prompt), contract);
  if (invoked?.kind === 'command') consider({ ...contract.methods[invoked.name], score: 100, matchKind: 'name', matchPhrase: invoked.name });

  if (selectedAll.length > 1) {
    const broadPlanning = selectedAll.findIndex(item => item.name === 'shape' && item.matchKind === 'intent' && item.matchPhrase === 'what should we do');

    if (broadPlanning !== -1) selectedAll.splice(broadPlanning, 1);
  }
  if (!clauses.some(clause => feedbackOptIn.test(clause))) excluded.push({ name: 'feedback', reason: 'explicit-only' });
  // An explicit command stays a command. Otherwise a matching play brings its first step.
  const play = invoked?.kind === 'command' ? null : selectPlay(query, selectedAll, contract, restriction, invoked?.name);
  const first = play?.chain.find(step => step.command && !step.when) ?? play?.chain.find(step => step.command);
  if (first && contract.methods[first.command] && !selectedAll.some(item => item.name === first.command)) {
    selectedAll.unshift({ ...contract.methods[first.command], score: 0, matchKind: 'play-step', matchPhrase: play.name });
  }
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
        play,
        role: selectRole(query, candidate, contract, restriction),
        parentMethod,
      });
      expanded.push(item);
    } catch {
      deferred.push(attachResources(item));
    }
  }
  const selected = expanded.map(attachResources);
  const role = selectRole(query, selected, contract, restriction);
  context = formatContext({
    root: packageRoot, parent, selected, deferred, excluded, unavailable, play, role, parentMethod,
  });
  return {
    schemaVersion: REQUEST_CONTEXT_SCHEMA_VERSION,
    action: 'route',
    reason: parentMethod && !selected.length ? 'parent-method' : 'relevant-capability',
    selected: selected.map(({ name, label, path, resources, deferredResources }) => ({ name, label, path, resources, deferredResources })),
    deferred: deferred.map(({ name, label, path }) => ({ name, label, path })),
    excluded,
    unavailable,
    play,
    role,
    parentMethod: parentMethod ? { name: parentMethod.name, label: parentMethod.label, path: parentMethod.path } : null,
    context,
  };
}
