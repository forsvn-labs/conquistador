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
import { methodOwner } from './method-library.mjs';

export const BRIEF_SCHEMA = 'conquistador.brief/v1';
export const LIMITS = Object.freeze({
  mustFiles: 8,
  mustBytes: 90_000,
  situationalFiles: 8,
  userFiles: 4000,
  userFileBytes: 262_144,
  userDepth: 8,
  packBytes: 160_000,
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
  substack: ['newsletter', 'email-newsletter'],
  ugc: ['ugc'],
  'founder demo': ['founder-demo'],
  'app store': ['app-store', 'aso'],
  'google play': ['aso'],
  'play store': ['aso'],
  // Ad platforms. The longer phrase wins, so "LinkedIn ads" does not also pull organic LinkedIn.
  'google ads': ['google-ads'],
  'search ads': ['google-ads'],
  'meta ads': ['meta-cold-traffic', 'meta-retargeting'],
  'facebook ads': ['meta-cold-traffic', 'meta-retargeting'],
  'instagram ads': ['meta-cold-traffic', 'meta-retargeting'],
  'linkedin ads': ['linkedin-ads'],
  'tiktok ads': ['tiktok-ads'],
});
// Every stem a platform can bring. A named platform keeps its siblings out of the must-read list.
const PLATFORM_STEMS = new Set(Object.values(PLATFORMS).flat());
// Filler words carry no task signal ("I cannot find it, ask me", "learn the product first").
const STOP = new Set(('a an and are as at be but by can do for from get give help how i if in into is it its let me my need of on or our please should so than that the their them then there these this to up us use using want we what when which who why will with would you your conquistador make draft create write plan new next our '
  + 'cannot cant find found ask asked tell know learn look see show thing things something anything everything folder first only just also about go going got like really sure try work way lot some any all more most very much one now today still again back here not no yes am was were been being has have had does did done could may might must shall able sort kind well okay ok thanks thank hi hello').split(' '));
const PROCESS = /(?:^|\/)fallbacks\/|(?:^|\/|-)(?:format-conventions|legibility-convention|why-this-works-convention|inputs-and-outputs)\.md$|\.ya?ml$/;
const text = value => normalizeRequest(value);
// Implicit prompts reach the lexical fallback only with business vocabulary and no coding vocabulary.
const BUSINESS = /\b(?:launch|campaign|marketing|growth|gtm|go to market|pricing|price|positioning|brand|audience|icp|persona|copy|copywriting|headline|landing page|seo|aeo|ads?|advertis\w*|funnel|churn|retention|activation|emails?|drip|lifecycle|nurture|newsletter|referral|affiliate|influencer|creator|ugc|content|social|post|outreach|cold email|sales|pipeline|leads?|conversion|signups?|waitlist|press|pr|community|virality|viral|offer|messaging|competitor|market)\b/;
const CODING = /\b(?:bug|fix|crash|sdk|api|webhook|component|handler|bot|integration|upload|render|button|font|css|server|database|test|tests|stack trace|exception|compile|refactor|lint|typecheck|function|class|endpoint|migration|schema migration|deploy|dockerfile|kubernetes|regex|null pointer|segfault|merge conflict|pull request|git)\b/;
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
  if (/^conquistador\/plays\/[^/]+\.md$/.test(key)) return 'play';
  // Provider recipes for `connect`: reference data, not playbooks.
  if (/^conquistador\/integrations\//.test(key)) return 'integration';
  if (/^conquistador\/standards\//.test(key)) return 'standard';
  if (/anti-patterns\.md$/.test(key)) return 'checklist';
  return 'playbook';
}

const priorWeight = { playbook: 1.25, checklist: 1, platform: 1.1, channel: 1.1, specialist: 0.7, example: 0.8, play: 0.9, integration: 1, standard: 0.4, process: 0, user: 1.6 };

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
const INDEX_VERSION = 4;
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
  const entryName = contract.document ?? 'SKILL.md';
  const planned = [];
  const parentDir = join(packageRoot, contract.parentPath);
  // One tree: shared parent files, commands/<name>/ (source "method"), and plays/<name>[.md|/] (source "play").
  for (const absolute of walkMarkdown(parentDir, { limitFiles: 6000, limitBytes: 1_000_000, depth: 10 })) {
    const inner = relative(parentDir, absolute).split(sep).join('/');
    if (inner === entryName || inner === 'SKILL.md' || inner === 'METHOD.md' || /^commands\/[^/]+\/COMMAND\.md$/.test(inner)) continue;
    const key = `conquistador/${inner}`;
    const owner = methodOwner(key);
    planned.push({ absolute, key, source: owner ? (inner.startsWith('plays/') ? 'play' : 'method') : 'shared', method: owner });
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
  // Round so that last-digit floating-point differences between Node versions cannot reorder ties.
  return Math.round(score * sizeFactor * 1e4) / 1e4;
}

export function namedPlatforms(prompt) {
  let normalized = ` ${text(prompt)} `;
  const found = new Set();
  // Longest phrase first; a matched phrase is consumed so its shorter parts do not match again.
  for (const phrase of Object.keys(PLATFORMS).sort((a, b) => b.length - a.length)) {
    if (!normalized.includes(` ${phrase} `)) continue;
    for (const item of PLATFORMS[phrase]) found.add(item);
    normalized = normalized.replaceAll(` ${phrase} `, ' \u0000 ');
  }
  if (/(?:^|\s)(?:on|to|for) x(?:\s|$)|\bx (?:post|thread|launch)\b/.test(normalized)) { found.add('x'); found.add('x-launch'); }
  return [...found];
}

// Lexical fallback for explicit invocations and platform-only prompts the phrase router cannot place.
// A method also earns credit when its own knowledge files match the request ("hooks" → hook-archetypes).
// Practitioner words mapped to the library's own vocabulary.
const SYNONYMS = Object.freeze({ onboard: ['lifecycle', 'activation'], welcome: ['lifecycle'], drip: ['lifecycle'], nurture: ['lifecycle'], winback: ['lifecycle'], churn: ['retention'], refer: ['referral'], affiliate: ['referral'], seo: ['search'], aeo: ['search', 'answer'], geo: ['answer', 'visibility'], ad: ['paid'], cold: ['outreach'], dm: ['outreach'], hook: ['opening'], tagline: ['copy', 'headline'], gtm: ['launch', 'campaign'], pmf: ['positioning'] });
export const expand = words => [...new Set(words.flatMap(word => [word, ...(SYNONYMS[word] ?? [])]))];
const GENERIC = new Set(['marketing', 'market', 'app', 'product', 'tool', 'company', 'startup', 'business', 'team', 'user', 'customer', 'brand', 'new', 'good', 'best', 'idea', 'help', 'program']);
function lexicalMethods(prompt, index, platforms, limit = 2) {
  const query = expand(terms(prompt)).filter(word => !GENERIC.has(word));
  if (!query.length) return [];
  // Commands and plays compete on the same words; a play keeps its own playbook folder.
  const candidates = [
    ...Object.values(index.contract.methods).map(method => ({ method, words: [method.label, method.description, ...method.intents, ...(method.aliases ?? [])] })),
    ...(index.contract.plays ?? []).map(play => ({ method: { ...play, play: true }, words: [play.label, play.description, ...play.intents] })),
  ];
  const scoredMethods = candidates.map(({ method, words: source }) => {
    const words = new Set(terms(source.join(' ')));
    const own = index.docs.filter(doc => doc.method === method.name && doc.source === (method.play ? 'play' : 'method') && doc.kind !== 'process');
    const pathWords = new Set(own.flatMap(doc => [...doc.nameTerms]));
    const hasPlatform = platforms.some(item => own.some(doc => doc.kind === 'platform' && posix.basename(doc.key, '.md') === item));
    const nameHit = query.filter(word => terms(method.name).includes(word)).length;
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

// The start flow's own instructions (tools/launch.mjs). They say how to work, not what the task
// is, and their words ("cannot find", "learn the product") would pull routing off the task.
export const START_CONTEXT = Object.freeze({
  project: 'Learn the product from this folder first. Ask me only for what you cannot find.',
  ask: 'First ask me what the product is, who it is for, and the goal.',
});
const START_LEAD = /^\s*Use Conquistador:\s*/i;
export const taskOf = prompt => Object.values(START_CONTEXT).reduce((rest, sentence) => rest.split(sentence).join(' '), prompt).replace(START_LEAD, '').trim();

export function createBrief(input, { root = moduleRoot, playbooks, force = false } = {}) {
  if (typeof input !== 'string' || !input.trim()) throw Error('Describe the task.');
  // "Use Conquistador:" asks for Conquistador by name, so it counts as an explicit invocation.
  const invoked = START_LEAD.test(input);
  const prompt = taskOf(input) || input;
  const packageRoot = realpathSync(resolve(root));
  const routed = selectRequestContext(prompt, { root: packageRoot });
  const explicit = invoked || explicitInvocation(prompt);
  const platforms = namedPlatforms(prompt);
  const coding = CODING.test(text(prompt));
  const business = BUSINESS.test(text(prompt)) && !coding;
  // A bare platform name engages the brief only outside coding work ("App Store Connect upload").
  const platformNamed = platforms.length > 0 && !coding;
  // Skip the index for prompts that are clearly not Conquistador work; hooks run on every prompt.
  if (routed.action !== 'route' && !explicit && !force && !platformNamed && !business) {
    return { schema: BRIEF_SCHEMA, action: 'none', reason: routed.reason ?? 'no-relevant-capability', methods: [], must: [], situational: [], platforms: [], packageRoot };
  }
  const index = knowledgeIndex(packageRoot, playbooks ? { playbooks } : undefined);
  const { contract, libraryRoot } = index;
  let methods = routed.action === 'route' ? routed.selected.map(item => contract.methods[item.name]).filter(Boolean) : [];
  let playName = routed.action === 'route' ? routed.play?.name : null;
  if (!methods.length && (explicit || force || platformNamed || business)) {
    const lexical = lexicalMethods(prompt, index, platforms);
    if (lexical[0]?.play) playName = lexical[0].name;
    methods = lexical.filter(item => !item.play);
  }
  const play = playName ? (contract.plays ?? []).find(item => item.name === playName) : null;
  // A play starts at its first unconditional command step; later steps are read when reached.
  const firstStep = play ? Math.max(0, play.chain.findIndex(step => step.command && !step.when)) : -1;
  if (play) {
    const lead = play.chain[firstStep]?.command;
    if (lead && contract.methods[lead]) methods = [contract.methods[lead], ...methods.filter(item => item.name !== lead)];
  }
  const query = expand(terms(prompt));
  const selectedNames = new Set(methods.map(item => item.name));
  if (!methods.length && !play && !platforms.length && !(explicit || force)) {
    return { schema: BRIEF_SCHEMA, action: 'none', reason: routed.reason ?? 'no-relevant-capability', methods: [], must: [], situational: [], platforms: [], packageRoot };
  }
  const required = new Set(methods.flatMap(item => item.requiredResources ?? []).map(path => path.slice(libraryRoot.length + 1)));
  const ownerOf = doc => (doc.source === 'method' && selectedNames.has(doc.method)) || (doc.source === 'play' && doc.method === play?.name) ? doc.method : null;
  const scoreDoc = (doc, owned) => {
    if (doc.kind === 'process') return null;
    // Integration recipes join the brief only for the connect command.
    if (doc.kind === 'integration') { if (!selectedNames.has('connect')) return null; owned = 'connect'; }
    const shared = doc.source === 'shared';
    const stemName = posix.basename(doc.key, posix.extname(doc.key));
    const platformHit = (doc.kind === 'platform' || doc.kind === 'channel') && platforms.includes(stemName);
    // A guide for another platform in the same family: situational only when the user named one.
    const sibling = platforms.length > 0 && PLATFORM_STEMS.has(stemName) && !platforms.includes(stemName);
    const namedGuide = !sibling && platforms.includes(stemName);
    if (!owned && !shared && doc.source !== 'user' && !platformHit) return null;
    if (doc.kind === 'platform' && !platformHit) return null;
    if (doc.kind === 'channel' && !platformHit) return null;
    const lexical = bm25(doc, query, index) * (priorWeight[doc.kind] ?? 1);
    let score = lexical;
    if (owned) score += 2;
    if (required.has(doc.key)) score += 3;
    if (platformHit) score += owned || doc.kind === 'channel' ? 12 : 6;
    else if (namedGuide && owned) score += 6;
    if (shared && !platformHit) score *= 0.55;
    if (doc.source === 'user' && score < 4) return null;
    return { doc, score, lexical, sibling, owner: owned };
  };
  const scored = [...index.docs, ...index.users].map(doc => scoreDoc(doc, ownerOf(doc)))
    .filter(item => item && item.score > 0.5).sort((a, b) => b.score - a.score || a.doc.key.localeCompare(b.doc.key));

  const must = [];
  let bytes = 0;
  const take = (item, why) => {
    if (item.sibling || must.some(entry => entry.doc.digest === item.doc.digest)) return;
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
  // 3. A play's own playbooks (its recovered method folder) come first among method knowledge.
  if (play) scored.filter(entry => entry.owner === play.name && entry.doc.source === 'play' && entry.doc.kind === 'playbook').slice(0, 2).forEach(item => take(item));
  // 4. Core playbooks of each selected method, primary first.
  methods.forEach((method, position) => {
    const quota = position === 0 ? 3 : 1;
    // The strongest two always count; a third needs its own lexical match, not only membership.
    scored.filter(entry => entry.owner === method.name && entry.doc.source === 'method' && entry.doc.kind === 'playbook')
      .filter((entry, rank) => rank < Math.min(quota, 2) || entry.lexical >= 3).slice(0, quota).forEach(item => take(item));
  });
  // 5. Anti-patterns of the primary method: the final check.
  const checklist = scored.find(entry => entry.owner === methods[0]?.name && entry.doc.source === 'method' && entry.doc.kind === 'checklist');
  if (checklist) take(checklist);
  // 6. Fill any remaining room with the strongest remaining matches.
  // Shared parent files stay situational unless the user named their platform.
  for (const item of scored) if (must.length < Math.min(LIMITS.mustFiles, 6) && !['example', 'checklist'].includes(item.doc.kind) && item.owner) take(item);

  // Nothing matched: say so instead of returning an empty reading list.
  if (!methods.length && !play && !must.length) {
    return { schema: BRIEF_SCHEMA, action: 'none', reason: 'no-relevant-capability', methods: [], must: [], situational: [], platforms, packageRoot };
  }
  const seen = new Set(must.map(item => item.doc.digest));
  if (play) { const own = index.docs.find(doc => `${libraryRoot}/${doc.key}` === play.path); if (own) seen.add(own.digest); }
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
  // Later play steps: each step's strongest playbooks, read when the work reaches that step.
  const steps = play ? play.chain.map((step, position) => {
    const name = step.command ?? step.method;
    const record = step.command ? contract.methods[step.command] : null;
    const label = record?.label ?? name.replaceAll('-', ' ');
    const now = position === firstStep;
    let playbooks = [];
    if (!now && step.command) {
      playbooks = index.docs.filter(doc => doc.source === 'method' && doc.method === step.command && doc.kind === 'playbook'
        && (!step.mode || !doc.key.includes('/references/modes/') || doc.key.includes(`/references/modes/${step.mode}`)))
        .map(doc => ({ doc, score: bm25(doc, query, index) + (record.requiredResources ?? []).includes(`${libraryRoot}/${doc.key}`) * 3 }))
        .sort((a, b) => b.score - a.score || a.doc.key.localeCompare(b.doc.key)).slice(0, 2)
        .filter(item => !seen.has(item.doc.digest)).map(item => view({ ...item, lexical: item.score }));
    }
    return { step: position + 1, ...(step.command ? { command: step.command } : { method: step.method }), label, path: step.path, absolute: join(packageRoot, step.path),
      ...(step.mode ? { mode: step.mode } : {}), ...(step.when ? { when: step.when } : {}), ...(step.for ? { for: step.for } : {}), now, playbooks };
  }) : [];
  for (const step of steps) for (const item of step.playbooks) seen.add(createHash('sha256').update(readText(item.absolute) ?? '').digest('hex'));
  const situational = scored.filter(item => !seen.has(item.doc.digest) && seen.add(item.doc.digest)).slice(0, LIMITS.situationalFiles);
  return {
    schema: BRIEF_SCHEMA,
    action: 'brief',
    reason: play ? 'play' : methods.length ? 'relevant-capability' : 'platform-only',
    packageRoot,
    parent: { path: contract.parentPath, absolute: join(packageRoot, contract.parentPath) },
    play: play ? { name: play.name, label: play.label, path: play.path, absolute: join(packageRoot, play.path), steps } : null,
    methods: methods.map(method => ({ name: method.name, label: method.label, path: method.path, absolute: join(packageRoot, method.path) })),
    platforms,
    must: must.map(view),
    situational: situational.map(view),
    standards: ['quality.md', 'safety.md'].map(name => `${contract.parentPath}/standards/${name}`).map(path => ({ path, absolute: join(packageRoot, path) })),
  };
}

const clip = value => (value.length > 150 ? `${value.slice(0, 147).replace(/\s+\S*$/, '')}…` : value);
const location = (item, absolute) => (absolute || isAbsolute(item.path) ? item.absolute : item.path);

// Compact form for hooks: paths and reasons, no file text. Stays under host context limits.
export function formatReadingList(brief, { absolute = true, limit = 9000 } = {}) {
  if (brief.action !== 'brief') return '';
  const lines = [
    '<conquistador-brief>',
    brief.play ? `Conquistador matched the play ${brief.play.name}: ${brief.play.label}.`
      : `Conquistador matched this request${brief.methods.length ? `: ${brief.methods.map(item => `${item.label} [${item.name}]`).join(' + ')}` : ''}.`,
    'These are field-tested playbooks for this exact task. Your answer is judged against them.',
    '',
  ];
  if (brief.play) {
    lines.push('Steps (run in order; skip a step whose condition is false):');
    for (const step of brief.play.steps) lines.push(`${step.step}. ${step.command ?? step.method}${step.mode ? ` (mode ${step.mode})` : ''}${step.when ? ` — when ${step.when}` : ''}${step.for ? ` — for ${step.for}` : ''}${step.now ? '  ← start here' : ''}`);
    lines.push('');
  }
  lines.push('READ IN FULL BEFORE YOU DRAFT (use your file-read tool; do not skim or guess their content):');
  if (brief.play) lines.push(`- ${location(brief.play, absolute)}  — play: ${brief.play.label}`);
  for (const item of brief.methods) lines.push(`- ${location(item, absolute)}  — command: ${item.label}`);
  brief.must.forEach(item => lines.push(`- ${location(item, absolute)}  — ${clip(item.why)}`));
  for (const step of brief.play?.steps ?? []) {
    if (step.now) continue;
    lines.push('', `Read at step ${step.step} (${step.command ?? step.method}):`, `- ${location(step, absolute)}  — ${step.command ? 'command' : 'method'}: ${step.label}`);
    for (const item of step.playbooks) lines.push(`- ${location(item, absolute)}  — ${clip(item.why)}`);
  }
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
    'If conquistador_brief is available, it returns selected files inline and labels omissions or unavailable files that still need a separate read.',
    '</conquistador-brief>',
  );
  let output = lines.join('\n');
  if (output.length > limit) output = `${output.slice(0, limit - 40)}\n…\n</conquistador-brief>`;
  return output;
}

function readText(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

// Evidence describes text returned by the tool, not whether a model used or understood it.
// Normalize host line endings and outer whitespace only; all internal content stays exact.
export const normalizeKnowledgeText = text => text.replace(/\r\n/g, '\n').trim();

export function knowledgeFileEvidence(item, body = readText(item.absolute)) {
  if (body === null) return { id: item.path, status: 'unavailable' };
  const text = normalizeKnowledgeText(body);

  return { id: item.path, status: 'complete', bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
}

const evidenceMarker = evidence => `<!-- conquistador-file ${JSON.stringify(evidence)} -->`;

const fileEnd = '<!-- /conquistador-file -->';

function clipUtf8(text, limit) {
  const bytes = Buffer.from(text);

  if (bytes.length <= limit) return text;
  let end = Math.max(0, limit);

  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;

  return bytes.subarray(0, end).toString('utf8');
}

// Full form for MCP and the CLI. Only complete, digest-checked blocks count as returned files.
export function formatBriefPack(brief, { limit = LIMITS.packBytes } = {}) {
  if (brief.action !== 'brief') {
    return 'No Conquistador method matches this task. For growth, GTM, marketing, sales, or product work, restate the outcome and channel (for example "write a win-back email flow", "get recommended by ChatGPT", or "plan a TikTok series") or call conquistador_search.';
  }

  limit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : LIMITS.packBytes;

  const header = [
    '# Conquistador brief',
    '',
    brief.play ? `Play: ${brief.play.label} [${brief.play.name}]` : '',
    brief.play ? brief.play.steps.map(step => `${step.step}. ${step.command ?? step.method}${step.mode ? ` (mode ${step.mode})` : ''}${step.when ? ` — when ${step.when}` : ''}${step.for ? ` — for ${step.for}` : ''}${step.now ? ' ← start here' : ''}`).join('\n') : '',
    `Commands: ${brief.methods.map(item => `${item.label} [${item.name}]`).join(', ') || 'none; platform guidance only'}`,
    brief.platforms.length ? `Platforms named: ${brief.platforms.join(', ')}` : '',
    '',
    'Rules for this task:',
    '1. Follow the specific rules in the playbooks; generic advice is not a substitute.',
    '2. End your answer with "Playbooks applied": each file you used and the rule you took from it.',
    '3. Never invent metrics, quotes, or customer facts. Mark assumptions. Ask before publishing, spending, or sending.',
    '4. Read a "situational" file with conquistador_read when the task reaches that step.',
    'Files marked omitted or unavailable still need a separate successful read.',
    '',
  ].join('\n');

  const entries = [...(brief.play ? [{ item: brief.play, heading: `Play: ${brief.play.label}` }] : []), ...brief.methods.map(item => ({ item, heading: `Command: ${item.label}` })),
    ...brief.must.map(item => ({ item, heading: `${item.source === 'user' ? 'Your playbook' : 'Playbook'}: ${item.title || posix.basename(item.path)}` }))]
    .map(({ item, heading }) => {
      const body = readText(item.absolute);
      const evidence = knowledgeFileEvidence(item, body);
      const status = body === null ? 'unavailable' : 'omitted';
      const fallback = `\n${evidenceMarker({ id: item.path, status })}\n(${item.path} ${status}: ${status === 'omitted' ? 'response budget reached' : 'file could not be read'}. Read it separately.)\n`;
      const block = body === null ? null : `\n---\n\n## ${heading}\n\nFile: ${item.path}\n${item.why ? `\nWhy: ${item.why}\n` : ''}\n${evidenceMarker(evidence)}\n${normalizeKnowledgeText(body)}\n${fileEnd}\n`;

      return { block, fallback };
    });

  const later = (brief.play?.steps ?? []).filter(step => !step.now)
    .map(step => `\nStep ${step.step} (${step.command ?? step.method}):\n- ${step.path} — ${step.label}${step.playbooks.map(item => `\n- ${item.path} — ${item.why}`).join('')}`).join('\n');
  const situational = (later ? `\n---\n\n## Read at that step (conquistador_read when the play reaches it)\n${later}\n` : '')
    + (brief.situational.length ? `\n---\n\n## Situational (read with conquistador_read when needed)\n${brief.situational.map(item => `- ${item.path} — ${item.why}`).join('\n')}\n` : '');
  // Reserve the exact status text for every remaining required file before adding a body.
  let remaining = entries.reduce((sum, entry) => sum + Buffer.byteLength(entry.fallback), 0);
  let output = header;

  for (const entry of entries) {
    remaining -= Buffer.byteLength(entry.fallback);
    output += entry.block && Buffer.byteLength(output) + Buffer.byteLength(entry.block) + remaining <= limit ? entry.block : entry.fallback;
  }

  return clipUtf8(output + situational, limit);
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
