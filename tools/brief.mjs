// Briefing engine: decide which playbooks the agent must read for one task.
// Method selection reuses the phrase router. Knowledge ranking is deterministic BM25 over
// every knowledge file in the selected methods, the shared parent library, and optional
// user playbooks. The same brief feeds the MCP tool, the hooks, the CLI, and the bot pack.
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, extname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { selectRequestContext } from './context-selection.mjs';
import { contextFiles } from './context-files.mjs';
import { explicitInvocation, normalizeRequest } from './request-text.mjs';
import { loadRoutingContract } from './routing-contract.mjs';
import { methodOwner } from './method-library.mjs';
import { packageRootOf } from './module-root.mjs';

export const BRIEF_SCHEMA = 'conquistador.brief/v1';
export const LIMITS = Object.freeze({
  // Up to 3 keyword-ranked files, plus the primary command's required files when they fit the bytes.
  mustFiles: 5,
  mustBytes: 10_000,
  situationalFiles: 8,
  userFiles: 4000,
  userFileBytes: 262_144,
  userDepth: 8,
  packBytes: 16_000,
});
const moduleRoot = packageRootOf(import.meta.url);

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
  'cold email': ['email'],
  'apple search ads': ['apple-search-ads'],
  'apple ads': ['apple-search-ads'],
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

function document(absolute, key, { source, method }, prepared) {
  let raw;
  try { raw = readFileSync(absolute, 'utf8'); } catch { return null; }

  const digest = createHash('sha256').update(raw).digest('hex');

  if (prepared?.digest === digest && prepared.source === source && prepared.method === method) {
    try { return { ...revive(prepared), absolute }; }
    catch { /* Rebuild malformed cached terms from the source text. */ }
  }
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
export function knowledgeIndex(root = moduleRoot, { playbooks = userPlaybookRoots(), persistCache = true, packagedIndex = true } = {}) {
  const packageRoot = realpathSync(resolve(root));
  const cacheKey = `${packageRoot}\0${playbooks.join('\0')}\0${persistCache}\0${packagedIndex}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const contract = loadRoutingContract(packageRoot);
  const libraryRoot = posix.dirname(contract.parentPath);
  const entryName = contract.document ?? 'SKILL.md';
  const planned = [];
  const parentDir = join(packageRoot, contract.parentPath);
  // One tree: shared parent files, commands/<name>/ (source "method"), and plays/<name>[.md|/] (source "play").
  for (const absolute of walkMarkdown(parentDir, { limitFiles: 6000, limitBytes: 1_000_000, depth: 10 })) {
    const inner = relative(parentDir, absolute).split(sep).join('/');
    // A COMMAND.md is a detailed procedure (a command's, or a thin play's, channel's, format's, or specialist's),
    // read only when its entry sends the model there. It never joins a brief or a search on its own.
    if (inner === entryName || inner === 'SKILL.md' || inner === 'METHOD.md' || /(?:^|\/)COMMAND\.md$|^commands\/[^/]+\/ENTRY\.md$/.test(inner)) continue;
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
  if (persistCache) try {
    const stored = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (stored.signature === signature) all = stored.docs.map(revive);
  } catch { /* Build below. */ }
  if (!all) {
    // The shipped snapshot contains only derived bundled data. Validate each source digest
    // before reuse: local edits, renamed documents and domain subsets remain authoritative.
    let prepared = new Map();

    if (packagedIndex) try {
      const path = join(packageRoot, 'tools/search-index.json');
      const stat = lstatSync(path);

      if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw Error('Invalid search snapshot.');
      const snapshot = JSON.parse(readFileSync(path, 'utf8'));

      if (snapshot.version === INDEX_VERSION && Array.isArray(snapshot.docs)) prepared = new Map(snapshot.docs.map(doc => [doc.key, doc]));
    } catch { /* Optional optimization; source files always remain sufficient. */ }

    all = planned.map(item => document(item.absolute, item.key, item, item.source === 'user' ? undefined : prepared.get(item.key))).filter(Boolean);
    if (persistCache) try {
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

// Maintainer-only generation. Never discover user playbooks or include checkout paths.
export function buildSearchSnapshot(root = moduleRoot) {
  const index = knowledgeIndex(root, { playbooks: [], persistCache: false, packagedIndex: false });

  return { version: INDEX_VERSION, docs: index.docs.map(doc => {
    const { absolute: _absolute, ...portable } = serialize(doc);

    return portable;
  }) };
}

function rankQuery(query, index) {
  // Preserve term order and arithmetic so cached query weights do not change scores.
  const words = [...new Set(query)].map(word => ({
    word,
    named: !GENERIC.has(word) && !['dev', 'developer', 'saas', 'ios', 'mobile'].includes(word),
    idf: Math.log(1 + (index.total - (index.df.get(word) ?? 0) + 0.5) / ((index.df.get(word) ?? 0) + 0.5)),
  }));

  return doc => {
    let score = words.filter(({ word, named }) => named && doc.nameTerms.has(word)).length * 3;
    const sizeFactor = doc.bytes > 16_000 ? 0.6 : 1;

    for (const { word, idf } of words) {
      const frequency = doc.tf.get(word);

      if (!frequency) continue;
      score += idf * (frequency * 2.2) / (frequency + 1.2 * (0.25 + 0.75 * doc.length / index.averageLength));
    }

    return Math.round(score * sizeFactor * 1e4) / 1e4;
  };
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
const reasonFor = (doc, platforms) => {
  if (doc.kind === 'user') return `Your playbook${doc.summary ? `: ${doc.summary}` : ''}`;
  if ((doc.kind === 'platform' || doc.kind === 'channel') && platforms.some(item => posix.basename(doc.key, '.md') === item)) return `You named this platform. ${doc.summary}`.trim();
  if (doc.kind === 'checklist') return 'Check the draft against these failure patterns before you answer.';
  return doc.summary || doc.title;
};

// Instructions that start prompts from 0.4.0 and earlier carried. Such prompts may still arrive, and
// their words ("cannot find", "learn the product") would pull routing off the task, so taskOf strips them.
export const START_CONTEXT = Object.freeze({
  project: 'Learn the product from this folder first. Ask me only for what you cannot find.',
  ask: 'First ask me what the product is, who it is for, and the goal.',
});
const START_LEAD = /^\s*Use Conquistador:\s*/i;
// Copy is a pass-through except a sales page or sales letter. In blind tests every copy rule set made
// a strong model's copy worse; only sales page openings improved. Other copy carries no copy file.
const SALES_PAGE = /\bsales (?:pages?|letters?)\b/;
// Ad drafting is a pass-through too: across three blind tests every ads rule set lost or tied, each
// creating the opposite fault of the last. A campaign test (structure, budget, decision and kill rules)
// is decision work and keeps the ads method; drafting carries the ads entry alone.
// A headline or a platform name inside an ad request does not add copy or social, unless the request
// also names one of their own deliverables.
const OWN_DELIVERABLE = { copy: /\b(?:pages?|emails?|sales letters?|newsletters?|taglines?)\b/, social: /\b(?:posts?|captions?|threads?|tweets?)\b/ };
// Thin by default (owner decision, 27 Oct 2026). Across about 100 blind pairs, a method beat the same model
// alone only for outbound and social; copy, ads, and decision work lost or tied, and the method drafts added
// process the user did not ask for. A practice whose method has not won a blind test is a pass-through: its
// brief carries its entry alone, and its detailed files stay in the library, unlinked, until a blind test
// brings the craft back. Kept: the winners (outreach and the outbound play, social, copy's sales page and
// sales letter) and work that is not marketing craft (engineering, platform utilities, factcheck,
// vietnamese, and the spec play).
const CRAFT_METHODS = new Set(['outreach', 'social']);
const UNCHANGED_METHODS = new Set(['architect', 'build', 'docs', 'ui', 'init', 'doctor', 'pin', 'connect', 'review', 'feedback',
  'check', 'factcheck', 'vietnamese']);
const KEEPS_METHOD = new Set([...CRAFT_METHODS, ...UNCHANGED_METHODS]);
const KEEPS_PLAY = new Set(['outbound', 'spec']);
const thinMethod = (name, salesPage) => !KEEPS_METHOD.has(name) && !(name === 'copy' && salesPage);
const AD_CAMPAIGN = /\b(?:campaigns?|budgets?|kill (?:rules?|criteria)|(?:ads?|paid) tests?|test (?:plans?|structure|design)|account (?:structure|setup)|bids?|bidding|spend|optimi[sz]ation events?|scal(?:e|ing) rules?|media plan|turn (?:ads|it|them) off)\b/;
export const taskOf = prompt => Object.values(START_CONTEXT).reduce((rest, sentence) => rest.split(sentence).join(' '), prompt).replace(START_LEAD, '').trim();

export function createBrief(input, { root = moduleRoot, playbooks, persistCache = true, force = false, automatic = false, cwd = process.cwd() } = {}) {
  if (typeof input !== 'string' || !input.trim()) throw Error('Describe the task.');
  const packageRoot = realpathSync(resolve(root));
  const routed = selectRequestContext(input, { root: packageRoot, automatic });
  if (routed.action !== 'route') return { schema: BRIEF_SCHEMA, action: 'none', mode: 'none', reason: routed.reason, methods: [], must: [], situational: [], platforms: [], packageRoot };
  const prompt = routed.query;
  // A platform named only in pasted context ("we launch on Product Hunt") still applies when the request names none.
  const platforms = namedPlatforms(prompt).length || !routed.supportingQuery ? namedPlatforms(prompt) : namedPlatforms(routed.supportingQuery);
  const index = knowledgeIndex(packageRoot, { playbooks, persistCache });
  const { contract, libraryRoot } = index;
  let methods = routed.selected.map(item => contract.methods[item.name]).filter(Boolean);
  const playName = routed.play?.name;
  const explicit = explicitInvocation(input);
  const play = playName ? (contract.plays ?? []).find(item => item.name === playName) : null;
  // A play starts at its first unconditional command step; later steps are read when reached.
  const firstStep = play ? Math.max(0, play.chain.findIndex(step => step.command && !step.when)) : -1;
  if (play) {
    const lead = play.chain[firstStep]?.command;
    if (lead && contract.methods[lead]) methods = [contract.methods[lead]];
  }

  const adDrafting = !play && !AD_CAMPAIGN.test(normalizeRequest(prompt));
  if (adDrafting && methods[0]?.name === 'ads') methods = methods.filter(method => !OWN_DELIVERABLE[method.name] || OWN_DELIVERABLE[method.name].test(normalizeRequest(prompt)));
  const rank = rankQuery(expand(terms(prompt)), index);
  const selectedNames = new Set(methods.map(item => item.name));
  if (!methods.length && !play && !platforms.length && !(explicit || force)) {
    return { schema: BRIEF_SCHEMA, action: 'none', reason: routed.reason ?? 'no-relevant-capability', methods: [], must: [], situational: [], platforms: [], packageRoot };
  }
  const required = new Set(methods.flatMap(item => item.requiredResources ?? []).map(path => path.slice(libraryRoot.length + 1)));
  const salesPage = SALES_PAGE.test(normalizeRequest(prompt));
  const passThrough = play ? !KEEPS_PLAY.has(play.name) : methods.length > 0 && thinMethod(methods[0].name, salesPage);
  // A thin route inlines every selected entry. Only a utility the request also selected keeps its files
  // ("write it in Vietnamese"); a craft secondary keeps its entry, which links its method.
  const utilities = new Set(passThrough ? methods.filter(method => UNCHANGED_METHODS.has(method.name)).map(method => method.name) : []);
  const ownerOf = doc => (doc.source === 'method' && selectedNames.has(doc.method)) || (doc.source === 'play' && doc.method === play?.name) ? doc.method : null;
  const scoreDoc = (doc, owned) => {
    if (doc.kind === 'process' || doc.key === 'conquistador/welcome.md') return null;
    if (!salesPage && doc.source === 'method' && doc.method === 'copy') return null;
    if (adDrafting && doc.source === 'method' && doc.method === 'ads') return null;
    if (passThrough && doc.kind !== 'user' && !(doc.source === 'method' && utilities.has(doc.method))) return null;
    // A kept route reads no detailed file of a thin method it also selected; a kept play keeps its steps.
    if (!passThrough && !play && doc.source === 'method' && doc.method !== methods[0]?.name && thinMethod(doc.method, salesPage)) return null;
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
    const lexical = rank(doc) * (priorWeight[doc.kind] ?? 1);
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
  const assist = routed.mode === 'assist';
  const fileBudget = assist ? 1 : 3;
  const byteBudget = assist ? 1800 : LIMITS.mustBytes;
  // Every resource shares the task's byte budget. Required files do not use the 3 ranked slots.
  const take = (item, required = false) => {
    if (item.sibling || must.some(entry => entry.doc.digest === item.doc.digest)) return false;
    if (must.length >= LIMITS.mustFiles || bytes + item.doc.bytes > byteBudget) return false;
    if (!required && must.filter(entry => !entry.required).length >= fileBudget) return false;
    must.push(required ? { ...item, required } : item);
    bytes += item.doc.bytes;
    return true;
  };
  // The user's own playbooks outrank generic method knowledge.
  // Keep only strong matches: within 60% of the best user playbook for this task.
  const userHits = scored.filter(entry => entry.doc.kind === 'user');
  for (const item of userHits.filter(entry => entry.score >= (userHits[0]?.score ?? 0) * 0.6).slice(0, 1)) take(item);
  // Platform packs and channel guides the user named.
  for (const item of scored.filter(entry => entry.doc.kind === 'platform' || entry.doc.kind === 'channel')) {
    const inPrimary = item.doc.method === methods[0]?.name || item.doc.kind === 'channel';
    if (inPrimary || !scored.some(entry => entry.doc.kind === 'platform' && entry.doc.method === methods[0]?.name && posix.basename(entry.doc.key) === posix.basename(item.doc.key))) take(item);
    if (must.length >= 3) break;
  }
  // The primary command's required files come before keyword-ranked extras. A small edit keeps
  // its one-file budget. A required file that does not fit is named, never dropped silently.
  const deferredRequired = [];
  if (!assist && !passThrough) {
    const byKey = new Map(scored.map(entry => [entry.doc.key, entry]));
    for (const key of (methods[0]?.requiredResources ?? []).map(path => path.slice(libraryRoot.length + 1))) {
      const doc = index.docs.find(item => item.key === key);
      if (!doc || doc.kind === 'process') continue;
      if (!take(byKey.get(key) ?? { doc, score: 0, lexical: 0, sibling: false, owner: methods[0].name }, true)
        && !must.some(entry => entry.doc.digest === doc.digest)) deferredRequired.push(`${libraryRoot}/${key}`);
    }
  }
  // A play's own playbooks (its recovered method folder) come first among method knowledge.
  if (play) scored.filter(entry => entry.owner === play.name && entry.doc.source === 'play' && entry.doc.kind === 'playbook').slice(0, 2).forEach(item => take(item));
  // Prefer the strongest playbooks owned by each selected command.
  methods.forEach((method, position) => {
    const quota = position === 0 ? 3 : 1;
    // The strongest two always count; a third needs its own lexical match, not only membership.
    scored.filter(entry => entry.owner === method.name && entry.doc.source === 'method' && entry.doc.kind === 'playbook')
      .filter((entry, rank) => rank < Math.min(quota, 2) || entry.lexical >= 3).slice(0, quota).forEach(item => take(item));
  });
  // Anti-patterns of the primary method: the final check.
  const checklist = scored.find(entry => entry.owner === methods[0]?.name && entry.doc.source === 'method' && entry.doc.kind === 'checklist');
  if (checklist) take(checklist);
  // Fill any remaining room with the strongest remaining matches.
  // Shared parent files stay situational unless the user named their platform.
  for (const item of scored) if (!['example', 'checklist'].includes(item.doc.kind) && item.owner) take(item);
  // Reading order: required files, then guides for the platforms the user named, then extras.
  // A pack inlines in this order, so a tight budget drops keyword extras first.
  const lead = item => (item.required ? 0 : platforms.includes(posix.basename(item.doc.key, posix.extname(item.doc.key))) ? 1 : 2);
  must.sort((a, b) => lead(a) - lead(b));

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
    why: reasonFor(item.doc, platforms),
    bytes: item.doc.bytes,
    score: Number(item.score.toFixed(3)),
    ...(item.required ? { required: true } : {}),
  });
  // Later play steps: each step's strongest playbooks, read when the work reaches that step.
  const steps = play ? play.chain.map((step, position) => {
    const name = step.command ?? step.method;
    const record = step.command ? contract.methods[step.command] : null;
    const label = record?.label ?? name.replaceAll('-', ' ');
    const now = position === firstStep;
    let playbooks = [];
    if (!passThrough && !now && step.command && (salesPage || step.command !== 'copy')) {
      playbooks = index.docs.filter(doc => doc.source === 'method' && doc.method === step.command && doc.kind === 'playbook'
        && (!step.mode || !doc.key.includes('/references/modes/') || doc.key.includes(`/references/modes/${step.mode}`)))
        .map(doc => ({ doc, score: rank(doc) + (record.requiredResources ?? []).includes(`${libraryRoot}/${doc.key}`) * 3 }))
        .sort((a, b) => b.score - a.score || a.doc.key.localeCompare(b.doc.key)).slice(0, 2)
        .filter(item => !seen.has(item.doc.digest)).map(view);
    }
    // A thin play's command step starts from that command's entry, not its detailed procedure.
    const path = passThrough && step.command ? step.path.replace(/COMMAND\.md$/, 'ENTRY.md') : step.path;
    return { step: position + 1, ...(step.command ? { command: step.command } : { method: step.method }), label, path, absolute: join(packageRoot, path),
      ...(step.mode ? { mode: step.mode } : {}), ...(step.when ? { when: step.when } : {}), ...(step.for ? { for: step.for } : {}), now, playbooks };
  }) : [];
  for (const step of steps) for (const item of step.playbooks) seen.add(createHash('sha256').update(readText(item.absolute) ?? '').digest('hex'));
  for (const path of deferredRequired) seen.add(index.docs.find(doc => `${libraryRoot}/${doc.key}` === path).digest);
  const situational = passThrough ? [] : scored.filter(item => !seen.has(item.doc.digest) && seen.add(item.doc.digest)).slice(0, LIMITS.situationalFiles);
  return {
    schema: BRIEF_SCHEMA,
    action: 'brief',
    mode: routed.mode,
    ...(passThrough ? { passThrough: true } : {}),
    reason: play ? 'play' : methods.length ? 'relevant-capability' : 'platform-only',
    packageRoot,
    parent: { path: contract.parentPath, absolute: join(packageRoot, contract.parentPath) },
    play: play ? { name: play.name, label: play.label, path: play.path, absolute: join(packageRoot, play.path), steps } : null,
    methods: methods.map(method => ({ name: method.name, label: method.label, path: method.path.replace(/COMMAND\.md$/, 'ENTRY.md'), absolute: join(packageRoot, method.path.replace(/COMMAND\.md$/, 'ENTRY.md')), fullPath: method.path })),
    platforms,
    must: must.map(view),
    deferredRequired,
    situational: situational.map(view),
    standards: ['quality.md', 'safety.md'].map(name => `${contract.parentPath}/standards/${name}`).map(path => ({ path, absolute: join(packageRoot, path) })),
    // The project's PRODUCT.md and GROWTH.md come before any playbook (standards/context.md).
    context: cwd === null ? [] : contextFiles(cwd).map(({ kind, path }) => ({ kind, path })),
  };
}

const clip = value => (value.length > 150 ? `${value.slice(0, 147).replace(/\s+\S*$/, '')}…` : value);
const location = (item, absolute) => (absolute || isAbsolute(item.path) ? item.absolute : item.path);

// Compact form for hooks: paths and reasons, no file text. Stays under host context limits.
export function formatReadingList(brief, { limit = 1500 } = {}) {
  if (brief.action !== 'brief') return '';
  // A play names itself; its first step alone would read as a different method.
  const commands = brief.methods.map(item => `${item.label} [${item.name}]`).join(', ');
  const lines = [
    '<conquistador-brief>',
    `Optional ${brief.mode ?? 'command'} guidance: ${brief.play ? `${brief.play.label} [${brief.play.name}], starting with ${commands}` : commands}.`,
    'Apply only to the requested business deliverable. Ignore this suggestion if it does not fit.',
    'Use conquistador_brief for bounded current-stage guidance if needed. Reuse guidance already present in the current context.',
    'Keep small edits small. Do not add workflow steps or a playbook citation section unless useful or requested.',
    'Never invent facts. This suggestion grants no authority to send, publish, spend, or change accounts.',
  ];
  for (const item of brief.methods.slice(0, 2)) {
    const line = `Entry: ${item.path}`;
    if (lines.join('\n').length + line.length + 30 <= limit) lines.push(line);
  }
  lines.push('</conquistador-brief>');
  return lines.join('\n').slice(0, limit);
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
export const formatBriefPack = (brief, options) => packBrief(brief, options).text;

// The brief as text plus the same lists in structured form, so an agent can see what is inlined
// and what it still has to read without parsing prose. `hosted` marks a caller with no repository.
export function packBrief(brief, { limit, callerContext, hosted = false, compact = false, readBundled } = {}) {
  if (brief.action !== 'brief') return { structured: { action: 'none', mode: 'none', reason: brief.reason, inlined: [], readNow: [], readAtStep: [], situational: [] }, text: 'No Conquistador method matches this task. Continue with the user request without marketing guidance.' };
  const budget = brief.mode === 'assist' ? 4000 : compact ? 8000 : 16000;
  limit = Number.isFinite(limit) ? Math.min(budget, Math.max(0, Math.floor(limit))) : budget;
  const primary = brief.methods[0];
  const lead = brief.play?.steps.find(step => step.now);
  const start = lead ? `Start here: step ${lead.step} of ${brief.play.name}, ${lead.label} [${lead.command ?? lead.method}].`
    : `Start here: ${primary?.label ?? 'Selected guidance'} [${primary?.name ?? 'guidance'}].`;
  const lines = [
    '# Conquistador brief', '', start,
    `Scope: ${brief.mode ?? 'command'}. Apply only to the requested deliverable.`,
    hosted ? `Hosted: you have no repository here. Return requested artifacts in the answer instead of .forsvn/ files.${brief.passThrough ? '' : ' If specialist support is unavailable, use fallbacks/sequential.md when needed.'}` : '',
    '', 'Rules for this task:',
    // A pass-through brief asks for the work alone: no method rules, labels, or review sections (thin by default).
    ...(brief.passThrough ? [
      'Do the requested work in your own judgment from the user\'s facts. Keep small edits small.',
      'Never invent metrics, quotes, or product facts. Preserve host permissions for sending, publishing, spending, and account changes.',
      'Return only the deliverable the user asked for.',
    ] : [
      'Follow relevant method rules. Keep small edits small. Expand only the stage the user requested.',
      'Never invent metrics, quotes, or product facts. Mark assumptions. Preserve host permissions for sending, publishing, spending, and account changes.',
      'Lead with the deliverable the user asked for. Name sources when they help a decision; no mandatory playbook appendix.',
      'Use conquistador_check for substantial marketing text, and conquistador_score only when reporting a rubric verdict. Neither proves factual accuracy or quality.',
      'Deferred files are optional until their stage is needed. Use conquistador_read to expand one, or reuse complete guidance still present in the host context.',
    ]),
  ];
  // Required files lead every list. A required file this pack does not inline is named before the
  // file blocks, so the budget never drops it silently. It stays optional, not readNow (#86).
  const required = [...brief.must.filter(item => item.required).map(item => item.path), ...(brief.deferredRequired ?? [])];
  let callerContextStatus = 'absent';
  if (callerContext) {
    const context = callerContext.replace(/<!--(\s*\/?\s*conquistador-file)/gi, '&lt;!--$1');
    if (Buffer.byteLength(context) < limit / 2) {
      lines.push('', '## Caller context', '', context);
      callerContextStatus = 'included';
    } else {
      lines.push('', 'Caller context remains with the caller. It exceeds this guidance budget; use those supplied facts directly. No facts were inferred.');
      callerContextStatus = 'retained-by-caller';
    }
  }
  const entries = [...brief.methods, ...(compact ? [] : brief.must)];
  let output = lines.filter(line => line !== undefined).join('\n') + '\n';
  let headerEnd = output.length;
  const inlined = [];
  const note = () => {
    const missing = required.filter(path => !inlined.some(item => item.path === path));
    return missing.length ? `\nRequired references not inlined (budget): ${missing.join(', ')}. Expand them with conquistador_read before the stage that uses them.\n` : '';
  };
  const render = () => output.slice(0, headerEnd) + note() + output.slice(headerEnd);
  const includedBlocks = [];
  const deferred = [...(brief.deferredRequired ?? []), ...(compact ? brief.must : []).map(item => item.path), ...brief.situational.map(item => item.path)];
  const provenance = [...(brief.deferredRequired ?? []), ...(compact ? brief.must : []).filter(item => item.required).map(item => item.path)]
    .map(path => ({ path, reason: 'required by the command', bytes: 0, sha256: null, status: 'deferred', required: true }));
  for (const item of entries) {
    let body;
    try { body = readBundled && item.source !== 'user' ? readBundled(item) : readText(item.absolute); }
    catch { body = null; }
    const evidence = knowledgeFileEvidence(item, body);
    const block = body === null ? null : `\n## ${item.title ?? item.label ?? 'Guidance'}\nFile: ${item.path}\n${evidenceMarker(evidence)}\n${normalizeKnowledgeText(body)}\n${fileEnd}\n`;
    const fits = block !== null && Buffer.byteLength(render()) + Buffer.byteLength(block) <= limit;
    provenance.push({ path: item.path, reason: item.why ?? 'selected command entry', bytes: evidence.bytes ?? 0, sha256: evidence.sha256 ?? null, status: fits ? 'included' : body === null ? 'unavailable' : 'deferred', ...(item.required ? { required: true } : {}) });
    if (fits) { output += block; includedBlocks.push(block); inlined.push({ path: item.path, title: item.title ?? item.label }); }
    else deferred.push(item.path);
  }
  // A required file that is not inlined is listed before optional ones.
  const isRequired = path => required.includes(path);
  deferred.sort((a, b) => isRequired(b) - isRequired(a));
  const later = (brief.play?.steps ?? []).filter(step => !step.now).map(step => ({ step: step.step, path: step.path }));
  const structured = {
    action: 'brief', mode: brief.mode ?? 'command', reason: brief.reason, command: primary?.name ?? null,
    play: brief.play?.name ?? null, inlined, readNow: [], readAtStep: later,
    situational: [...new Set(deferred)], provenance, callerContextStatus, budgetBytes: limit,
  };
  const encodedBytes = () => Buffer.byteLength(JSON.stringify({ content: [{ type: 'text', text: render() }], structuredContent: structured }));
  // Budget the complete public tool result, including provenance and deferred resource paths.
  // Drop whole blocks only; never claim a partial body was inlined.
  if (limit >= 2000) {
    while (encodedBytes() > limit && includedBlocks.length) {
      const block = includedBlocks.pop();
      const item = inlined.pop();
      output = output.slice(0, output.length - block.length);
      structured.situational.splice(isRequired(item.path) ? 0 : structured.situational.filter(isRequired).length, 0, item.path);
      provenance.find(record => record.path === item.path).status = 'deferred';
    }
    if (encodedBytes() > limit && callerContextStatus === 'included') {
      output = output.split('\n## Caller context')[0] + '\nCaller context remains with the caller; use the supplied facts directly.\n';
      headerEnd = output.length;
      structured.callerContextStatus = 'retained-by-caller';
    }
    while (encodedBytes() > limit && structured.situational.length) structured.situational.pop();
  }
  return { structured, text: clipUtf8(render(), limit) };
}

export function searchKnowledge(query, { root = moduleRoot, playbooks, persistCache = true, limit = 12 } = {}) {
  const index = knowledgeIndex(root, { playbooks, persistCache });
  const rank = rankQuery(terms(query), index);
  return [...index.docs, ...index.users].filter(doc => doc.kind !== 'process')
    .map(doc => ({ doc, score: rank(doc) * (priorWeight[doc.kind] ?? 1) }))
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
