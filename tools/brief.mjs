// Briefing engine: decide which playbooks the agent must read for one task.
// Method selection reuses the phrase router. Knowledge ranking is deterministic BM25 over
// every knowledge file in the selected methods, the shared parent library, and optional
// user playbooks. The same brief feeds the MCP tool, the hooks, the CLI, and the bot pack.
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, extname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectRequestContext } from './context-selection.mjs';
import { explicitInvocation, normalizeRequest } from './request-text.mjs';
import { loadRoutingContract } from './routing-contract.mjs';

export const BRIEF_SCHEMA = 'conquistador.brief/v1';
export const LIMITS = Object.freeze({
  mustFiles: 8,
  mustBytes: 90_000,
  situationalFiles: 8,
  userFiles: 4000,
  userFileBytes: 262_144,
  userDepth: 8,
  packBytes: 400_000,
});
const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Platforms and channels the user can name. Each maps to the file stems used in the library.
export const PLATFORMS = Object.freeze({
  'product hunt': ['producthunt', 'product-hunt'],
  producthunt: ['producthunt', 'product-hunt'],
  'hacker news': ['showhn', 'hacker-news'],
  'show hn': ['showhn', 'hacker-news'],
  tiktok: ['tiktok'],
  reddit: ['reddit'],
  linkedin: ['linkedin', 'linkedin-launch'],
  twitter: ['x', 'x-launch'],
  'x com': ['x', 'x-launch'],
  youtube: ['youtube', 'shorts'],
  shorts: ['shorts'],
  reels: ['reels', 'instagram'],
  instagram: ['instagram', 'reels'],
  facebook: ['facebook'],
  newsletter: ['newsletter', 'email-newsletter'],
  ugc: ['ugc'],
  'founder demo': ['founder-demo'],
  'app store': ['app-store', 'aso'],
});
const STOP = new Set('a an and are as at be but by can do for from get give help how i if in into is it its let me my need of on or our please should so than that the their them then there these this to up us use using want we what when which who why will with would you your conquistador make draft create write plan new next our'.split(' '));
const PROCESS = /(?:^|\/)fallbacks\/|(?:^|\/|-)(?:format-conventions|legibility-convention|why-this-works-convention|inputs-and-outputs)\.md$|\.ya?ml$/;
const text = value => normalizeRequest(value);
// Implicit prompts reach the lexical fallback only with business vocabulary and no coding vocabulary.
const BUSINESS = /\b(?:launch|campaign|marketing|growth|gtm|go to market|pricing|price|positioning|brand|audience|icp|persona|copy|copywriting|headline|landing page|seo|aeo|ads?|advertis\w*|funnel|churn|retention|activation|emails?|drip|lifecycle|nurture|newsletter|referral|affiliate|influencer|creator|ugc|content|social|post|outreach|cold email|sales|pipeline|leads?|conversion|signups?|waitlist|press|pr|community|virality|viral|offer|messaging|competitor|market)\b/;
const CODING = /\b(?:bug|test|tests|stack trace|exception|compile|refactor|lint|typecheck|function|class|endpoint|migration|schema migration|deploy|dockerfile|kubernetes|regex|null pointer|segfault|merge conflict|pull request|git)\b/;
const stem = word => word.length > 4 && word.endsWith('ies') ? `${word.slice(0, -3)}y`
  : word.length > 5 && word.endsWith('ing') ? word.slice(0, -3)
    : word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
export const terms = value => text(value).split(' ').filter(word => word.length > 1 && !STOP.has(word)).map(stem);

function frontmatter(raw) {
  const source = raw.replace(/^\uFEFF?\s*/, '');
  if (!source.startsWith('---\n')) return { body: source, meta: {} };
  const end = source.indexOf('\n---', 4);
  if (end < 0) return { body: source, meta: {} };
  const meta = {};
  for (const line of source.slice(4, end).split('\n')) {
    const match = /^([a-z_]+):\s*"?(.*?)"?\s*$/i.exec(line);
    if (match) meta[match[1]] = match[2];
  }
  return { body: source.slice(end + 4), meta };
}

export function describe(source) {
  const { body, meta } = frontmatter(source);
  const headings = [...body.matchAll(/^#{1,3}\s+(.+)$/gm)].map(match => match[1].trim());
  const title = meta.title || headings[0] || '';
  const paragraph = body.split(/\n\s*\n/).map(block => block.trim())
    .find(block => block && !block.startsWith('#') && !block.startsWith('```') && !block.startsWith('|') && !block.startsWith('<!--')) ?? '';
  const summary = (meta.summary || meta.description || paragraph).replace(/\s+/g, ' ').replace(/[*_`]/g, '').slice(0, 220);
  return { title, headings, summary, body };
}

export function classify(key) {
  if (PROCESS.test(key)) return 'process';
  if (/\/platform-intelligence\//.test(key)) return 'platform';
  if (/^conquistador\/channels\//.test(key)) return 'channel';
  if (/(?:^|\/)examples?(?:\/|\.md$)/.test(key)) return 'example';
  if (/\/agents\//.test(key)) return 'specialist';
  if (/^conquistador\/workflows\//.test(key)) return 'workflow';
  if (/^conquistador\/standards\//.test(key)) return 'standard';
  if (/anti-patterns\.md$/.test(key)) return 'checklist';
  return 'playbook';
}

const priorWeight = { playbook: 1.25, checklist: 1, platform: 1.1, channel: 1.1, specialist: 0.7, example: 0.8, workflow: 0.9, standard: 0.4, process: 0, user: 1.6 };

function walkMarkdown(root, { limitFiles, limitBytes, depth, followRoot = false }) {
  const found = [];
  const visit = (directory, level) => {
    if (level > depth || found.length >= limitFiles) return;
    let names;
    try { names = readdirSync(directory).sort(); } catch { return; }
    for (const name of names) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const path = join(directory, name);
      let stat;
      try { stat = lstatSync(path); } catch { continue; }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) visit(path, level + 1);
      else if (stat.isFile() && ['.md', '.markdown', '.txt'].includes(extname(name).toLowerCase()) && stat.size <= limitBytes && found.length < limitFiles) found.push(path);
    }
  };
  if (followRoot || !lstatSync(root).isSymbolicLink()) visit(root, 0);
  return found;
}

function document(absolute, key, { source, method }) {
  // Callers pass planned entries; only these fields matter.
  let raw;
  try { raw = readFileSync(absolute, 'utf8'); } catch { return null; }
  if (raw.includes('\0')) return null;
  const info = describe(raw);
  const pathTerms = terms(key.replace(/\.[a-z]+$/i, '').replace(/[/_.-]/g, ' '));
  const titleTerms = terms([info.title, ...info.headings.slice(0, 12)].join(' '));
  const bodyTerms = terms(info.body.slice(0, 40_000));
  const tf = new Map();
  const add = (list, weight) => { for (const word of list) tf.set(word, (tf.get(word) ?? 0) + weight); };
  add(pathTerms, 4);
  add(titleTerms, 2);
  add(terms(info.summary), 2);
  add(bodyTerms, 1);
  const kind = source === 'user' ? 'user' : classify(key);
  const digest = createHash('sha256').update(raw).digest('hex');
  const nameTerms = new Set(terms(posix.basename(key).replace(/\.[a-z]+$/i, '').replace(/[_.-]/g, ' ')));
  return { key, absolute, source, method, kind, digest, nameTerms, title: info.title, summary: info.summary, bytes: Buffer.byteLength(raw), tf, length: bodyTerms.length + pathTerms.length * 4 + titleTerms.length * 2 };
}

export function userPlaybookRoots({ env = process.env, home = homedir() } = {}) {
  const roots = [];
  if (env.CONQUISTADOR_PLAYBOOKS) roots.push(...env.CONQUISTADOR_PLAYBOOKS.split(delimiter).filter(Boolean));
  try {
    const config = JSON.parse(readFileSync(join(env.CONQUISTADOR_HOME || join(home, '.conquistador'), 'config.json'), 'utf8'));
    if (Array.isArray(config.playbooks)) roots.push(...config.playbooks.filter(item => typeof item === 'string'));
  } catch { /* No config file is the normal case. */ }
  const defaultRoot = join(env.CONQUISTADOR_HOME || join(home, '.conquistador'), 'playbooks');
  try { if (statSync(defaultRoot).isDirectory()) roots.push(defaultRoot); } catch { /* Optional. */ }
  return [...new Set(roots.map(item => resolve(item.replace(/^~(?=$|\/)/, home))))];
}

const cache = new Map();
const INDEX_VERSION = 3;
const cacheDirectory = () => process.env.CONQUISTADOR_CACHE || join(tmpdir(), 'conquistador-cache');
const serialize = doc => ({ ...doc, tf: [...doc.tf], nameTerms: [...doc.nameTerms] });
const revive = doc => ({ ...doc, tf: new Map(doc.tf), nameTerms: new Set(doc.nameTerms) });

// Index every knowledge file. The on-disk cache is keyed by each file's path, size, and mtime,
// so an edited playbook or a plugin update rebuilds it. Hooks run per prompt and need this.
export function knowledgeIndex(root = moduleRoot, { playbooks = userPlaybookRoots() } = {}) {
  const packageRoot = realpathSync(resolve(root));
  const cacheKey = `${packageRoot}\0${playbooks.join('\0')}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const contract = loadRoutingContract(packageRoot);
  const libraryRoot = posix.dirname(contract.parentPath);
  const entryName = posix.basename(contract.methods[Object.keys(contract.methods)[0]].path);
  const planned = [];
  const library = join(packageRoot, libraryRoot);
  for (const name of readdirSync(library).sort()) {
    const methodDir = join(library, name);
    if (!lstatSync(methodDir).isDirectory()) continue;
    for (const absolute of walkMarkdown(methodDir, { limitFiles: 2000, limitBytes: 1_000_000, depth: 8 })) {
      const inner = relative(methodDir, absolute).split(sep).join('/');
      if (inner === entryName || inner === 'SKILL.md' || inner === 'METHOD.md') continue;
      planned.push({ absolute, key: `${name}/${inner}`, source: name === 'conquistador' ? 'shared' : 'method', method: name });
    }
  }
  for (const userRoot of playbooks) {
    let real;
    try { real = realpathSync(userRoot); } catch { continue; }
    if (real === packageRoot || real.startsWith(`${packageRoot}${sep}`)) continue;
    let stat;
    try { stat = statSync(real); } catch { continue; }
    const files = stat.isDirectory() ? walkMarkdown(real, { limitFiles: LIMITS.userFiles, limitBytes: LIMITS.userFileBytes, depth: LIMITS.userDepth, followRoot: true }) : stat.isFile() ? [real] : [];
    for (const absolute of files) planned.push({ absolute, key: relative(dirname(real), absolute).split(sep).join('/'), source: 'user', method: null });
  }
  const signature = createHash('sha256').update(JSON.stringify([INDEX_VERSION, packageRoot, planned.map(item => {
    try { const stat = statSync(item.absolute); return [item.absolute, item.source, stat.size, stat.mtimeMs]; } catch { return [item.absolute]; }
  })])).digest('hex');
  const cacheFile = join(cacheDirectory(), `index-${signature.slice(0, 32)}.json`);
  let all;
  try {
    const stored = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (stored.signature === signature) all = stored.docs.map(revive);
  } catch { /* Build below. */ }
  if (!all) {
    all = planned.map(item => document(item.absolute, item.key, item)).filter(Boolean);
    try {
      mkdirSync(cacheDirectory(), { recursive: true, mode: 0o700 });
      const temporary = `${cacheFile}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify({ signature, docs: all.map(serialize) }), { mode: 0o600 });
      renameSync(temporary, cacheFile);
    } catch { /* A read-only temp directory only costs speed. */ }
  }
  const docs = all.filter(doc => doc.source !== 'user');
  const users = all.filter(doc => doc.source === 'user');
  const df = new Map();
  for (const doc of all) for (const word of doc.tf.keys()) df.set(word, (df.get(word) ?? 0) + 1);
  const averageLength = all.reduce((sum, doc) => sum + doc.length, 0) / Math.max(all.length, 1);
  const value = { packageRoot, contract, libraryRoot, entryName, docs, users, df, total: all.length, averageLength };
  cache.set(cacheKey, value);
  return value;
}

function bm25(doc, query, index) {
  // A file named after the request ("hooks" → hook-archetypes.md) is a strong signal on its own.
  let score = [...new Set(query)].filter(word => !GENERIC.has(word) && !['dev', 'developer', 'saas', 'ios', 'mobile'].includes(word) && doc.nameTerms.has(word)).length * 3;
  // Long schemas and contracts crowd out playbooks; keep them available but lower.
  const sizeFactor = doc.bytes > 16_000 ? 0.6 : 1;
  for (const word of new Set(query)) {
    const frequency = doc.tf.get(word);
    if (!frequency) continue;
    const idf = Math.log(1 + (index.total - (index.df.get(word) ?? 0) + 0.5) / ((index.df.get(word) ?? 0) + 0.5));
    score += idf * (frequency * 2.2) / (frequency + 1.2 * (0.25 + 0.75 * doc.length / index.averageLength));
  }
  return score * sizeFactor;
}

export function namedPlatforms(prompt) {
  const normalized = ` ${text(prompt)} `;
  const found = new Set();
  for (const [phrase, stems] of Object.entries(PLATFORMS)) if (normalized.includes(` ${phrase} `)) for (const item of stems) found.add(item);
  if (/(?:^|\s)(?:on|to|for) x(?:\s|$)|\bx (?:post|thread|launch)\b/.test(normalized)) { found.add('x'); found.add('x-launch'); }
  return [...found];
}

// Lexical fallback for explicit invocations and platform-only prompts the phrase router cannot place.
// A method also earns credit when its own knowledge files match the request ("hooks" → hook-archetypes).
// Practitioner words mapped to the library's own vocabulary.
const SYNONYMS = Object.freeze({ onboard: ['lifecycle', 'activation'], welcome: ['lifecycle'], drip: ['lifecycle'], nurture: ['lifecycle'], winback: ['lifecycle'], churn: ['retention'], refer: ['referral'], affiliate: ['referral'], seo: ['search'], aeo: ['search', 'answer'], geo: ['answer', 'visibility'], ad: ['paid'], cold: ['outreach'], dm: ['outreach'], hook: ['opening'], tagline: ['copy', 'headline'], gtm: ['launch', 'campaign'], pmf: ['positioning'] });
export const expand = words => [...new Set(words.flatMap(word => [word, ...(SYNONYMS[word] ?? [])]))];
const GENERIC = new Set(['app', 'product', 'tool', 'company', 'startup', 'business', 'team', 'user', 'customer', 'brand', 'new', 'good', 'best', 'idea', 'help', 'program']);
function lexicalMethods(prompt, index, platforms, limit = 2) {
  const query = expand(terms(prompt)).filter(word => !GENERIC.has(word));
  if (!query.length) return [];
  const candidates = [
    ...Object.values(index.contract.methods).map(method => ({ method, words: [method.name.replace(/-/g, ' '), method.label, method.description, ...method.intents] })),
    // Workflows with their own sub-method folder behave like methods for knowledge purposes.
    ...(index.contract.workflows ?? []).filter(item => index.docs.some(doc => doc.key.startsWith(`conquistador/references/${item.name}/`)))
      .map(item => ({ method: { ...item, workflow: true }, words: [item.name.replace(/-/g, ' '), item.label, item.description] })),
  ];
  const scoredMethods = candidates.map(({ method, words: source }) => {
    const words = new Set(terms(source.join(' ')));
    const own = index.docs.filter(doc => (method.workflow ? doc.key.startsWith(`conquistador/references/${method.name}/`) : doc.method === method.name) && doc.kind !== 'process');
    const pathWords = new Set(own.flatMap(doc => [...doc.nameTerms]));
    const hasPlatform = platforms.some(item => own.some(doc => doc.kind === 'platform' && posix.basename(doc.key, '.md') === item));
    const nameHit = query.filter(word => terms(method.name.replace(/-/g, ' ')).includes(word)).length;
    const score = query.filter(word => words.has(word)).length + nameHit + 0.75 * query.filter(word => pathWords.has(word)).length + (hasPlatform ? 1 : 0);
    return { method, score };
  }).sort((a, b) => b.score - a.score || a.method.name.localeCompare(b.method.name));
  // Two matching words place a method. One strong word places only the single best method.
  const strong = ranked => ranked.filter(item => item.score >= 2).slice(0, limit);
  const placed = strong(scoredMethods);
  return (placed.length ? placed : scoredMethods.filter(item => item.score >= 1).slice(0, 1)).map(item => item.method);
}

const reasonFor = (doc, platforms) => {
  if (doc.kind === 'user') return `Your playbook${doc.summary ? `: ${doc.summary}` : ''}`;
  if ((doc.kind === 'platform' || doc.kind === 'channel') && platforms.some(item => posix.basename(doc.key, '.md') === item)) return `You named this platform. ${doc.summary}`.trim();
  if (doc.kind === 'checklist') return 'Check the draft against these failure patterns before you answer.';
  return doc.summary || doc.title;
};

export function createBrief(prompt, { root = moduleRoot, playbooks, force = false } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw Error('Describe the task.');
  const packageRoot = realpathSync(resolve(root));
  const routed = selectRequestContext(prompt, { root: packageRoot });
  const explicit = explicitInvocation(prompt);
  const platforms = namedPlatforms(prompt);
  const business = BUSINESS.test(text(prompt)) && !CODING.test(text(prompt));
  // Skip the index for prompts that are clearly not Conquistador work; hooks run on every prompt.
  if (routed.action !== 'route' && !explicit && !force && !platforms.length && !business) {
    return { schema: BRIEF_SCHEMA, action: 'none', reason: routed.reason ?? 'no-relevant-capability', methods: [], must: [], situational: [], platforms: [], packageRoot };
  }
  const index = knowledgeIndex(packageRoot, playbooks ? { playbooks } : undefined);
  const { contract, libraryRoot } = index;
  let methods = routed.action === 'route' ? routed.selected.map(item => contract.methods[item.name]).filter(Boolean) : [];
  if (!methods.length && (explicit || force || platforms.length || business)) methods = lexicalMethods(prompt, index, platforms);
  // A routed composition workflow brings its own sub-method folder.
  if (routed.action === 'route' && routed.workflow && !methods.some(item => item.name === routed.workflow.name)) {
    const workflow = (contract.workflows ?? []).find(item => item.name === routed.workflow.name);
    if (workflow && index.docs.some(doc => doc.key.startsWith(`conquistador/references/${workflow.name}/`))) methods.push({ ...workflow, workflow: true });
  }
  const query = expand(terms(prompt));
  const selectedNames = new Set(methods.map(item => item.name));
  if (!methods.length && !platforms.length && !(explicit || force)) {
    return { schema: BRIEF_SCHEMA, action: 'none', reason: routed.reason ?? 'no-relevant-capability', methods: [], must: [], situational: [], platforms: [], packageRoot };
  }
  const required = new Set(methods.flatMap(item => item.requiredResources ?? []).map(path => path.slice(libraryRoot.length + 1)));
  const scored = [...index.docs, ...index.users].map(doc => {
    if (doc.kind === 'process') return null;
    const workflowDoc = doc.source === 'shared' && [...selectedNames].some(name => doc.key.startsWith(`conquistador/references/${name}/`) || doc.key === `conquistador/workflows/${name}.md`);
    const inMethod = (doc.method && doc.source === 'method' && selectedNames.has(doc.method)) || workflowDoc;
    const shared = doc.source === 'shared';
    const stemName = posix.basename(doc.key, posix.extname(doc.key));
    const platformHit = (doc.kind === 'platform' || doc.kind === 'channel') && platforms.includes(stemName);
    if (!inMethod && !shared && doc.source !== 'user' && !platformHit) return null;
    if (doc.kind === 'platform' && !platformHit) return null;
    if (doc.kind === 'channel' && !platformHit) return null;
    const lexical = bm25(doc, query, index) * (priorWeight[doc.kind] ?? 1);
    let score = lexical;
    if (inMethod) score += 2;
    if (required.has(doc.key)) score += 3;
    if (platformHit) score += inMethod || doc.kind === 'channel' ? 12 : 6;
    if (shared && !platformHit && !workflowDoc) score *= 0.55;
    if (doc.source === 'user' && score < 4) return null;
    return { doc, score, lexical, owner: workflowDoc ? [...selectedNames].find(name => doc.key.startsWith(`conquistador/references/${name}/`) || doc.key === `conquistador/workflows/${name}.md`) : doc.method };
  }).filter(item => item && item.score > 0.5).sort((a, b) => b.score - a.score || a.doc.key.localeCompare(b.doc.key));

  const must = [];
  let bytes = 0;
  const take = (item, why) => {
    if (must.some(entry => entry.doc.digest === item.doc.digest)) return;
    if (must.length >= LIMITS.mustFiles || (bytes + item.doc.bytes > LIMITS.mustBytes && must.length >= 3)) return;
    must.push({ ...item, why });
    bytes += item.doc.bytes;
  };
  // 1. Platform packs and channel guides the user named.
  for (const item of scored.filter(entry => entry.doc.kind === 'platform' || entry.doc.kind === 'channel')) {
    const inPrimary = item.doc.method === methods[0]?.name || item.doc.kind === 'channel';
    if (inPrimary || !scored.some(entry => entry.doc.kind === 'platform' && entry.doc.method === methods[0]?.name && posix.basename(entry.doc.key) === posix.basename(item.doc.key))) take(item);
    if (must.length >= 3) break;
  }
  // 2. The user's own playbooks outrank generic method knowledge.
  // Keep only strong matches: within 60% of the best user playbook for this task.
  const userHits = scored.filter(entry => entry.doc.kind === 'user');
  for (const item of userHits.filter(entry => entry.score >= (userHits[0]?.score ?? 0) * 0.6).slice(0, 3)) take(item);
  // 3. Core playbooks of each selected method, primary first.
  methods.forEach((method, position) => {
    const quota = position === 0 ? 3 : 1;
    // The strongest two always count; a third needs its own lexical match, not only membership.
    if (method.workflow) {
      const contractFile = scored.find(entry => entry.doc.key === `conquistador/workflows/${method.name}.md`);
      if (contractFile) take(contractFile, `Composition contract for ${method.label}.`);
    }
    scored.filter(entry => entry.owner === method.name && entry.doc.kind === 'playbook')
      .filter((entry, rank) => rank < Math.min(quota, 2) || entry.lexical >= 3).slice(0, quota).forEach(item => take(item));
  });
  // 4. Anti-patterns of the primary method: the final check.
  const checklist = scored.find(entry => entry.owner === methods[0]?.name && entry.doc.kind === 'checklist');
  if (checklist) take(checklist);
  // 5. Fill any remaining room with the strongest remaining matches.
  // Shared parent files stay situational unless the user named their platform.
  for (const item of scored) if (must.length < Math.min(LIMITS.mustFiles, 6) && !['example', 'checklist'].includes(item.doc.kind) && selectedNames.has(item.owner)) take(item);

  const seen = new Set(must.map(item => item.doc.digest));
  const situational = scored.filter(item => !seen.has(item.doc.digest) && seen.add(item.doc.digest)).slice(0, LIMITS.situationalFiles);
  const view = item => ({
    path: item.doc.source === 'user' ? item.doc.absolute : `${libraryRoot}/${item.doc.key}`,
    absolute: item.doc.absolute,
    source: item.doc.source,
    kind: item.doc.kind,
    title: item.doc.title,
    why: item.why ?? reasonFor(item.doc, platforms),
    bytes: item.doc.bytes,
    score: Number(item.score.toFixed(3)),
  });
  return {
    schema: BRIEF_SCHEMA,
    action: 'brief',
    reason: methods.length ? 'relevant-capability' : 'platform-only',
    packageRoot,
    parent: { path: contract.parentPath, absolute: join(packageRoot, contract.parentPath) },
    methods: methods.map(method => ({ name: method.name, label: method.label, path: method.path, absolute: join(packageRoot, method.path), workflow: Boolean(method.workflow) })),
    platforms,
    must: must.map(view),
    situational: situational.map(view),
    standards: ['quality.md', 'safety.md'].map(name => `${libraryRoot}/conquistador/standards/${name}`).map(path => ({ path, absolute: join(packageRoot, path) })),
  };
}

const clip = value => (value.length > 150 ? `${value.slice(0, 147).replace(/\s+\S*$/, '')}…` : value);
const location = (item, absolute) => (absolute || isAbsolute(item.path) ? item.absolute : item.path);

// Compact form for hooks: paths and reasons, no file text. Stays under host context limits.
export function formatReadingList(brief, { absolute = true, limit = 9000 } = {}) {
  if (brief.action !== 'brief') return '';
  const lines = [
    '<conquistador-brief>',
    `Conquistador matched this request${brief.methods.length ? `: ${brief.methods.map(item => item.label).join(' + ')}` : ''}.`,
    'These are field-tested playbooks for this exact task. Your answer is judged against them.',
    '',
    'READ IN FULL BEFORE YOU DRAFT (use your file-read tool; do not skim or guess their content):',
  ];
  for (const item of brief.methods) lines.push(`- ${location(item, absolute)}  — method: ${item.label}`);
  brief.must.forEach(item => lines.push(`- ${location(item, absolute)}  — ${clip(item.why)}`));
  if (brief.situational.length) {
    lines.push('', 'Read when the task reaches that step:');
    for (const item of brief.situational.slice(0, 6)) lines.push(`- ${location(item, absolute)}  — ${clip(item.why)}`);
  }
  lines.push(
    '',
    'Then:',
    '1. Apply the specific rules from these files. Where you deviate, say why.',
    '2. End the answer with "Playbooks applied": each file you used and the rule you took from it.',
    '3. Never invent metrics, quotes, or customer facts. Mark assumptions.',
    'If the Conquistador MCP tool conquistador_brief is available, it returns all of these files in one call.',
    '</conquistador-brief>',
  );
  let output = lines.join('\n');
  if (output.length > limit) output = `${output.slice(0, limit - 40)}\n…\n</conquistador-brief>`;
  return output;
}

function readText(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

// Full form for MCP and the CLI: method bodies and must-read files inline.
export function formatBriefPack(brief, { limit = LIMITS.packBytes } = {}) {
  if (brief.action !== 'brief') {
    return 'No Conquistador method matches this task. For growth, GTM, marketing, sales, or product work, restate the outcome (for example "plan a Product Hunt launch") or call conquistador_search.';
  }
  const parts = [
    '# Conquistador brief',
    '',
    `Methods: ${brief.methods.map(item => `${item.label} [${item.name}]`).join(', ') || 'none; platform guidance only'}`,
    brief.platforms.length ? `Platforms named: ${brief.platforms.join(', ')}` : '',
    '',
    'Rules for this task:',
    '1. The files below are the playbooks for this task. Follow their specific rules; generic advice is not a substitute.',
    '2. End your answer with "Playbooks applied": each file you used and the rule you took from it.',
    '3. Never invent metrics, quotes, or customer facts. Mark assumptions. Ask before publishing, spending, or sending.',
    '4. Read a "situational" file with conquistador_read when the task reaches that step.',
    '',
  ].filter(line => line !== undefined);
  let size = Buffer.byteLength(parts.join('\n'));
  const push = (heading, path, body) => {
    const block = `\n---\n\n## ${heading}\n\nFile: ${path}\n\n${body.trim()}\n`;
    const blockSize = Buffer.byteLength(block);
    if (size + blockSize > limit) { parts.push(`\n(${path} omitted: response budget reached. Read it with conquistador_read.)`); return; }
    parts.push(block);
    size += blockSize;
  };
  for (const method of brief.methods) {
    const body = readText(method.absolute);
    if (body) push(`Method: ${method.label}`, method.path, body);
  }
  for (const item of brief.must) {
    const body = readText(item.absolute);
    if (body) push(`${item.source === 'user' ? 'Your playbook' : 'Playbook'}: ${item.title || posix.basename(item.path)}`, item.path, `Why: ${item.why}\n\n${body}`);
  }
  if (brief.situational.length) {
    parts.push('\n---\n\n## Situational (read with conquistador_read when needed)\n');
    for (const item of brief.situational) parts.push(`- ${item.path} — ${item.why}`);
  }
  return parts.join('\n');
}

// Search the whole library, not only the selected methods.
export function searchKnowledge(query, { root = moduleRoot, playbooks, limit = 12 } = {}) {
  const index = knowledgeIndex(root, playbooks ? { playbooks } : undefined);
  const words = terms(query);
  return [...index.docs, ...index.users].filter(doc => doc.kind !== 'process')
    .map(doc => ({ doc, score: bm25(doc, words, index) * (priorWeight[doc.kind] ?? 1) }))
    .filter(item => item.score > 0.5)
    .sort((a, b) => b.score - a.score || a.doc.key.localeCompare(b.doc.key))
    .slice(0, limit)
    .map(item => ({ path: item.doc.source === 'user' ? item.doc.absolute : `${index.libraryRoot}/${item.doc.key}`, source: item.doc.source, kind: item.doc.kind, title: item.doc.title, summary: item.doc.summary, score: Number(item.score.toFixed(3)) }));
}

export function readKnowledge(path, { root = moduleRoot, playbooks } = {}) {
  const index = knowledgeIndex(root, playbooks ? { playbooks } : undefined);
  if (typeof path !== 'string' || !path || path.includes('\0')) throw Error('Invalid path.');
  const user = index.users.find(doc => doc.absolute === path);
  if (user) return readFileSync(user.absolute, 'utf8');
  const clean = posix.normalize(path.replace(/^\.\//, ''));
  if (clean.startsWith('..') || isAbsolute(clean)) throw Error('Path is outside the Conquistador library.');
  const candidates = [clean, `${index.libraryRoot}/${clean}`, clean.replace(/^skills\//, `${index.libraryRoot}/`)];
  for (const candidate of candidates) {
    const absolute = join(index.packageRoot, candidate);
    const rel = relative(join(index.packageRoot, index.libraryRoot), absolute);
    if (rel.startsWith('..') || isAbsolute(rel)) continue;
    try {
      const stat = lstatSync(absolute);
      if (stat.isFile() && !stat.isSymbolicLink() && stat.size <= 1_000_000) return readFileSync(absolute, 'utf8');
    } catch { /* Try the next layout. */ }
  }
  throw Error('File not found in the Conquistador library.');
}
