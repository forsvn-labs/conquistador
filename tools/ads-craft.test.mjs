// Ad drafting is a pass-through. Across three blind tests (18 pairs), ads written with any version of the
// ads craft lost 6–12 to the same model with no craft: the old method lost 1–5, rebuilt craft round 1 tied
// 3–3 (each variation too thin), and round 2 lost 2–4 (each variation too full). Each rule set created the
// opposite fault; the bare model balances by judgment. The campaign test (structure, budget, kill rules) is
// decision work, not drafting, and keeps its method.
// Failure modes, listed and checked before the change:
//  1. an ad drafting brief (Meta, Facebook, Instagram, Google, LinkedIn, TikTok) that inlines, lists, or
//     stages any ads file other than ENTRY;
//  2. an ad drafting brief that carries a drafting rule: angles, the reader's situation, a reason to believe,
//     offer terms, proof leading once, the product name rule, strong and weak examples, or a drafting role;
//  3. ENTRY without a dated platform fact the model may not know (Meta, Google, LinkedIn, TikTok limits,
//     placements, safe zones, and the personal-attribute rule), or the platform facts undated;
//  4. a drafting instruction without the facts check, or a facts check that adds text (a hedge, source text,
//     a disclaimer, a qualifier, a footnote, a citation);
//  5. a lost approval boundary for launch, publish, spend, upload, or a live account change;
//  6. a Meta, Facebook, Instagram, TikTok, LinkedIn, or Google ad request that reaches another command
//     first, or an organic post request that reaches `ads`;
//  7. a campaign test request (structure, budget, kill rules) that loses the campaign method, or the campaign
//     method missing its structure, batch, decision, or optimization-event starting points;
//  8. `ads` declaring required resources, which an assignment loads for every ads task;
//  9. a drafting instruction (ENTRY, COMMAND, the ads specialist, the paid play, the kept roles, the
//     platform packs) that links a retired craft file or names a drafting rule;
// 10. a retired craft file still present, a link to one, or a broken link in the method library;
// 11. a number in a platform pack that is neither a dated platform fact nor a labeled starting point;
// 12. public text that names a practitioner, creator, vendor source, or blind-test fixture, or a kept
//     example that does not declare its products synthetic;
// 13. a brief over the byte budget, or a routing contract that no longer builds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief, packBrief } from './brief.mjs';
import { selectRequestContext } from './context-selection.mjs';
import { buildRoutingContract } from './routing-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const library = join(root, 'skills/conquistador');
const options = { root, playbooks: [], persistCache: false, cwd: null };
const read = path => readFileSync(join(library, path), 'utf8');
const pack = task => packBrief(createBrief(task, options));
const walk = path => {
  const absolute = join(library, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute).sort().flatMap(name => walk(join(path, name)));
};
const links = text => [...text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)].map(match => match[1]);
const ADS = 'skills/conquistador/commands/ads/';
const ENTRY = `${ADS}ENTRY.md`;
const PACKS = ['ad-intelligence/meta-cold-traffic.md', 'ad-intelligence/meta-retargeting.md', 'ad-intelligence/google-ads.md',
  'ad-intelligence/linkedin-ads.md', 'ad-intelligence/tiktok-ads.md', 'ad-intelligence/apple-search-ads.md',
  'ad-intelligence/creative-cadence.md', 'platform-intelligence/facebook.md', 'platform-intelligence/reels.md']
  .map(path => `commands/ads/references/${path}`);

// Ad requests that draft ad text. Each must carry the ads entry and nothing else.
const DRAFT_TASKS = [
  'Write three Meta ads for our app',
  'Write three Meta (Facebook and Instagram) ad variations. For each: primary text, headline (up to 40 characters), and a one-line visual direction for the image or video.',
  'Write three Facebook ads for our dental software',
  'Write Instagram ad variations for our backpack',
  'Write a Google Search responsive ad: 8 headlines and 3 descriptions for the keyword payroll software',
  'Write three LinkedIn sponsored content ad variations for our security product',
  'Write TikTok ads for our budgeting app',
  'Write two TikTok ad scripts for our garment steamer',
  'Write Facebook and Instagram ads for our gym',
  'Write Instagram and TikTok ads for our meal kit',
];
// Campaign test requests: structure, budget, and kill rules. These keep the campaign method.
const CAMPAIGN_TASKS = [
  'Plan a Meta ads test for our app with a $3,000 budget and kill rules',
  'Set up the account structure and budget for a TikTok ads test',
  'Plan a LinkedIn ads test for our security product: budget, test structure, and when to turn ads off',
  'Set up a Google Ads account structure and budget for our payroll software',
  // Components listed after a colon split into clauses; "test structure" alone may not hand the ad test
  // to the experiment play.
  'Plan a Meta ads test for our language app: daily budget, test structure, and creative rotation',
  'Plan our Meta ads account structure: ad sets, audiences, and test structure',
];
// Retired with the ads drafting craft: the craft reference, the strong and weak sets, the drafting check,
// the drafting roles, and the fallback that ran them.
const RETIRED = ['references/ad-craft.md', 'references/anti-patterns.md', 'references/examples/ad-sets-social.md',
  'references/examples/ad-sets-search-b2b.md', 'agents/composer.md', 'agents/voice-auditor.md', 'agents/critic.md',
  'fallbacks/sequential.md'].map(path => `commands/ads/${path}`);
// Every instruction that drafts ads or hands drafting on. Each must name the pass-through.
const DRAFTING = ['commands/ads/ENTRY.md', 'commands/ads/COMMAND.md', 'specialists/ads-agent.md'];
// Files that must not teach how ad text is written. Creative cadence is campaign material, judged separately.
const NO_RULES = [...DRAFTING, 'plays/paid.md', 'commands/ads/agents/strategist.md', 'commands/ads/agents/format-checker.md',
  ...PACKS.filter(path => !path.endsWith('creative-cadence.md'))];
// Test design may name the angles a campaign tests; it may not teach how ad text is written.
const TEST_DESIGN = new Set(['plays/paid.md', 'commands/ads/agents/strategist.md']);
const ANGLE = /\bangles?\b/i;
// The facts check, in the words every drafting instruction uses.
const FACTS_CHECK = [/own\s+judgment/i, /user's\s+facts/i, /remove\s+claims\s+the\s+facts\s+do\s+not\s+support/i,
  /keep\s+fair\s+inferences/i, /add\s+nothing/i, /no\s+hedges/i, /no\s+source\s+text/i, /no\s+disclaimers/i];
// Text the facts check must not add to the ads.
const ADDS = /operator\s+note|qualifier|footnote|\badd (?:a|an|the|one)\b|\binclude (?:a|an|the)\b|\bcite\b|\bsource beside\b/i;
// Drafting rules, examples, and roles from the retired craft. The pass-through names none of them.
const RULES = [ANGLE, /reader's (?:situation|moment|voice|world|own)/i, /reason to (?:believe|click)/i,
  /what the product does/i, /offer terms/i, /proof (?:leads|supports)/i, /\bproduct name\b/i, /stands? alone/i,
  /\bfirst line\b/i, /customer quotes?/i, /\*\*(?:Strong|Weak)\*\*/, /annotated|strong and weak/i,
  /\bcomposer\b|\bvoice auditor\b|\bcritic\b/i, /craft reference|ad-craft|ad-sets-|anti-patterns/i,
  /open(?:s|ing)? (?:in|on|with) the (?:reader|problem|work)/i, /reads as native|wastes the window/i];
const paragraph = (text, pattern) => {
  const at = text.search(pattern);
  if (at < 0) return '';
  const end = text.indexOf('\n\n', at);
  return text.slice(at, end < 0 ? undefined : end);
};
// The pass-through paragraph in a drafting instruction: the one that holds "own judgment".
const passage = path => paragraph(read(path), /[^\n]*own\s+judgment/i);

test('ad drafting briefs carry the ads entry and nothing else', () => {
  for (const task of DRAFT_TASKS) {
    const { structured, text } = pack(task);
    assert.equal(structured.command, 'ads', `${task} routes to ads`);
    assert.deepEqual(structured.inlined.map(item => item.path), [ENTRY], task);
    assert.deepEqual(structured.situational, [], `${task} lists deferred files`);
    for (const rule of RULES) assert.doesNotMatch(text, rule, `${task} brief carries ${rule}`);
    assert.match(text, /approval/i, `${task} keeps the approval boundary`);
    assert.ok(Buffer.byteLength(text) <= 16_000, `${task} brief is ${Buffer.byteLength(text)} bytes`);
  }
});

test('the ads entry carries the dated platform facts', () => {
  const raw = read('commands/ads/ENTRY.md');
  const entry = raw.replace(/\s+/g, ' ');
  assert.match(entry, /Platform facts \(checked Oct 2026; confirm in the current specs before launch\)/);
  for (const fact of [/125 characters/, /40 characters/, /\b27\b/, /5 primary texts and 5 headlines/, /4:5/, /9:16/,
    /15 headlines of 30 characters/, /4 descriptions of 90/, /2 paths of 15/, /3 headlines and 2 descriptions/, /[Pp]inning/,
    /150 characters/, /600/, /70 characters/, /200/, /100 characters/, /Spark Ads/, /right-side buttons/, /bottom caption band/,
    /personal attributes/, /special ad categor/i, /disclos/i]) assert.match(entry, fact, `ENTRY: ${fact}`);
  assert.ok(Buffer.byteLength(raw) <= 3_000, `ENTRY.md is ${Buffer.byteLength(raw)} bytes`);
});

test('every drafting instruction is a pass-through with a facts check that adds nothing', () => {
  for (const path of DRAFTING) {
    const text = passage(path);
    assert.ok(text, `${path} names the pass-through`);
    for (const rule of FACTS_CHECK) assert.match(text, rule, `${path}: ${rule}`);
    assert.doesNotMatch(text, ADDS, `${path}: the facts check adds text`);
    for (const target of links(text)) assert.match(target, /ads\/(?:ENTRY|COMMAND)\.md$|^(?:ENTRY|COMMAND)\.md$/, `${path} pass-through links ${target}`);
  }
});

test('no drafting instruction, kept role, or platform pack teaches how ad text is written', () => {
  for (const path of NO_RULES) {
    // Campaign sections (the plan in COMMAND, labeled starting points in the packs) are test design.
    const text = read(path).split(/^(?=## )/m).filter(section => !/^## (?:Plan the test|.*Starting point)/.test(section)).join('');
    for (const rule of RULES) {
      if (rule === ANGLE && TEST_DESIGN.has(path)) continue;
      assert.doesNotMatch(text, rule, `${path} carries ${rule}`);
    }
  }
});

test('the approval boundary covers launch, publish, spend, uploads, and live account changes', () => {
  const boundary = /launch[\s\S]{0,40}publish[\s\S]{0,40}spend[\s\S]{0,80}upload[\s\S]{0,160}approv/i;
  for (const path of ['commands/ads/ENTRY.md', 'commands/ads/COMMAND.md', 'plays/paid.md', 'specialists/ads-agent.md']) {
    assert.match(read(path), boundary, path);
  }
  for (const path of PACKS) assert.match(read(path), /approv/i, `${path} keeps the approval line`);
});

test('ad requests reach ads first and organic post requests stay with social', () => {
  for (const task of DRAFT_TASKS) assert.equal(createBrief(task, options).methods[0]?.name, 'ads', task);
  // A parenthetical stays in its clause: "Meta (Facebook and Instagram) ad variations" is one ad request.
  assert.deepEqual(selectRequestContext(DRAFT_TASKS[1], { root }).selected.map(item => item.name), ['ads']);
  // An ad request that also names an organic post or a page keeps that second deliverable.
  assert.deepEqual(createBrief('Write Meta ads and an Instagram post for our launch', options).methods.map(item => item.name), ['ads', 'social']);
  for (const task of ['Write an Instagram post about our launch', 'Write a Facebook post announcing our new menu', 'Write a LinkedIn post about hiring',
    'Write a Facebook and Instagram post about our launch', 'Write Facebook and Instagram captions for our launch']) {
    assert.equal(createBrief(task, options).methods[0]?.name, 'social', task);
  }
});

test('a campaign test request keeps the campaign method: structure, budget, and kill rules', () => {
  for (const task of CAMPAIGN_TASKS) {
    const brief = createBrief(task, options);
    assert.equal(brief.methods[0]?.name, 'ads', task);
    const { structured } = packBrief(brief);
    const listed = [...structured.inlined.map(item => item.path), ...structured.situational.map(item => item.path ?? item)];
    assert.ok(listed.some(path => path.endsWith('ad-intelligence/creative-cadence.md')), `${task}: ${JSON.stringify(listed)}`);
  }
  assert.match(read('commands/ads/ENTRY.md'), /campaign test[\s\S]{0,200}\(COMMAND\.md\)/i);
  const command = read('commands/ads/COMMAND.md');
  for (const step of [/## Plan the test/, /creative-cadence\.md/, /optimization event/i, /kill and scale rules/i, /strategist/]) assert.match(command, step, `COMMAND: ${step}`);
  const cadence = read('commands/ads/references/ad-intelligence/creative-cadence.md');
  for (const section of [/## Account structure · Starting point/, /## Batch size and cadence · Starting point/, /## Decide · Starting point/,
    /## Optimization event · Starting point/, /Turn the ad off/]) assert.match(cadence, section, `creative cadence: ${section}`);
});

test('ads declares no required resources', () => {
  const overlay = JSON.parse(read('routing-overlay.json'));
  assert.deepEqual(overlay.methods.ads.requiredResources, []);
  const declared = [...overlay.methods.ads.conditionalResources.map(item => item.path), ...overlay.methods.ads.optionalResources];
  for (const path of declared) assert.ok(existsSync(join(library, 'commands/ads', path)), `overlay declares missing ${path}`);
});

test('retired craft files are gone and nothing links to or names them', () => {
  for (const path of RETIRED) assert.ok(!existsSync(join(library, path)), `${path} is retired`);
  // Full paths anywhere, distinctive names anywhere, and paths relative to the ads folder inside it.
  // The results command has its own ads mode with its own anti-patterns file; that file is not retired.
  const local = RETIRED.map(path => path.replace(/^commands\/ads\//, ''));
  for (const path of walk('.').filter(path => /\.(?:md|json)$/.test(path))) {
    const text = read(path);
    for (const target of links(text)) {
      const absolute = resolve(dirname(join(library, path)), target);
      if (!/^(?:https?:|mailto:)/.test(target)) assert.ok(existsSync(absolute), `${path} links missing ${target}`);
    }
    for (const name of [...RETIRED, 'ad-craft.md', 'ad-sets-social', 'ad-sets-search-b2b']) assert.ok(!text.includes(name), `${path} names retired ${name}`);
    if (path.startsWith('commands/ads/')) for (const name of local) assert.ok(!text.includes(name), `${path} names retired ${name}`);
  }
});

test('numbers in the platform packs are dated platform facts or labeled starting points', () => {
  for (const path of PACKS.filter(path => !path.endsWith('apple-search-ads.md'))) {
    let section = '';
    for (const line of read(path).split('\n')) {
      if (/^#{2,3} /.test(line)) section = line;
      const bare = line.replace(/^\s*\d+\.\s/, '').replace(/`[^`]*`|"[^"]*"|\[[^\]]*\]\([^)]*\)/g, '');
      if (/\d/.test(bare) && !/^#/.test(line) && !/^---$|^\w+: /.test(line)) {
        assert.match(`${section} ${line}`, /Starting point|Platform facts \(checked/i, `${path}: "${line.trim()}" has a number outside a starting-point or dated platform-facts section`);
      }
    }
  }
});

test('public ads text names no source, creator, vendor source, or blind-test fixture', () => {
  const banned = /\b(?:Cali|Cal AI|Yadegari|Castillo|Schneider|Sean Frank|Ridge|Clem|Paid House|Chatbase|Elsaid|Sparrow|Levinger|Hormozi|Saraev|Nass|Money Button|Chad Funnel|Simplr|Segwise|Motion app|Arcads|Andromeda|Brightdesk|Dusk|Carryall|Paybird|Greenlane|Keyline|Ledgerly|Stillwater|Slotnote)\b/;
  for (const path of [...walk('commands/ads'), 'plays/paid.md', 'specialists/ads-agent.md'].filter(path => path.endsWith('.md'))) {
    const hit = read(path).match(banned);
    assert.equal(hit, null, `${path} names "${hit?.[0]}"`);
  }
  const walkthrough = read('commands/ads/references/examples/write-ad-walkthrough.md');
  assert.match(walkthrough.split('\n').slice(0, 8).join(' '), /synthetic/i);
  assert.match(walkthrough, /No ad was (?:run|published|bought)/i);
});

test('relative links in the ads files resolve and the routing contract builds', () => {
  for (const path of [...walk('commands/ads'), 'plays/paid.md', 'specialists/ads-agent.md'].filter(path => path.endsWith('.md'))) {
    for (const target of links(read(path))) {
      if (/^[a-z]+:/i.test(target)) continue;
      assert.ok(existsSync(join(dirname(join(library, path)), target)), `${path} links to missing ${target}`);
    }
  }
  assert.doesNotThrow(() => buildRoutingContract(root));
});
