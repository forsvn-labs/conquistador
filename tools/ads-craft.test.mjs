// Failure modes covered before the ads craft rebuild was written:
// 1. public text names a practitioner, course, creator, vendor source, or a fixture used for blind tests;
// 2. an example invents a result for a real company, or does not declare its products synthetic;
// 3. the approval boundary for launch, publish, spend, upload, or live account changes is lost;
// 4. a strong example set has two variations on one angle, or opens two variations on a number;
// 5. a strong example set opens two variations with the product name, or repeats an opening line;
// 6. strong ad copy carries source, period, or method text ("(store data, Q2 2026)", "according to");
// 7. strong ad copy or a drafting file hedges in compliance voice ("results may vary", "not a promise");
// 8. a strong example breaks a platform limit the craft states (Meta, Google RSA, LinkedIn, TikTok);
// 9. a strong Google example fails `conquistador check --channel google-ads` with an error;
// 10. there are fewer than 8 or more than 12 annotated pairs, a pair lacks a weak version or a note,
//     the pairs miss a platform, or every Meta set leads with the same angle;
// 11. the drafting files still ban practitioner defaults or speak in readiness labels;
// 12. a number in the craft or platform files is neither a dated platform fact nor a starting point;
// 13. "Write three Meta ads for our app" or a Facebook and Instagram ad request reaches `social` first,
//     or an organic post request reaches `ads`;
// 14. an ads brief drops the craft reference without naming it, or exceeds the byte budget;
// 15. a relative link in the owned files is broken, or the routing contract no longer builds.
// Text copied from private sources is checked outside this repository, because those sources are private.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createBrief, packBrief } from './brief.mjs';
import { buildRoutingContract } from './routing-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const library = join(root, 'skills/conquistador');
const ads = join(library, 'commands/ads');
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const read = path => readFileSync(path, 'utf8');
const owned = [...walk(ads), join(library, 'plays/paid.md'), join(library, 'specialists/ads-agent.md')]
  .filter(path => path.endsWith('.md'));
const craft = join(ads, 'references/ad-craft.md');
const numbered = [craft, ...['creative-cadence', 'meta-cold-traffic', 'meta-retargeting', 'google-ads', 'linkedin-ads', 'tiktok-ads']
  .map(name => join(ads, `references/ad-intelligence/${name}.md`))];
const pairDir = join(ads, 'references/examples');
const pairFiles = readdirSync(pairDir).filter(name => name.startsWith('ad-sets-')).map(name => join(pairDir, name));

// A pair is a `## ` section. Its strong set is one fenced `ad-<platform>` block; weak sets are fenced `text`.
const pairs = pairFiles.flatMap(path => read(path).split(/^## /m).slice(1).map(section => ({
  path: relative(root, path),
  title: section.split('\n')[0].trim(),
  section,
  strong: [...section.matchAll(/```ad-(meta|google|linkedin|tiktok)\n([\s\S]*?)```/g)].map(match => ({ platform: match[1], source: match[2] })),
})));
const strongSets = pairs.flatMap(pair => pair.strong.map(set => ({ ...set, pair: `${pair.path} "${pair.title}"` })));
const field = (block, name) => {
  const lines = block.split('\n');
  const start = lines.findIndex(line => line.startsWith(`${name}:`));
  if (start === -1) return null;
  const rest = [lines[start].slice(name.length + 1).trim()];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Z][A-Za-z ]{1,24}:/.test(line)) break;
    rest.push(line);
  }
  return rest.join('\n').trim();
};
const variations = set => set.source.split(/^### /m).slice(1).map(block => ({
  angle: block.split('\n')[0].split('·').pop().trim().toLowerCase(),
  block,
  text: field(block, 'Primary text') ?? field(block, 'Intro text') ?? field(block, 'Ad text') ?? '',
  headline: field(block, 'Headline'),
  opening: field(block, 'Opening'),
}));
const firstLine = text => text.split('\n').find(line => line.trim())?.trim() ?? '';
const length = text => [...text].length;
const copyOf = set => set.platform === 'google' ? set.source.replace(/^(?:Keyword|Final URL|Note):.*$/gm, '')
  : variations(set).map(item => [item.text, item.headline, item.opening].filter(Boolean).join('\n')).join('\n');

test('public ads text names no source, creator, vendor source, or blind-test fixture', () => {
  const banned = /\b(?:Cali|Cal AI|Yadegari|Castillo|Schneider|Sean Frank|Ridge|Clem|Paid House|Chatbase|Elsaid|Sparrow|Levinger|Hormozi|Saraev|Nass|Money Button|Chad Funnel|Simplr|Segwise|Motion app|Arcads|Andromeda|Brightdesk|Dusk|Carryall|Paybird|Greenlane|Keyline|Ledgerly|Stillwater|Slotnote)\b/;
  for (const path of owned) {
    const hit = read(path).match(banned);
    assert.equal(hit, null, `${relative(root, path)} names "${hit?.[0]}"`);
  }
});

test('every example file declares its products synthetic and reports no real ad or result', () => {
  assert.ok(pairFiles.length >= 2, 'expected annotated pair files');
  for (const path of [...pairFiles, join(pairDir, 'write-ad-walkthrough.md')]) {
    const head = read(path).split('\n').slice(0, 8).join(' ');
    assert.match(head, /synthetic/i, `${relative(root, path)} must declare synthetic products in its opening lines`);
    assert.match(read(path), /No ad was (?:run|published|bought)/i, `${relative(root, path)} must say no ad ran`);
  }
});

test('the approval boundary covers launch, publish, spend, uploads, and live account changes', () => {
  const boundary = /launch[\s\S]{0,40}publish[\s\S]{0,40}spend[\s\S]{0,80}upload[\s\S]{0,160}approv/i;
  for (const path of ['commands/ads/ENTRY.md', 'commands/ads/COMMAND.md', 'commands/ads/references/ad-craft.md',
    'commands/ads/references/anti-patterns.md', 'plays/paid.md', 'specialists/ads-agent.md']) {
    assert.match(read(join(library, path)), boundary, path);
  }
});

test('there are 8 to 12 annotated pairs across Meta, Google, LinkedIn, and TikTok', () => {
  assert.ok(pairs.length >= 8 && pairs.length <= 12, `${pairs.length} pairs`);
  for (const pair of pairs) {
    assert.equal(pair.strong.length, 1, `${pair.path} "${pair.title}": one strong set`);
    assert.ok([...pair.section.matchAll(/```text\n/g)].length >= 1, `${pair.path} "${pair.title}": a weak version`);
    assert.match(pair.section, /^\*\*Why\b/m, `${pair.path} "${pair.title}": a note on why`);
  }
  assert.deepEqual([...new Set(strongSets.map(set => set.platform))].sort(), ['google', 'linkedin', 'meta', 'tiktok']);
  const leads = strongSets.filter(set => set.platform === 'meta').map(set => variations(set)[0].angle);
  assert.ok(new Set(leads).size >= 3, `Meta sets lead with ${leads}`);
});

test('strong sets give each variation its own angle and its own opening', () => {
  for (const set of strongSets.filter(item => item.platform !== 'google')) {
    const items = variations(set);
    assert.ok(items.length >= 3, `${set.pair}: ${items.length} variations`);
    assert.equal(new Set(items.map(item => item.angle)).size, items.length, `${set.pair}: angles ${items.map(item => item.angle)}`);
    const openings = items.map(item => firstLine(item.opening ?? item.text));
    assert.equal(new Set(openings).size, openings.length, `${set.pair}: repeated opening`);
    const numeric = openings.filter(line => /\d/.test(line));
    assert.ok(numeric.length <= 1, `${set.pair}: ${numeric.length} variations open on a number: ${numeric}`);
    const product = set.source.match(/^Product: (.+)$/m)?.[1].trim();
    assert.ok(product, `${set.pair}: name the product on a "Product:" line`);
    assert.ok(openings.filter(line => line.startsWith(product)).length <= 1, `${set.pair}: opens with the product name more than once`);
  }
});

test('strong ad copy carries no source text, no period text, and no hedges', () => {
  const source = /\b(?:19|20)\d\d\b|\bQ[1-4]\b|according to|source:|\bper (?:our|the) (?:data|survey|study)|\((?:[^)]*\b(?:data|survey|study|report|internal)\b[^)]*)\)/i;
  const hedge = /not a promise|results (?:may|will) vary|individual results|no guarantee|not guaranteed|may help|could help|might help|typical results|your results/i;
  for (const set of strongSets) {
    const text = copyOf(set);
    assert.doesNotMatch(text, source, `${set.pair}: source or period text`);
    assert.doesNotMatch(text, hedge, `${set.pair}: hedge`);
  }
});

test('strong sets keep to the platform limits the craft states', () => {
  for (const set of strongSets) {
    for (const item of set.platform === 'google' ? [] : variations(set)) {
      const where = `${set.pair} "${item.angle}"`;
      if (set.platform === 'meta') {
        assert.ok(length(firstLine(item.text)) <= 125, `${where}: first line over 125`);
        assert.ok(item.headline && length(item.headline) <= 40, `${where}: headline missing or over 40`);
      }
      if (set.platform === 'linkedin') {
        assert.ok(length(item.text) <= 150, `${where}: intro ${length(item.text)} over 150`);
        assert.ok(item.headline && length(item.headline) <= 70, `${where}: headline missing or over 70`);
      }
      if (set.platform === 'tiktok') {
        assert.ok(item.text && length(item.text) <= 100, `${where}: ad text missing or over 100`);
        assert.ok(item.opening, `${where}: opening seconds missing`);
      }
    }
  }
});

test('every strong Google set passes the RSA checker without errors and repeats no headline', t => {
  const temp = mkdtempSync(join(tmpdir(), 'ads-craft-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const google = strongSets.filter(set => set.platform === 'google');
  assert.ok(google.length >= 2, `${google.length} Google sets`);
  google.forEach((set, index) => {
    const file = join(temp, `rsa-${index}.md`);
    writeFileSync(file, set.source);
    const run = spawnSync(process.execPath, [join(root, 'runtime/bin/conquistador.js'), 'check', file, '--channel', 'google-ads', '--json'], { encoding: 'utf8' });
    const errors = JSON.parse(run.stdout || '[]').filter(item => item.severity === 'error');
    assert.deepEqual(errors.map(item => `${item.rule}: ${item.snippet}`), [], set.pair);
    const headlines = [...(set.source.split(/^Headlines:/m)[1] ?? '').split(/^Descriptions:/m)[0].matchAll(/^\d+\.\s+(.+)$/gm)].map(match => match[1].toLowerCase());
    assert.ok(headlines.length >= 8, `${set.pair}: ${headlines.length} headlines`);
    assert.equal(new Set(headlines).size, headlines.length, `${set.pair}: repeated headline`);
  });
});

test('drafting files teach decisions, not bans on defaults or compliance voice', () => {
  const drafting = ['ENTRY.md', 'references/ad-craft.md', 'agents/composer.md', 'agents/strategist.md'].map(path => join(ads, path));
  for (const path of drafting) {
    assert.doesNotMatch(read(path), /readiness|must remain uncertain|supplies no performance benchmark|not a promise|results may vary|Borrowed benchmark/i, relative(root, path));
  }
  assert.doesNotMatch(read(join(ads, 'references/anti-patterns.md')), /Borrowed benchmark|Unsupported authority|named practitioners/i);
  assert.doesNotMatch(read(join(ads, 'references/ad-intelligence/creative-cadence.md')), /Do not divide spend|Do not prescribe a monthly creative quota/i);
  for (const path of walk(join(ads, 'references/ad-intelligence'))) {
    assert.doesNotMatch(read(path), /supplies no performance benchmark/i, relative(root, path));
  }
  for (const path of [join(ads, 'agents/composer.md'), join(ads, 'agents/strategist.md'), join(ads, 'references/earn-the-impression.md')]) {
    assert.doesNotMatch(read(path), /Retain proof and offer where they are controls|Hold audience, offer, proof, and destination\s+constant|Distinct test hypotheses can share proof/i, relative(root, path));
  }
});

test('numbers in the craft and platform files are dated platform facts or labeled starting points', () => {
  for (const path of numbered) {
    let section = '';
    for (const line of read(path).split('\n')) {
      if (/^#{2,3} /.test(line)) section = line;
      const bare = line.replace(/^\s*\d+\.\s/, '').replace(/`[^`]*`|"[^"]*"|\[[^\]]*\]\([^)]*\)/g, '');
      if (/\d/.test(bare) && !/^#/.test(line) && !/^---$|^\w+: /.test(line)) {
        assert.match(`${section} ${line}`, /Starting point|Platform facts \(checked/i, `${relative(root, path)}: "${line.trim()}" has a number outside a starting-point or dated platform-facts section`);
      }
    }
  }
});

const options = { root, playbooks: [], persistCache: false, cwd: null };
const adsRequests = [
  'Write three Meta ads for our app',
  'Write three Meta (Facebook and Instagram) ad variations. For each: primary text, headline (up to 40 characters), and a one-line visual direction for the image or video.',
  'Write three Facebook ads for our dental software',
  'Write Instagram ad variations for our backpack',
  'Write a Google Search responsive ad: 8 headlines and 3 descriptions for the keyword payroll software',
  'Write three LinkedIn sponsored content ad variations for our security product',
  'Write TikTok ads for our budgeting app',
];

test('ad requests reach ads first and organic post requests stay with social', () => {
  for (const task of adsRequests) assert.equal(createBrief(task, options).methods[0]?.name, 'ads', task);
  for (const task of ['Write an Instagram post about our launch', 'Write a Facebook post announcing our new menu', 'Write a LinkedIn post about hiring']) {
    assert.equal(createBrief(task, options).methods[0]?.name, 'social', task);
  }
});

test('an ads brief carries the drafting decisions and inlines or names the craft within the byte budget', () => {
  for (const task of adsRequests) {
    const pack = packBrief(createBrief(task, options));
    const inlined = pack.structured.inlined.map(item => item.path);
    assert.ok(inlined.some(path => path.endsWith('commands/ads/ENTRY.md')), `${task}: ${inlined}`);
    assert.ok(inlined.some(path => path.endsWith('commands/ads/references/ad-craft.md')) || /Required references not inlined[^\n]*ads\/references\/ad-craft\.md/.test(pack.text), `${task}: ${inlined}`);
    assert.ok(Buffer.byteLength(pack.text) <= 16_000, task);
  }
  for (const task of adsRequests.slice(0, 5)) {
    const inlined = packBrief(createBrief(task, options)).structured.inlined.map(item => item.path);
    assert.ok(inlined.some(path => path.endsWith('commands/ads/references/ad-craft.md')), `${task}: ${inlined}`);
  }
  const entry = read(join(ads, 'ENTRY.md'));
  assert.match(entry, /angle/i);
  assert.match(entry, /situation/i);
  assert.ok(Buffer.byteLength(entry) <= 3_000, `ENTRY.md is ${Buffer.byteLength(entry)} bytes`);
});

test('relative links in the ads files resolve', () => {
  for (const path of owned) {
    for (const [, target] of read(path).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      assert.ok(existsSync(join(dirname(path), target)), `${relative(root, path)} links to missing ${target}`);
    }
  }
});

test('the routing contract still builds from the ads method', () => {
  assert.doesNotThrow(() => buildRoutingContract(root));
});
