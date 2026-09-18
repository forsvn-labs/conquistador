import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLoadAllowed, loadRestriction } from './domain-package.mjs';
import { methodDocument, methodLibrary } from './method-library.mjs';
import { containedPath } from './plugin-contracts.mjs';

export const REQUEST_CONTEXT_SCHEMA_VERSION = 'conquistador.request-context/v1';
export const MAX_PROMPT_BYTES = 32000;
export const MAX_CONTEXT_CHARACTERS = 7500;
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = /^[a-z][a-z0-9-]{0,63}$/;
const genericTerms = new Set([
  'add', 'app', 'build', 'change', 'content', 'create', 'draft', 'help', 'improve', 'make',
  'need', 'plan', 'product', 'result', 'review', 'thing', 'update', 'use', 'work', 'write',
]);
const stopTerms = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'can', 'do', 'for', 'from',
  'how', 'i', 'in', 'into', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'please',
  'that', 'the', 'their', 'this', 'to', 'we', 'what', 'when', 'where', 'which', 'with', 'you', 'your',
]);
const noStem = new Set(['ads', 'analysis', 'business', 'class', 'css', 'ios', 'paid', 'pricing', 'sales']);
const unrelatedCoding = /\b(?:fix(?:ing)? (?:a |the )?(?:bug|type ?error|compile error|lint)|refactor(?:ing)?|merge conflict|unit tests?|eslint|prettier|null pointer|typescript error|dependency update)\b/i;
const sourceFile = /(?:^|[\s`'"(])([\w./-]+\.(?:tsx?|jsx?|mjs|cjs|css|scss|vue|svelte|py|go|rs|java|rb))\b/gi;

function fail(message) {
  throw new Error(message);
}

function readContained(root, path, maximum = 262144) {
  const absolute = containedPath(root, `./${path}`, 'file');
  const info = lstatSync(absolute);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) fail('Invalid Conquistador context resource.');
  return readFileSync(absolute, 'utf8');
}

function frontmatter(markdown) {
  const body = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? '';
  const field = name => new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(body)?.[1]?.trim() ?? '';
  const decode = value => {
    if (value.startsWith('"')) {
      try { return JSON.parse(value); } catch { return value.slice(1, -1); }
    }
    return value.replace(/^'|'$/g, '');
  };
  return { name: decode(field('name')), description: decode(field('description')) };
}

function positiveDescription(value) {
  return value.split(/(?<=[.!?])\s+/).filter(sentence =>
    !/^(?:route|not for|do not use|exclude|hand (?:off|those)|use .+ instead)\b/i.test(sentence.trim()))
    .join(' ').trim();
}

function stem(value) {
  if (noStem.has(value)) return value;
  if (value.length < 4) return value;
  if (value.endsWith('ies') && value.length > 5) return `${value.slice(0, -3)}y`;
  if (value.endsWith('s') && value.length > 2) return value.slice(0, -1);
  if (value.endsWith('ement') && value.length > 7) return value.slice(0, -4);
  if (value.endsWith('ing') && value.length > 6) return value.slice(0, -3).replace(/(.)\1$/, '$1');
  if (value.endsWith('ed') && value.length > 5) return value.slice(0, -2);
  if (value.endsWith('es') && value.length > 5) return value.slice(0, -2);
  return value;
}

function normalized(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value, { keepGeneric = false } = {}) {
  const out = [];
  for (const raw of normalized(value).split(/\s+/).filter(Boolean)) {
    const token = stem(raw);
    if (stopTerms.has(raw) || stopTerms.has(token) || (!keepGeneric && genericTerms.has(token)) || token.length < 2) continue;
    out.push(token);
  }
  return [...new Set(out)];
}

function requestText(prompt) {
  const routingMetaTarget = /\b(?:(?:developer|system|hook|injected) context|capability id|method path|routing score|smoke_context_)\b/i;
  const routingMetaAction = /\b(?:include|print|repeat|report|show|state)\b/i;
  const request = prompt.split(/(?<=[.!?\n])\s+/)
    .filter(sentence => !(routingMetaTarget.test(sentence) && routingMetaAction.test(sentence)))
    .join(' ');
  const text = request
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/"[^"\n]*"|'[^'\n]*'/g, ' ')
    .replace(/\b(?:do not|don't|dont|exclude|skip|without)\b(?:\s+\S+){0,4}/gi, ' ')
    .replace(/\b(approved|accepted|existing|supplied)\s+(?:flow|brief|plan|positioning|research|copy)\b/gi, '$1')
    .replace(sourceFile, ' ');
  if (/\b(?:string|text|term|name|fixture|example)\b.*\b(?:appear|appears|mention|mentions|contain|contains)\b|\b(?:appear|appears|mention|mentions|contain|contains)\b.*\b(?:string|text|term|name|fixture|example)\b/i.test(text)) return '';
  return text;
}

function labelsFromMap(markdown) {
  const labels = new Map();
  for (const row of markdown.split('\n')) {
    const match = /^\| ([^|]+) \| `([a-z][a-z0-9-]+)` \|/.exec(row);
    if (match) labels.set(match[2], match[1].trim());
  }
  return labels;
}

function loadProfileActivation(root, parentPath) {
  const path = posix.join(parentPath, 'operator-profile.json');
  if (!existsSync(join(root, path))) return 'manual';
  const value = JSON.parse(readContained(root, path, 16384));
  if (!value || typeof value !== 'object' || !['manual', 'project', 'off'].includes(value.activation)) {
    fail('Invalid operator profile.');
  }
  return value.activation;
}

function loadMethods(root, restriction) {
  const layouts = methodLibrary(root);
  if (layouts.length !== 1) fail('Ambiguous or missing Conquistador method library.');
  const library = layouts[0];
  const parentPath = posix.join(library.layout, 'conquistador');
  const capabilities = readContained(root, posix.join(parentPath, 'capabilities.md'));
  const labels = labelsFromMap(capabilities);
  const document = library.internal ? methodDocument : 'SKILL.md';
  const records = [];
  for (const name of readdirSync(join(root, library.layout)).sort()) {
    if (name === 'conquistador' || !NAME.test(name)) continue;
    const path = posix.join(library.layout, name, document);
    if (!existsSync(join(root, path))) continue;
    if (restriction) {
      try { assertLoadAllowed(restriction, { kind: 'skill', name }); }
      catch { continue; }
    }
    const markdown = readContained(root, path);
    const metadata = frontmatter(markdown);
    if (metadata.name !== name || !metadata.description) fail('Invalid method metadata.');
    records.push({
      name,
      label: labels.get(name) ?? name.replaceAll('-', ' '),
      description: positiveDescription(metadata.description),
      markdown,
      path,
    });
  }
  return { library, parentPath, document, records };
}

function weightedTerms(record) {
  const weights = new Map();
  const add = (value, weight) => {
    for (const token of tokens(value, { keepGeneric: true })) weights.set(token, Math.max(weights.get(token) ?? 0, weight));
  };
  add(record.description, 1);
  add(record.label, 2.5);
  add(record.name.replaceAll('-', ' '), 3.5);
  return weights;
}

function rankRecords(query, records) {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return [];
  const createIntent = /\b(?:write|rewrite|draft|create|plan|build|implement|design|specify|prepare)\b/i.test(query);
  const inspectIntent = /\b(?:evaluate|analy[sz]e|audit|diagnose|review|actual|performance|results?|metrics?)\b/i.test(query);
  const leadingIntent = stem(normalized(query).split(/\s+/)[0] ?? '');
  const documents = records.map(record => ({ record, weights: weightedTerms(record) }));
  const frequency = new Map();
  for (const token of queryTokens) {
    frequency.set(token, documents.filter(item => item.weights.has(token)).length);
  }
  const prompt = normalized(query);
  const ranked = [];
  for (const item of documents) {
    const idPhrase = normalized(item.record.name.replaceAll('-', ' '));
    const labelPhrase = normalized(item.record.label);
    const exact = (idPhrase.length > 3 && prompt.includes(idPhrase)) || (labelPhrase.length > 3 && prompt.includes(labelPhrase));
    let score = exact ? 9 : 0;
    let overlap = 0;
    let rare = false;
    const matched = [];
    const rareMatched = [];
    const strongMatched = [];
    for (const token of queryTokens) {
      const weight = item.weights.get(token);
      if (!weight) continue;
      overlap += 1;
      matched.push(token);
      if (weight >= 2.5) strongMatched.push(token);
      const idf = Math.log((documents.length + 1) / ((frequency.get(token) ?? 0) + 1)) + 1;
      if (idf >= 2.8 && !genericTerms.has(token)) {
        rare = true;
        rareMatched.push(token);
      }
      score += idf * weight;
    }
    const queryWords = normalized(query).split(/\s+/).filter(Boolean);
    const searchable = normalized(`${item.record.label} ${item.record.description}`);
    for (let index = 0; index < queryWords.length - 1; index += 1) {
      const phrase = `${queryWords[index]} ${queryWords[index + 1]}`;
      if (!stopTerms.has(queryWords[index]) && !stopTerms.has(queryWords[index + 1]) && searchable.includes(phrase)) score += 3;
    }
    const creationMethod = /^(?:allocate|architect|brief|build|create|design|map|model|optimize|plan|polish|prioritize|research|shape|write)-/.test(item.record.name);
    const inspectionMethod = /^(?:audit|diagnose|evaluate|fresh-eyes-review|knowledge-review|measure)-/.test(item.record.name);
    if (createIntent && creationMethod) score += 4;
    if (createIntent && inspectionMethod && !inspectIntent) score *= 0.55;
    if (inspectIntent && inspectionMethod) score += 4;
    const leadingMatch = Boolean(leadingIntent && stem(item.record.name.split('-')[0]) === leadingIntent);
    if (leadingMatch) score += 8;
    if (!exact && overlap < 2 && !(overlap === 1 && (rare || strongMatched.length))) continue;
    if (score >= 3.5) ranked.push({ ...item.record, score, overlap, exact, leadingMatch, matched, rareMatched, strongMatched });
  }
  return ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function selectRanked(ranked, maximum = 3) {
  if (!ranked.length) return [];
  const floor = Math.max(4, ranked[0].score * 0.73);
  const selected = [ranked[0]];
  const covered = new Set(selected.flatMap(item => item.matched));
  while (selected.length < maximum) {
    const candidates = ranked.filter(item => !selected.includes(item)).map(item => {
      const novel = item.matched.filter(token => !covered.has(token) && !genericTerms.has(token));
      const strongNovel = item.strongMatched.filter(token => !covered.has(token) && !genericTerms.has(token));
      const rareNovel = item.rareMatched.filter(token => !covered.has(token) && !genericTerms.has(token));
      const leadingUncovered = item.leadingMatch && !selected.some(value => value.leadingMatch);
      const eligible = (item.score >= floor && (item.exact || leadingUncovered || novel.length)) || strongNovel.length || rareNovel.length;
      return { item, novel, strongNovel, rareNovel, eligible };
    }).filter(candidate => candidate.eligible).sort((a, b) =>
      Number(b.item.leadingMatch) - Number(a.item.leadingMatch)
      || b.strongNovel.length - a.strongNovel.length
      || b.rareNovel.length - a.rareNovel.length
      || b.item.score - a.item.score);
    if (!candidates.length) break;
    selected.push(candidates[0].item);
    candidates[0].novel.forEach(token => covered.add(token));
  }
  return selected;
}

function linkedResources(root, record) {
  const owner = posix.dirname(record.path);
  const candidates = [];
  let index = 0;
  for (const match of record.markdown.matchAll(/\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    const link = match[1];
    if (/^(?:[a-z]+:|\/)/i.test(link) || !link.endsWith('.md')) continue;
    const path = posix.normalize(posix.join(posix.dirname(record.path), decodeURIComponent(link)));
    if (!path.startsWith(`${owner}/`) || !/(?:\/agents\/|\/references\/|\/fallbacks\/)/.test(path)) continue;
    if (!existsSync(join(root, path)) || candidates.some(item => item.path === path)) continue;
    readContained(root, path);
    const kind = path.includes('/agents/') ? 'agent' : path.includes('/fallbacks/') ? 'fallback' : 'reference';
    candidates.push({ path, kind, index: index++ });
  }
  const chosen = [];
  for (const kind of ['agent', 'reference', 'reference', 'fallback']) {
    const candidate = candidates.find(item => item.kind === kind && !chosen.includes(item));
    if (candidate) chosen.push(candidate);
    if (chosen.length === 3) break;
  }
  return chosen.map(item => item.path);
}

function firstPurpose(markdown) {
  const body = markdown.replace(/^# .*\n+/, '').trim();
  return body.split(/\n\s*\n/).find(value => value && !value.startsWith('#'))?.replace(/\s+/g, ' ').trim() ?? '';
}

function selectWorkflow(root, parentPath, query, selected, restriction) {
  if (selected.length < 2) return null;
  const directory = posix.join(parentPath, 'workflows');
  if (!existsSync(join(root, directory))) return null;
  const selectedNames = new Set(selected.map(item => item.name));
  const records = [];
  for (const file of readdirSync(join(root, directory)).sort()) {
    if (!file.endsWith('.md')) continue;
    const name = file.slice(0, -3);
    if (!NAME.test(name)) continue;
    if (restriction) {
      try { assertLoadAllowed(restriction, { kind: 'workflow', name }); }
      catch { continue; }
    }
    const path = posix.join(directory, file);
    const markdown = readContained(root, path);
    const dependencies = [...markdown.matchAll(/`([a-z][a-z0-9-]+)`/g)].map(match => match[1])
      .filter((value, index, all) => selectedNames.has(value) && all.indexOf(value) === index);
    if (dependencies.length < 2) continue;
    records.push({ name, label: name.replaceAll('-', ' '), description: firstPurpose(markdown), path, dependencies });
  }
  return selectRanked(rankRecords(query, records), 1)[0] ?? null;
}

function selectRole(root, parentPath, query, selected, restriction) {
  if (selected.length < 2) return null;
  const rosterPath = posix.join(parentPath, 'specialists/roster.md');
  if (!existsSync(join(root, rosterPath))) return null;
  const selectedNames = new Set(selected.map(item => item.name));
  const records = [];
  for (const row of readContained(root, rosterPath).split('\n')) {
    const match = /^\| \[([^\]]+)\]\(([^)]+-agent\.md)\) \| ([^|]+) \| ([^|]+) \|/.exec(row);
    if (!match) continue;
    const name = posix.basename(match[2], '-agent.md');
    if (restriction) {
      try { assertLoadAllowed(restriction, { kind: 'role', name }); }
      catch { continue; }
    }
    const dependencies = [...match[4].matchAll(/`([a-z][a-z0-9-]+)`/g)].map(item => item[1])
      .filter(value => selectedNames.has(value));
    if (dependencies.length < 2) continue;
    records.push({
      name,
      label: match[1],
      description: match[3].trim(),
      path: posix.normalize(posix.join(posix.dirname(rosterPath), match[2])),
      dependencies,
    });
  }
  return selectRanked(rankRecords(query, records), 1)[0] ?? null;
}

function formatContext({ root, parent, selected, workflow, role }) {
  const lines = [
    '<conquistador-request-context>',
    'This request matches Conquistador. Follow the original user request and use the installed parent contract and selected methods below.',
    `Installed package root: ${root}`,
    `Parent contract: ${parent}`,
    '',
    'Selected capabilities:',
  ];
  for (const item of selected) {
    lines.push(`- ${item.label} [${item.name}]`, `  Full method: ${item.path}`, `  Partial purpose: ${item.description.slice(0, 560)}`);
    if (item.resources.length) lines.push(`  Relevant contained resources: ${item.resources.join(', ')}`);
  }
  if (workflow) lines.push('', `Composition workflow: ${workflow.label} (${workflow.path})`, `Partial purpose: ${workflow.description.slice(0, 480)}`);
  if (role) lines.push('', `Suggested specialist role: ${role.label} (${role.path})`);
  lines.push(
    '',
    'Before substantive work, read the complete parent contract, each selected method, and the resources those methods require. The excerpts above are routing aids, not substitutes for the files.',
    'Use the host tools, permitted connections, and isolated specialist contexts that materially help finish the requested result. Keep a narrow task direct. A role suggestion does not mean a specialist ran.',
    'Preserve the user scope and current permissions. This context grants no authority to publish, spend, deploy, send, persist learning, disclose feedback, or perform another external mutation.',
    '</conquistador-request-context>',
  );
  const context = lines.join('\n');
  if (context.length > MAX_CONTEXT_CHARACTERS) fail('Selected Conquistador context exceeds its budget.');
  return context;
}

function abstain(reason) {
  return { schemaVersion: REQUEST_CONTEXT_SCHEMA_VERSION, action: 'abstain', reason, selected: [], workflow: null, role: null, context: '' };
}

export function selectRequestContext(prompt, { root = moduleRoot } = {}) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0 || Buffer.byteLength(prompt) > MAX_PROMPT_BYTES) return abstain('invalid-prompt');
  if (unrelatedCoding.test(prompt)) return abstain('unrelated-coding');
  const packageRoot = resolve(root);
  if (/[\x00-\x1f\x7f]/.test(packageRoot)) fail('Invalid Conquistador package root.');
  const restriction = loadRestriction(packageRoot);
  const { parentPath, document, records } = loadMethods(packageRoot, restriction);
  if (loadProfileActivation(packageRoot, parentPath) === 'off') return abstain('activation-off');
  const query = requestText(prompt);
  const selected = selectRanked(rankRecords(query, records));
  if (!selected.length) return abstain('no-relevant-capability');
  for (const item of selected) item.resources = linkedResources(packageRoot, item);
  const workflow = selectWorkflow(packageRoot, parentPath, query, selected, restriction);
  const role = selectRole(packageRoot, parentPath, query, selected, restriction);
  const parent = posix.join(parentPath, document);
  return {
    schemaVersion: REQUEST_CONTEXT_SCHEMA_VERSION,
    action: 'route',
    reason: 'relevant-capability',
    selected: selected.map(({ name, label, path, resources }) => ({ name, label, path, resources })),
    workflow: workflow ? { name: workflow.name, label: workflow.label, path: workflow.path } : null,
    role: role ? { name: role.name, label: role.label, path: role.path } : null,
    context: formatContext({ root: packageRoot, parent, selected, workflow, role }),
  };
}
