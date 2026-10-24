// Social craft rebuild (social command and the x, linkedin, reddit, hacker-news, product-hunt, facebook,
// and instagram channel files). Main's social method tied the model alone 3–3 in a blind test.
// Failure modes, listed and checked before the change:
//  1. strong examples share one structure (same opening move, same shape);
//  2. source, period, or method text appears in post copy;
//  3. a strong example hedges in compliance voice;
//  4. public text names a source or creator, or reuses a blind-test fixture;
//  5. an example invents a result for a real company, or does not declare its people and products synthetic;
//  6. the publish approval, the facts check after drafting, or the quote-consent rule is lost;
//  7. a strong example exceeds its platform limit or fails `conquistador check`;
//  8. a social brief for a named platform goes over budget or drops the entry or the channel craft;
//  9. drafting files speak in compliance or test-plan voice instead of craft;
// 10. a number in a channel file's guidance is neither a dated platform fact nor a labeled starting point;
// 11. the annotated pairs fall outside 8–12, or a pair lacks its weak version or its note;
// 12. a relative link breaks, or the routing contract no longer builds.
// Text copied from private sources is checked outside this repository, because those sources are private.
// Name lists are stored as hashes so this public file does not name what it excludes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { LIMITS, PLATFORMS, createBrief, packBrief } from './brief.mjs';
import { buildRoutingContract } from './routing-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const library = join(root, 'skills/conquistador');
const social = join(library, 'commands/social');
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const CHANNELS = ['x', 'linkedin', 'reddit', 'hacker-news', 'product-hunt', 'facebook', 'instagram'];
const channelPath = name => join(library, 'channels', `${name}.md`);
const owned = [...walk(social).filter(path => path.endsWith('.md')), ...CHANNELS.map(channelPath)];
const read = path => readFileSync(path, 'utf8');
const rel = path => relative(root, path);

const SOURCE_HASHES = new Set(["f2486dfd64f3a9a7","04d28a763e267534","e7cacc70d1c698e2","8a4f602da17403c8","6dcbac4eaa4198c5","29cf64f73a654bec","f7e0469a5883bb23","096c400945fc4d4b","21b5d62444736672","c97708b4e7f8ee1d","b6e81b71ac210e45","72f7ba8007d52ef3","7ed5faf25e93d8bc","b10fcc4c629671b7","1a9c42d1d24de126","de9b63333fd4e998","c5f975b35c72cfe2","bed67f2f99611bea","f5ab926d58af0f78","654e96483f1956f1","4d4af3100504becd","c256d65b0553d71d","d248378e93878b57","691351fd94f25a49","bb56ce64d6ccc4a6","d7a21c89de58a18e","bec85a9ae24aa157","6066824f5e48b71e","f7a0baff57d97ce1","999635345e735221","5d66fa969161aad4","1fbab3c7b7e65431","7c17bc14536e3984","62be350232b5ae92","1ad5295183fbcf12","c3ed699683e7e704","5d78c2ee6a798596","e2e72c392a1febac","42e6192aa2bb9564","86401e9d506c6e6c","154b07c5959bb7a6","1a9ee770333c0f31","70d991ae56206301","a29150eecce86908","7d3e21aacaa31cec","15793447a9babee8","973dcd556a629069","3b7017bbafb89da3","985c612e2951f0f3","fdec438ea518f588","fef8cec0ffdcbf78","3c99a66ac7f21e1d","2359742ec2d406d3","c1ac2157fc73dec7","d8b396c9cc79cbe4","dfe138e1fbb1d44f","2b7c080f7b62bce2","a79c356d145709bd"]);
const FIXTURE_HASHES = new Set(["4271cdae6c74d73e","5f1bf447b6ae8b55","262fc5c8dae5d22e","f933635b74f6fd3a","120eb71bda2ff596","a806df826ed14b57","99009c8b3037a473","6c03c68be3f6f15d","14463b8f2ba0131a","30a79c4fab7debe2","aa83825b51603227","e8c9c5c106eb2679","66ffc78632c84cf0","c1939260ea8f2d77","191c53b1529cf541","2a3b2bc4872c8308","76c4861efc135371","bd856f43b6beef90"]);
const COMPANY_HASHES = new Set(["2bed2032ed3d8300","31f61ed3e6e210c5","877c3aec832cd410","8a72266588ef612e","91b6da07adf530f8","3ccbd9105a45d8fc","5b79d0d574eedd09","3db1f560db626918","ab7d0a36ecbe10c2","74c860f63661b29c","a60ec1cf58f49cd2","58b4537b616e6572","1dd8cb03d5dc9395","80daf15e57af2a31","d21800cafd9b39d7","59e223bd8ec2ed14","95f3aff4188f8ccf","9fbf261b62c1d7c0","cbc62794911ff31b","3a7bd3e2360a3d29","7d3194f79e645c42","c70eca6b0f88f44d","bbdefa2950f49882","ea3bd73e2b506e00","13ed070478ef62c3","2b78da3dc866654e","40c57bb53c07338b","4de4a07ad031569c","651b2c67d5361363","9d3508a8484ee252","be6a999624b589e8","80c6541cdd1b74d9","d56d16d88324bdc4","c47b618e17c75f06","e473f24d4325d51a","75170593d559f227","784a2ddf5d4d61b6","e402bd4f0a138c71","77e5604feeaf6e01","82b818c5f0192223","8c0f664ba26e8dcd","dfbf85cc71c7dd60","b0126946c556dc47","5ba14c9c0738b2e6","09a2f4897466c7a5","7358bd4ec877e1b6","5dd95c98aff2e783","459090e9ac2fc23c","aa5af52e3429b489","a5c1835f2f1f4d4d","efc68bdfc744cb70","9db728d18b9d39ba","f7d9f5a90479d632","8073c5350194424a","462084cbbb1ea5b2","cb37790a8586667f","cbcf6dfcd8154efc"]);
const words = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const hits = (text, hashes) => {
  const list = words(text);
  const found = new Set();
  for (let size = 1; size <= 4; size++) for (let at = 0; at + size <= list.length; at++) found.add(list.slice(at, at + size).join(' '));
  return [...found].filter(gram => hashes.has(hash(gram)));
};

// Examples live in each channel file: a ```strong block, a ```weak block, and a **Why** note per pair.
const examples = CHANNELS.flatMap(name => [...read(channelPath(name)).matchAll(/```(strong|weak)\n([\s\S]*?)```/g)]
  .map(match => ({ channel: name, kind: match[1], text: match[2].trim() })));
const strong = examples.filter(item => item.kind === 'strong');
const posts = text => text.split(/^---$/m).map(part => part.trim()).filter(Boolean);
const outsideExamples = text => text.replace(/```(?:strong|weak)\n[\s\S]*?```/g, '');
// The title or label line a platform requires sits above the body; the checker sees the body only.
const LABEL = /^(?:Title|Tagline|Show HN|Caption|Reply|First comment|Slide \d+):?\s*/;
const body = text => text.split('\n').filter(line => !/^(?:Title|Tagline|Show HN|Slide \d+):/.test(line)).join('\n').trim();

test('public social text names no source or creator and reuses no blind-test fixture', () => {
  for (const path of owned) {
    const text = read(path);
    assert.deepEqual(hits(text, SOURCE_HASHES), [], `${rel(path)} names a source`);
    assert.deepEqual(hits(text, FIXTURE_HASHES), [], `${rel(path)} reuses a blind-test fixture`);
  }
});

test('examples use synthetic people and products, invent no real company result, and report nothing posted', () => {
  for (const name of CHANNELS) {
    const text = read(channelPath(name));
    if (!/```strong/.test(text)) continue;
    assert.match(text, /synthetic/i, `${name} must declare its examples synthetic`);
    assert.match(text, /Nothing (?:here )?was posted/i, `${name} must say nothing was posted`);
  }
  for (const item of examples) assert.deepEqual(hits(item.text, COMPANY_HASHES), [], `${item.channel} example names a real company`);
});

test('there are 8 to 12 annotated pairs across at least five platforms, each with weak version and note', () => {
  assert.ok(strong.length >= 8 && strong.length <= 12, `${strong.length} strong examples`);
  assert.ok(new Set(strong.map(item => item.channel)).size >= 5, 'pairs cover at least five platforms');
  for (const name of CHANNELS) {
    const text = read(channelPath(name));
    const strongCount = [...text.matchAll(/```strong\n/g)].length;
    assert.equal([...text.matchAll(/```weak\n/g)].length, strongCount, `${name}: one weak version per strong example`);
    assert.ok([...text.matchAll(/^\*\*Why\b/gm)].length >= strongCount, `${name}: a note for each pair`);
  }
});

test('strong examples vary their opening move and their shape', () => {
  const opener = text => {
    const first = body(text).split('\n')[0].replace(LABEL, '');
    if (/^["“]/.test(first)) return 'quote';
    if (/\?\s*$/.test(first)) return 'question';
    if (/^(?:I|I'm|I've|I'd|We|We're|We've|My|Our)\b/.test(first)) return 'first-person';
    if (/^(?:You|Your)\b/.test(first)) return 'reader';
    if (/^\d|^\$/.test(first)) return 'number';
    return 'statement';
  };
  const shape = text => [posts(text).length > 1 ? 'multi' : 'single', /^\s*(?:[-•]|\d+\.)\s/m.test(text) ? 'list' : 'prose',
    /\?\s*$/.test(body(text).split('\n').filter(Boolean).at(-1) ?? '') ? 'asks' : 'tells'].join('/');
  const openers = strong.map(item => opener(item.text));
  const counts = openers.reduce((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {});
  assert.ok(Object.keys(counts).length >= 4, `opening moves: ${JSON.stringify(counts)}`);
  for (const [move, count] of Object.entries(counts)) assert.ok(count <= Math.ceil(strong.length * 0.4), `${count} of ${strong.length} strong examples open the same way (${move})`);
  assert.ok(new Set(strong.map(item => shape(item.text))).size >= 4, `shapes: ${strong.map(item => shape(item.text))}`);
});

test('strong examples carry no source, period, or method text and no compliance hedges', () => {
  const sourceText = /\([^)]*\b(?:data|source|survey|study|usage|internal|sample|n\s*=)\b[^)]*\)|\bQ[1-4] 20\d\d\b|\bsource:|according to (?:our|internal)/i;
  const hedge = /not a promise|results (?:may|will|can) vary|individual results|typical results|no guarantee|not guaranteed|can(?:no|')t guarantee|for illustrative purposes|your mileage may vary|not (?:financial|legal|medical) advice|proposed voice/i;
  for (const item of strong) {
    assert.doesNotMatch(item.text, sourceText, `${item.channel}: ${item.text.split('\n')[0]}`);
    assert.doesNotMatch(item.text, hedge, `${item.channel}: ${item.text.split('\n')[0]}`);
  }
});

test('strong examples keep to platform limits', () => {
  for (const item of strong) {
    const lines = item.text.split('\n');
    const label = prefix => lines.find(line => line.startsWith(prefix))?.slice(prefix.length).trim();
    if (item.channel === 'hacker-news') {
      const title = lines.find(line => line.startsWith('Show HN:'));
      assert.ok(title && title.length <= 80, `Show HN title must start "Show HN:" and fit 80 characters: ${title}`);
    }
    if (item.channel === 'product-hunt') assert.ok((label('Tagline:') ?? '').length > 0 && label('Tagline:').length <= 60, `tagline: ${label('Tagline:')}`);
    if (item.channel === 'reddit') assert.ok((label('Title:') ?? '').length > 0 && label('Title:').length <= 300, `reddit title: ${label('Title:')}`);
    if (item.channel === 'instagram') assert.ok([...body(item.text)].length <= 2200, 'instagram caption over 2,200');
  }
});

test('every strong example passes conquistador check for its channel without errors or warnings', t => {
  const temp = mkdtempSync(join(tmpdir(), 'social-craft-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const checkChannel = { x: 'x', linkedin: 'linkedin' };
  strong.forEach((item, index) => {
    const file = join(temp, `post-${index}.md`);
    writeFileSync(file, `${body(item.text)}\n`);
    const run = spawnSync(process.execPath, [join(root, 'runtime/bin/conquistador.js'), 'check', file, '--channel', checkChannel[item.channel] ?? 'social', '--json', '--no-config'], { encoding: 'utf8' });
    const findings = JSON.parse(run.stdout || '[]').filter(finding => finding.severity !== 'advisory');
    assert.deepEqual(findings.map(finding => `${finding.rule}: ${finding.snippet}`), [], `${item.channel}: ${item.text.split('\n')[0]}`);
  });
});

test('the approval boundary, the facts check after drafting, and quote consent survive', () => {
  const approval = /(?:publish|post|schedul)[\s\S]{0,160}approv|approv[\s\S]{0,160}(?:publish|post|schedul)/i;
  for (const path of ['ENTRY.md', 'COMMAND.md', 'references/method.md']) assert.match(read(join(social, path)), approval, path);
  const check = read(join(social, 'references/method.md'));
  assert.match(check, /^## After drafting/m);
  assert.match(check, /add nothing/i);
  assert.match(check, /quote[\s\S]{0,120}(?:consent|permission)|(?:consent|permission)[\s\S]{0,120}quote/i);
  assert.match(check, /first person|first-person/i);
  assert.match(read(join(social, 'ENTRY.md')), /references\/method\.md/);
  assert.match(read(join(social, 'COMMAND.md')), /edit mode/i);
});

test('drafting files teach craft, not compliance or test-plan voice', () => {
  const voice = /proposed voice|NEEDS_CONTEXT|FORMAT_FAIL|GUARD_FAIL|Observable measure|denominator|must remain uncertain|pack §|§\d|stop rule|discrimination test|Legibility|Why this works/i;
  for (const path of [join(social, 'ENTRY.md'), ...CHANNELS.map(channelPath)]) {
    assert.doesNotMatch(outsideExamples(read(path)), voice, rel(path));
  }
});

test('numbers in channel guidance are dated platform facts or labeled starting points', () => {
  for (const name of CHANNELS) {
    const text = outsideExamples(read(channelPath(name)));
    assert.match(text, /^## Platform facts \(checked Oct(?:ober)? 2026/m, `${name}: dated platform facts section`);
    let section = '';
    for (const line of text.split('\n')) {
      if (/^#{2,3} /.test(line)) { section = line; continue; }
      const bare = line.replace(/`[^`]*`|"[^"]*"|\[[^\]]*\]\([^)]*\)/g, '');
      if (/\d/.test(bare)) assert.match(`${section} ${line}`, /Platform facts \(checked Oct|Starting point/i, `${name}: "${line.trim()}"`);
    }
  }
});

// Named-platform tasks phrased like real requests, not like the blind-test briefs.
const TASKS = {
  linkedin: ['Write a LinkedIn post from the founder announcing our new integration', 'Write a LinkedIn post for the company page announcing a customer result', 'Write a LinkedIn post from the CEO announcing a job opening'],
  x: ['Write an X thread about what we learned from a price increase', 'Write a launch post for X and a reply with the link'],
  reddit: ['Write a Reddit post for r/smallbusiness sharing data from our product'],
  'hacker-news': ['Write a Show HN post and the first comment for our CLI'],
  'product-hunt': ['Write the Product Hunt tagline and maker comment for our launch'],
  instagram: ['Write an Instagram carousel caption for our recipe app'],
  facebook: ['Write a Facebook post for a group of bakery owners'],
};

test('a named-platform social brief inlines the entry and the channel craft within budget', () => {
  const options = { root, playbooks: [], persistCache: false, cwd: null };
  for (const [name, tasks] of Object.entries(TASKS)) {
    for (const task of tasks) {
      const brief = createBrief(task, options);
      assert.equal(brief.methods[0]?.name, 'social', task);
      const pack = packBrief(brief);
      const inlined = pack.structured.inlined.map(item => item.path);
      assert.ok(inlined.some(path => path.endsWith('commands/social/ENTRY.md')), `${task}: ${inlined}`);
      assert.ok(inlined.some(path => path.endsWith(`channels/${name}.md`)), `${task}: ${inlined}`);
      assert.ok(!inlined.some(path => path.endsWith('references/writing-guide.md')), task);
      assert.ok(Buffer.byteLength(pack.text) <= LIMITS.packBytes, `${task}: ${Buffer.byteLength(pack.text)} bytes`);
      assert.ok([...inlined, ...(brief.deferredRequired ?? [])].some(path => path.endsWith('commands/social/references/method.md')), `${task}: the check is named`);
    }
  }
});

test('each channel file fits beside the largest platform pack the same request can bring', () => {
  for (const name of CHANNELS) {
    const stems = new Set(Object.values(PLATFORMS).filter(list => list.includes(name)).flat());
    const packs = [...stems].map(stem => join(social, 'references/platform-intelligence', `${stem}.md`)).filter(existsSync);
    const largest = Math.max(0, ...packs.map(path => statSync(path).size));
    const size = statSync(channelPath(name)).size;
    assert.ok(size + largest <= LIMITS.mustBytes, `${name}: ${size} + ${largest} > ${LIMITS.mustBytes}`);
  }
});

test('relative links in the social files resolve', () => {
  for (const path of owned) {
    for (const [, target] of read(path).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      assert.ok(existsSync(join(dirname(path), target)), `${rel(path)} links to missing ${target}`);
    }
  }
});

test('the routing contract still builds from the social method', () => {
  assert.doesNotThrow(() => buildRoutingContract(root));
});
