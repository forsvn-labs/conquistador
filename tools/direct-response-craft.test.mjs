// Direct-response copy craft (copy, convert, landing play, three landing/copy specialists).
// Failure modes listed and covered before the method text was written:
//  1. public text names a practitioner, course, book, or branded framework;
//  2. text copied or closely paraphrased from private course transcripts or overlay notes
//     (exact 8-word overlap, captions included; runs only when CONQUISTADOR_CRAFT_SOURCES names a private folder);
//  3. an invented statistic or conversion benchmark stated as fact;
//  4. a sourced specific claim blurred into vague language;
//  5. a lost approval boundary;
//  6. strong examples that fail `conquistador check` on their channel;
//  7. the craft reference missing from the brief, or the brief over budget;
//  8. review leftovers (self-referencing landing eval, lifecycle sequences sent to cold outreach,
//     retired tags, repeated command names, a headline file with no patterns);
//  9. examples that reuse the blind-test fixture or invent results for real companies;
// 10. long ENTRY files, or ENTRY files that do not point at the craft first;
// 11. drafting rules placed after the facts check; broken links; private storage paths.
// Round 2 (the owner preferred the bare draft in 5 of 8 blind pairs; the method copy was accurate but literal):
// 12. source, period, or attribution text inside strong page copy (it belongs in the operator note);
// 13. a strong headline that only describes the product, its category, or its features, or that leads
//     with an unknown customer's result;
// 14. disclaimers, hedges, or compliance voice in strong examples;
// 15. strong examples that restate the audience definition, or a hero that uses every fact;
// 16. rules that put the source beside the number on the page, ask the subhead for "who it is for",
//     or push review roles toward literal description or added hedging;
// 17. the reader-first, selection, operator-note, no-hedge, and fair-inference rules missing from the
//     craft, the review roles, or the brief;
// 18. (retired in round 4: short-form has no examples) the example set missing heroes or a sales argument.
// Round 3 (the method won long-form work and lost short-form work across 16 blind pairs; the owner split copy by length):
// 19. (replaced by 27) a short-form request loading the long-form review roles or long-form files;
// 20–23, 25. (retired in round 4) the short-form checklist and its strong examples: offer terms, angles,
//     a headline specific, social proof, the checklist's rules and size;
// 24. long-form requests losing their current method (sales argument, roles, review, examples);
// 26. a short-form brief no smaller than the long-form brief.
// Round 4 (the round-3 checklist lost 1–7; across 24 copy pairs every short-form rule set made the model worse;
// the owner made short-form copy a pass-through):
// 27. a short-form brief that carries any drafting rule, pattern, example, review role, or other copy file;
// 28. a short-form mode (ENTRY, COMMAND, specialist) that links a file or names a drafting rule;
// 29. a facts check that adds text (a hedge, source text, a disclaimer, a qualifier, or an operator note);
// 30. the short-form checklist or a short-form example still present, or a lead magnet guide with drafting rules;
// 31. a long-form file, a long-form COMMAND section, or a long-form example changed;
// 32. a long-form request (including a sales page request) that routes to no method or loses its files;
// 33. an approval boundary lost from ENTRY, the short-form mode, or the lead magnet guide.
// Name lists are stored as hashes so this public file does not name the sources it excludes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief, packBrief } from './brief.mjs';
import { checkText, counted } from './check/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const library = join(root, 'skills/conquistador');
const options = { root, playbooks: [], persistCache: false, cwd: null };
const read = path => readFileSync(join(library, path), 'utf8');

const SOURCE_HASHES = new Set(["a29150eecce86908","223b44349b89e3e4","d9913641fc2bb97b","ceee9bfc428c0f2e","23287acf826eaa5a","e094e13212ef43ce","98c7630e6ec3cb96","9e298e7de7022755","f709f5bae0805a13","f2486dfd64f3a9a7","9b227aebb0b24a93","ae2160090ce50a78","dc0a38c56b31e9c9","7831c62966a8eae2","2425e64752d309fb","a929c5789c0b2460","4f20db50275b0bcf","fe6bd0a76dd27305","e4d2432c256397b6","7f79b0a841464ecf","3e90907fc3ad3c1a","227043cd3ea94f96","358326385f017ce6","f8d87c4dc6db5f20","177026aee3800186","65b87ef1994c9e9f","1a9c42d1d24de126","f4e9a8387c459a2a","11f622e911f1aa94","481e4fbedcbb0255","006e39f60f196420","72f7ba8007d52ef3","d5da674069f59968","c97708b4e7f8ee1d","de0856dbaf727bcb","de9b63333fd4e998","8a4f602da17403c8","05724e2c891973c5","04d28a763e267534","016668639aae48b1","127cf78dd078786a","980cc4ecf43fd3ba","6dcbac4eaa4198c5","6a5351f8d7e6fe47","d99a675bb427a24b","eebcd76c019d506b","46bb176559dff5ac","0239d49a3e49d346","6f5d6b31a9271804","5e49a87810083c5b","fdec438ea518f588","bd44633a85080588","7fb88f30a75127d0","ca56f5429c3590b2","b10fcc4c629671b7","ca4d0cc5d08065da","f55898f0494c8616","4cd72718e6b1ccfa","72b14c2b1128cc5d","3278ba1a0bf234ca","d28d8c658f633660","a538d657dcc727c8","29cf64f73a654bec","4d94700f3a46ec44","8bd3cf322ab4b8e2"]);
const COMPANY_HASHES = new Set(["2bed2032ed3d8300","31f61ed3e6e210c5","50b7110eceb6157f","a638e70ffa28c67e","ea6f9c07a2f95c78","822b33ad87c148a0","91b6da07adf530f8","3ccbd9105a45d8fc","8a72266588ef612e","989cbe57e6200a17","4321dedb277b6216","c9d45754c8ed1d9e","70d991ae56206301","cc0acecd2fbde748","da944a0ab0fcef21","b0424e56be9a7ea9","7358bd4ec877e1b6","241c1e30ed886aa4","74c860f63661b29c","ab7d0a36ecbe10c2","9fbf261b62c1d7c0","75170593d559f227","c47b618e17c75f06","59e223bd8ec2ed14","d56d16d88324bdc4"]);
const FIXTURE_HASHES = new Set(["c1939260ea8f2d77","191c53b1529cf541","2a3b2bc4872c8308","76c4861efc135371"]);

const walk = path => {
  const absolute = join(library, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute).sort().flatMap(name => walk(join(path, name)));
};
// Every Markdown file this practice owns. hypothesis-framework.md is a shared copy owned elsewhere.
const owned = ['commands/copy', 'commands/convert', 'plays/landing', 'plays/landing.md',
  'specialists/copy-agent.md', 'specialists/dr-landing-agent.md', 'specialists/saas-landing-agent.md']
  .flatMap(walk).filter(path => path.endsWith('.md') && !path.endsWith('convert/references/hypothesis-framework.md'));

// Files rewritten as craft. They carry the strict number and company rules.
const craft = [
  'commands/copy/ENTRY.md', 'commands/copy/COMMAND.md', 'commands/copy/fallbacks/sequential.md',
  'commands/copy/references/sales-argument.md', 'commands/copy/references/headline-formulas.md',
  'commands/copy/references/copy-review.md', 'commands/copy/references/anti-patterns.md',
  'commands/copy/references/long-form-library.md', 'commands/copy/references/lifecycle-sequences.md',
  'commands/copy/references/examples/direct-response-examples.md',
  'commands/copy/references/lead-magnet-stack.md',
  'commands/copy/agents/body-agent.md', 'commands/copy/agents/cta-agent.md',
  'commands/copy/agents/social-proof-agent.md', 'commands/copy/agents/hook-agent.md',
  'commands/convert/ENTRY.md', 'commands/convert/COMMAND.md', 'commands/convert/fallbacks/sequential.md',
  'commands/convert/references/page-conversion-craft.md', 'commands/convert/references/anti-patterns.md',
  'commands/convert/references/landing-eval-method.md', 'commands/convert/references/examples/signup-page-rewrite.md',
  'plays/landing.md', 'plays/landing/references/conversion/core-principles.md',
  'plays/landing/references/conversion-principles.md',
  'specialists/copy-agent.md', 'specialists/dr-landing-agent.md', 'specialists/saas-landing-agent.md',
];
const examples = craft.filter(path => /\/examples\//.test(path));
// Retired in round 4: short-form copy is a pass-through with no checklist.
const SHORT = 'commands/copy/references/short-form-copy.md';
// Files whose invented products carry a facts bullet ("- **Name:** …").
const rosterFiles = examples;

const words = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const grams = (text, max = 4) => {
  const list = words(text);
  const found = new Set();
  for (let size = 1; size <= max; size++) for (let at = 0; at + size <= list.length; at++) found.add(list.slice(at, at + size).join(' '));
  return found;
};
const hits = (text, hashes) => [...grams(text)].filter(gram => hashes.has(hash(gram)));

// Every quoted block under a **Strong** label, with its channel, what its headline leads with, and its section.
const strongFiles = [...examples, 'commands/copy/references/headline-formulas.md'];
const strongBlocks = () => strongFiles.flatMap(path => {
  const lines = read(path).split('\n');
  const found = [];
  let section = '';
  lines.forEach((line, index) => {
    if (/^## /.test(line)) section = line.slice(3);
    const match = line.match(/^\*\*Strong\*\*.*\((check: [^)]+)\)/);
    if (!match) return;
    const fields = Object.fromEntries(match[1].split(';').map(part => part.split(':').map(item => item.trim())).map(([key, ...value]) => [key, value.join(':')]));
    const label = [null, fields.check, fields['leads with']];
    const block = [];
    for (let at = index + 1; at < lines.length; at++) {
      if (lines[at].startsWith('>')) block.push(lines[at].replace(/^>\s?/, ''));
      else if (block.length || lines[at].trim()) break;
    }
    found.push({ where: `${path}:${index + 1}`, path, channel: label[1], lead: label[2], form: fields.form, product: fields.product,
      angles: fields.angles ? fields.angles.split(',').map(item => item.trim()) : [], section, lines: block, text: block.join('\n') });
  });
  return found;
});
// Invented roster: product names, customer names, and audience definitions from the example files.
const roster = () => {
  const text = rosterFiles.map(read).join('\n');
  const field = name => [...text.matchAll(new RegExp(`${name}: ([^.\\n]+)`, 'g'))].map(match => match[1].trim());
  return {
    products: [...text.matchAll(/^- \*\*([^:*]+):\*\*/gm)].map(match => match[1].trim()),
    customers: field('Customer'),
    audiences: field('Audience'),
  };
};
const LEADS = new Set(['want', 'pain', 'identity', 'outcome', 'mechanism', 'offer', 'scene', 'set']);
const SOURCE_TEXT = [
  /\([^()]*\b(?:19|20)\d\d\)/,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December),? (?:19|20)\d\d\b/,
  /\bQ[1-4],? (?:19|20)\d\d\b/,
  /\b(?:according to|source:|sources:|measured (?:by|in|over)|usage data|survey of|in a survey|as of|interview(?:ed)?\b|analytics\b|data from)/i,
  /^\*[^*]/m,
];
const HEDGES = /\bnot a promise\b|\bresults? (?:may|will|can) (?:vary|differ)\b|\bnot typical\b|\bindividual results\b|\b(?:is|are|was) (?:her|his|their|our|my) (?:own )?(?:result|experience)s?\b|\bno guarantee\b|\bcannot guarantee\b|\bnot a guarantee\b|\bdisclaimer\b|\b(?:may|might|could) help\b|\bpotentially\b|\bdesigned to help\b|\baims? to\b|\bin some cases\b|\bhopefully\b|\bwe think\b|\bmay differ\b/i;
const AUDIENCE = [
  /\b(?:for|built for|made for|designed for) [^.\n]{0,60}?\b(?:who|that) (?:live|keep|charge|run|want|use|have|are|work|own)\b/i,
  /\b(?:of|with) \d+\s?(?:[–-]|to)\s?\d+ (?:people|staff|lawyers|engineers|therapists|employees|units|locations|seats|users)\b/i,
  /\b(?:is|are) an? (?:[\w-]+ ){0,3}(?:app|tool|platform|course|service|software|sheet|spreadsheet)\b for\b/i,
];
const DESCRIPTIVE_HEADLINE = /^(?:the|a|an|meet|introducing|our)\b[^.!?]{0,50}\b(?:app|tool|platform|software|solution|course|sheet|spreadsheet|template|service|system|suite)s?\b|^(?:all-in-one|ai-powered|smart(?:er)?|modern|next-gen)\b|\b(?:software|platform|app|tool|solution) (?:for|with|that)\b|^the [\w-]+(?: [\w-]+){0,3} with (?:the |a |an )?[\w-]+|^\$\d|^rated \d/i;
const headlinesOf = block => block.lead === 'set'
  ? block.lines.filter(line => /^\d+\. /.test(line)).map(line => line.replace(/^\d+\. /, ''))
  : [block.lines.find(line => line.trim())];

test('craft files exist', () => {
  for (const path of craft) assert.ok(existsSync(join(library, path)), path);
});

test('public method text names no practitioner, course, book, or branded framework', () => {
  for (const path of owned) assert.deepEqual(hits(read(path), SOURCE_HASHES).map(hash), [], path);
});

test('examples use invented products only, never the blind-test fixture or real companies', () => {
  for (const path of owned) assert.deepEqual(hits(read(path), FIXTURE_HASHES).map(hash), [], path);
  for (const path of craft) assert.deepEqual(hits(read(path), COMPANY_HASHES).map(hash), [], path);
  for (const path of examples) assert.match(read(path), /invented/i, `${path} must say its products and numbers are invented`);
});

test('no percentage or multiplier appears as an unlabeled fact in craft text', () => {
  const number = /\b\d+(?:\.\d+)?\s?%|(?:^|[\s~(])\d+(?:\.\d+)?\s?[x×](?=[\s,.;)]|$)|\b\d+ times (?:faster|more|better|higher)\b/i;
  for (const path of craft.filter(path => !examples.includes(path))) {
    read(path).split('\n').forEach((line, index) => {
      if (number.test(line)) assert.match(line, /Starting point \(Oct 2026\)|invented|synthetic|formula|source:/i, `${path}:${index + 1} ${line}`);
    });
  }
});

test('sourced specifics stay specific, and their source goes in the operator note', () => {
  const rule = /keep (?:the|a) sourced (?:number|specific)[^\n]*exact/i;
  const note = /operator\s+note/i;
  for (const path of ['commands/copy/references/sales-argument.md', 'commands/copy/references/copy-review.md',
    'plays/landing/references/conversion/core-principles.md']) {
    assert.match(read(path), rule, path);
    assert.match(read(path), note, path);
  }
  for (const path of ['commands/copy/ENTRY.md', 'commands/copy/COMMAND.md', 'commands/copy/fallbacks/sequential.md',
    'commands/convert/ENTRY.md', 'commands/convert/references/page-conversion-craft.md', 'plays/landing.md']) assert.match(read(path), note, path);
  assert.doesNotMatch(read('commands/copy/references/copy-review.md'), /generali[sz]e (?:the|a) (?:number|result)|replace (?:the|a) number with/i);
  const pack = packBrief(createBrief('Write landing page copy for our SaaS', options));
  assert.match(pack.text, rule);
  assert.match(pack.text, note);
});

test('no rule puts the source on the page or pushes toward literal, hedged copy', () => {
  const banned = /source (?:and scope )?(?:beside|next to|directly under|right under)|source(?:, scope, and date)? beside|sits right under the headline|subhead (?:that )?carries who it is for|subhead with who it is for|\*\*Subhead:\*\* who it is for|who it is for, the mechanism|actual behavior supplied in the brief|preserve qualifications|keep qualifications close|intended visitor, and relevant limitation|intended task, relevant limitation|always give the date so the reader|explain the contents and limitations/i;
  for (const path of owned) assert.doesNotMatch(read(path), banned, path);
});

test('the craft starts from the reader, selects, and keeps compliance voice out of drafting', () => {
  const reader = /want,\s+pain,\s+or\s+identity/i;
  const select = /one\s+proof[\s\S]{0,40}?one\s+mechanism/i;
  const noHedge = /(?:do\s+not|does\s+not|never|must\s+not)\s+add\s+disclaimers,\s+hedges,\s+or\s+(?:source\s+text|attributions)/i;
  // Round 4: ENTRY carries no drafting rule, because every copy brief inlines it; the long-form files hold them.
  for (const path of ['commands/copy/references/sales-argument.md', 'commands/copy/references/headline-formulas.md',
    'commands/copy/agents/hook-agent.md', 'commands/convert/references/page-conversion-craft.md', 'plays/landing/references/conversion/core-principles.md']) {
    assert.match(read(path), reader, path);
  }
  for (const path of ['commands/copy/references/sales-argument.md', 'commands/copy/agents/hook-agent.md',
    'commands/copy/fallbacks/sequential.md']) assert.match(read(path), select, path);
  for (const path of ['commands/copy/references/copy-review.md', 'commands/copy/COMMAND.md', 'commands/copy/fallbacks/sequential.md',
    'commands/copy/agents/voice-agent.md', 'commands/copy/agents/psychology-agent.md', 'commands/copy/agents/zero-risk-agent.md',
    'commands/copy/agents/critic-agent.md', 'commands/copy/agents/cta-agent.md', 'commands/copy/agents/hook-agent.md',
    'plays/landing/references/conversion-principles.md']) assert.match(read(path), noHedge, path);
  for (const path of ['commands/copy/references/copy-review.md', 'commands/copy/agents/critic-agent.md',
    'commands/copy/agents/psychology-agent.md', 'commands/copy/fallbacks/sequential.md']) assert.match(read(path), /fair\s+inference/i, path);
  // Long-form briefs carry the rules; short-form briefs carry none (round 4, below).
  for (const task of ['Write landing page copy for our SaaS', 'Write the sales page for our course']) {
    const pack = packBrief(createBrief(task, options));
    for (const pattern of [reader, select, /operator\s+note/i]) assert.match(pack.text, pattern, task);
  }
});

test('approval boundaries remain in every entry', () => {
  for (const path of ['commands/copy/ENTRY.md', 'commands/copy/COMMAND.md', 'commands/copy/references/lead-magnet-stack.md',
    'commands/copy/fallbacks/sequential.md', 'commands/convert/COMMAND.md',
    'commands/convert/fallbacks/sequential.md', 'plays/landing.md', 'specialists/copy-agent.md',
    'specialists/dr-landing-agent.md', 'specialists/saas-landing-agent.md']) {
    const text = read(path);
    assert.match(text, /approv/i, path);
    assert.match(text, /\b(?:send|sending|publish|publishing|publication|deploy|deployment)\b/i, path);
  }
});

test('strong examples pass the writing check on their channel', () => {
  const blocks = strongBlocks();
  for (const block of blocks) {
    assert.ok(block.lines.length, `${block.where} strong label without a quoted block`);
    const findings = checkText(block.text, { channel: block.channel, file: `${block.where}.md` }).filter(counted);
    assert.deepEqual(findings.map(item => `${item.rule}: ${item.snippet}`), [], block.where);
  }
  assert.ok(blocks.length >= 7, `only ${blocks.length} strong examples are machine-checked`);
});

test('strong page copy carries no source, period, or attribution text', () => {
  for (const block of strongBlocks()) {
    for (const pattern of SOURCE_TEXT) assert.doesNotMatch(block.text, pattern, block.where);
  }
});

test('strong examples carry no disclaimers, hedges, or compliance voice', () => {
  for (const block of strongBlocks()) assert.doesNotMatch(block.text, HEDGES, block.where);
});

test('strong examples do not restate the audience definition', () => {
  const { audiences } = roster();
  assert.ok(audiences.length >= 4, 'each invented product names its audience in the roster');
  for (const block of strongBlocks()) {
    for (const pattern of AUDIENCE) assert.doesNotMatch(block.text, pattern, block.where);
    const copy = ` ${words(block.text).join(' ')} `;
    for (const audience of audiences) {
      const list = words(audience);
      for (let at = 0; at + 4 <= list.length; at++) assert.ok(!copy.includes(` ${list.slice(at, at + 4).join(' ')} `), `${block.where} restates "${audience}"`);
    }
  }
});

test('strong headlines start from the reader, not the product or an unknown customer', () => {
  const { products, customers } = roster();
  assert.ok(products.length >= 4 && customers.length >= 2, 'roster names products and customers');
  for (const block of strongBlocks()) {
    assert.ok(LEADS.has(block.lead), `${block.where} must say what its headline leads with (${[...LEADS].join(', ')})`);
    for (const headline of headlinesOf(block)) {
      assert.ok(headline, `${block.where} has no headline`);
      assert.doesNotMatch(headline, DESCRIPTIVE_HEADLINE, `${block.where} headline describes the product: ${headline}`);
      for (const name of [...products, ...customers]) assert.ok(!headline.toLowerCase().startsWith(name.toLowerCase()), `${block.where} headline leads with ${name}`);
    }
  }
});

test('hero-sized strong examples select instead of using every fact', () => {
  for (const block of strongBlocks().filter(block => /Hero|Lead magnet|Consumer app/.test(block.section))) {
    const count = words(block.text).length;
    assert.ok(count <= 90, `${block.where} hero runs ${count} words`);
    const subhead = block.lines.filter(line => line.trim())[1] ?? '';
    assert.ok((subhead.match(/[.!?](?=\s|$)/g) ?? []).length <= 2, `${block.where} subhead runs past two sentences`);
  }
});

test('example set covers leads, a hero that argues, a sales argument, and a before/after rewrite', () => {
  const copy = read('commands/copy/references/examples/direct-response-examples.md');
  const pairs = (copy.match(/^\*\*Weak\*\*/gm) ?? []).length + (read('commands/convert/references/examples/signup-page-rewrite.md').match(/^\*\*Weak\*\*/gm) ?? []).length;
  assert.ok(pairs >= 6 && pairs <= 20, `${pairs} annotated pairs`);
  for (const heading of [/^## Leads$/m, /^## Hero sections$/m, /^## A short sales argument$/m]) assert.match(copy, heading);
  // Round 4: short-form copy has no examples.
  for (const heading of [/^## Headlines$/m, /^## Headline sets$/m, /^## Lead magnet pages$/m, /^## Consumer app pages$/m]) assert.doesNotMatch(copy, heading);
  assert.match(read('commands/convert/references/examples/signup-page-rewrite.md'), /^## Before/m);
  assert.match(read('commands/convert/references/examples/signup-page-rewrite.md'), /^## After/m);
});

test('the brief carries the craft within its budget', () => {
  for (const [task, path] of [
    ['Write landing page copy for our SaaS', 'skills/conquistador/commands/copy/references/sales-argument.md'],
    ['Rewrite this landing page to convert better', 'skills/conquistador/commands/copy/references/sales-argument.md'],
    ['Create a landing page for our SaaS', 'skills/conquistador/plays/landing/references/conversion/core-principles.md'],
    ['Improve conversion on our signup page', 'skills/conquistador/commands/convert/references/page-conversion-craft.md'],
  ]) {
    const pack = packBrief(createBrief(task, options));
    assert.ok(pack.structured.inlined.some(item => item.path === path), `${task}: ${JSON.stringify(pack.structured.inlined.map(item => item.path))}`);
    assert.ok(Buffer.byteLength(pack.text) <= pack.structured.budgetBytes, task);
  }
});

test('review leftovers are gone', () => {
  const evaluation = read('commands/convert/references/landing-eval-method.md');
  assert.doesNotMatch(evaluation, /counterpart to `convert`|lp-brief|\bbun\b|none of our skills/i);
  const copy = read('commands/copy/COMMAND.md');
  assert.doesNotMatch(copy, /sequence design routes to `outreach`/);
  assert.match(copy, /`lifecycle`/);
  assert.doesNotMatch(read('commands/copy/references/lifecycle-sequences.md'), /CP-03|WS8/);
  assert.doesNotMatch(read('commands/convert/COMMAND.md'), /`results`, `results`/);
  const headlines = read('commands/copy/references/headline-formulas.md');
  assert.ok((headlines.match(/^\| \*\*?[^|]+\|/gm) ?? []).length + (headlines.match(/^- \*\*/gm) ?? []).length >= 12, 'headline file needs real patterns');
});

test('ENTRY files stay short and point at the craft first', () => {
  // Copy has two modes; short-form links nothing, so the first link is the long-form sales argument.
  for (const [path, first] of [['commands/copy/ENTRY.md', ['references/sales-argument.md']],
    ['commands/convert/ENTRY.md', ['references/page-conversion-craft.md']]]) {
    const text = read(path);
    assert.ok(Buffer.byteLength(text) <= 1400, `${path} is ${Buffer.byteLength(text)} bytes`);
    assert.deepEqual(links(text).slice(0, first.length), first, path);
  }
});

test('drafting comes before the facts check', () => {
  for (const path of ['commands/copy/COMMAND.md', 'commands/convert/COMMAND.md', 'commands/copy/fallbacks/sequential.md']) {
    const text = read(path);
    const draft = text.search(/^#{2,3} .*\bDraft/m);
    const check = text.search(/^#{2,3} .*\bCheck/m);
    assert.ok(draft >= 0 && check > draft, `${path}: draft heading must precede check heading`);
  }
});

test('owned files have working relative links and no private storage paths', () => {
  for (const path of owned) {
    const text = read(path);
    assert.doesNotMatch(text, /CloudStorage|My Drive|GoogleDrive/, path);
    for (const [, target] of text.matchAll(/\]\(((?!https?:|#|mailto:)[^)\s]+)\)/g)) {
      const file = resolve(dirname(join(library, path)), decodeURIComponent(target.split('#')[0]));
      assert.ok(existsSync(file), `${path} -> ${target}`);
    }
  }
});

test('no 8-word run is shared with the private craft sources', { skip: !process.env.CONQUISTADOR_CRAFT_SOURCES && 'CONQUISTADOR_CRAFT_SOURCES is not set' }, () => {
  const sources = new Set();
  const collect = path => {
    if (statSync(path).isDirectory()) return readdirSync(path).forEach(name => collect(join(path, name)));
    if (!/\.(?:md|txt|vtt)$/.test(path)) return;
    let text = readFileSync(path, 'utf8');
    // Caption files: drop headers, cue numbers, timings, and inline tags so runs cross cue breaks.
    if (path.endsWith('.vtt')) text = text.split('\n').filter(line => !/^(?:WEBVTT|Kind:|Language:|NOTE\b|\d+$)|-->/.test(line.trim())).join(' ').replace(/<[^>]+>/g, ' ');
    const list = words(text);
    for (let at = 0; at + 8 <= list.length; at++) sources.add(list.slice(at, at + 8).join(' '));
  };
  for (const folder of process.env.CONQUISTADOR_CRAFT_SOURCES.split(':')) collect(folder);
  for (const path of craft) {
    const list = words(read(path));
    const shared = [];
    for (let at = 0; at + 8 <= list.length; at++) if (sources.has(list.slice(at, at + 8).join(' '))) shared.push(at);
    assert.equal(shared.length, 0, `${path} shares ${shared.length} 8-word runs with a private source`);
  }
});

// Round 3: short-form and long-form modes. Round 4: short-form is a pass-through.
const SHORT_TASKS = ['Write a headline for our product page', 'Write five headline options for our product page',
  'Write a lead magnet landing page for our free template', 'Write the hero headline, subheadline, and bullets for our app landing page',
  'Write a tagline for our app'];
const LONG_TASKS = ['Write landing page copy for our SaaS', 'Rewrite this landing page to convert better',
  'Write the sales page for our course', 'Write five headline options and the sales page for our course'];
const ENTRY = 'skills/conquistador/commands/copy/ENTRY.md';
const paragraph = (text, start) => {
  const at = text.indexOf(start);
  if (at < 0) return '';
  const end = text.indexOf('\n\n', at);
  return text.slice(at, end < 0 ? undefined : end);
};
const section = (text, heading) => {
  const at = text.search(new RegExp(`^## ${heading}`, 'm'));
  if (at < 0) return '';
  const rest = text.slice(at + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
};
const links = text => [...text.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
// Drafting rules, patterns, examples, and review roles that a short-form brief or mode must not carry.
const RULES = [
  /want,\s+pain,\s+or\s+identity/i, /one\s+proof/i, /one\s+mechanism/i, /benefits?\b/i, /most concrete specific/i,
  /\bnumber in the headline/i, /label,?\s+then/i, /offer terms/i, /social proof/i, /\bangles?\b/i, /\bbullets? (?:that|should|must)/i,
  /cut adjectives/i, /\bpatterns?\b/i, /\*\*(?:Strong|Weak)\*\*/, /^>/m, /\bhook\b|\bvoice pass|\bpsychology\b|zero-risk|\bcritic\b/i,
  /competitor-swap/i, /\bpromise\b/i, /\bawareness\b/i,
];
const FACTS_CHECK = [/remove claims the facts do not support/i, /keep fair inferences/i, /add nothing/i,
  /no\s+hedges/i, /no\s+source\s+text/i, /no\s+disclaimers/i];
// The facts check must not add text to the copy or after it.
const ADDS = /operator\s+note|qualifier|footnote|\badd (?:a|an|the|one)\b|\binclude (?:a|an|the)\b|\bcite\b/i;
// Every copy file except ENTRY, as 8-word runs, so a short-form brief cannot carry their text.
const copyFiles = walk('commands/copy').filter(path => path !== 'commands/copy/ENTRY.md' && /\.(?:md|yaml)$/.test(path));
const runs = text => {
  const list = words(text);
  const found = new Set();
  for (let at = 0; at + 8 <= list.length; at++) found.add(list.slice(at, at + 8).join(' '));
  return found;
};

test('every strong example is long-form', () => {
  for (const block of strongBlocks()) assert.equal(block.form, 'long', `${block.where} needs form: long; short-form copy has no examples`);
});

test('short-form briefs carry the copy entry and nothing else', () => {
  const entry = read('commands/copy/ENTRY.md');
  const fileRuns = new Map(copyFiles.map(path => [path, runs(read(path))]));
  for (const task of SHORT_TASKS) {
    const pack = packBrief(createBrief(task, options));
    assert.equal(pack.structured.command, 'copy', `${task} routes to copy`);
    assert.deepEqual(pack.structured.inlined.map(item => item.path), [ENTRY], task);
    assert.deepEqual(pack.structured.situational, [], `${task} lists deferred files`);
    // The packed text is the brief header plus ENTRY: no copy file's text, rule, pattern, example, or role.
    const text = pack.text;
    const own = runs(text);
    for (const [path, found] of fileRuns) {
      const shared = [...found].filter(run => own.has(run) && !runs(entry).has(run));
      assert.deepEqual(shared, [], `${task} carries text from ${path}`);
    }
    for (const rule of RULES) assert.doesNotMatch(text, rule, `${task} brief carries ${rule}`);
    assert.match(text, /approval/i, `${task} brief keeps the approval boundary`);
    assert.match(text, /\bpublish/i, task);
  }
});

test('the short-form mode links nothing and names no drafting rule', () => {
  const entry = read('commands/copy/ENTRY.md');
  const short = paragraph(entry, '**Short-form**');
  assert.ok(short, 'ENTRY names the short-form mode');
  assert.deepEqual(links(short), [], 'the short-form mode loads no file');
  assert.match(short, /own judgment/i);
  assert.match(short, /user's facts/i);
  for (const rule of RULES) assert.doesNotMatch(entry, rule, `ENTRY carries ${rule}`);
  const command = section(read('commands/copy/COMMAND.md'), 'Short-form mode');
  assert.ok(command, 'COMMAND.md has a short-form mode section');
  assert.deepEqual(links(command), [], 'COMMAND short-form links nothing');
  assert.doesNotMatch(command, /`?references\/|agents\/|fallbacks\//, 'COMMAND short-form names no file');
  assert.match(command, /own judgment/i);
  for (const rule of RULES) assert.doesNotMatch(command, rule, `COMMAND short-form carries ${rule}`);
  const specialist = paragraph(read('specialists/copy-agent.md'), 'Headlines, heroes');
  assert.ok(specialist, 'the copy specialist names the short-form mode');
  assert.match(specialist, /own judgment/i);
  for (const target of links(specialist)) assert.match(target, /copy\/ENTRY\.md$/, `copy specialist short-form links ${target}`);
});

test('the short-form facts check removes and adds nothing', () => {
  const short = paragraph(read('commands/copy/ENTRY.md'), '**Short-form**');
  const command = section(read('commands/copy/COMMAND.md'), 'Short-form mode');
  for (const [where, text] of [['ENTRY', short], ['COMMAND', command]]) {
    for (const rule of FACTS_CHECK) assert.match(text, rule, `${where} short-form facts check misses ${rule}`);
    assert.doesNotMatch(text, ADDS, `${where} short-form facts check adds text`);
  }
});

test('the short-form checklist and short-form examples are retired', () => {
  assert.ok(!existsSync(join(library, SHORT)), `${SHORT} still exists`);
  for (const path of owned) assert.doesNotMatch(read(path), /short-form-copy\.md|short-form checklist/i, path);
  const guide = read('commands/copy/references/lead-magnet-stack.md');
  assert.doesNotMatch(guide, /\*\*(?:Headline|Subhead|Bullets?|Button):\*\*/, 'lead magnet guide drafts the page');
  for (const rule of RULES) assert.doesNotMatch(guide, rule, `lead magnet guide carries ${rule}`);
  assert.match(guide, /own judgment/i);
  for (const target of links(guide)) assert.match(target, /ENTRY\.md$/, `lead magnet guide links ${target}`);
});

// Long-form files at fa868a5 (round 3). A change here needs its own blind test first.
// Round 4 changed only the short-form link in sales-argument, long-form-library, headline-formulas, and sequential.
const LONG_FILES = {
  'commands/copy/references/sales-argument.md': '4c91b0baf343f4a4',
  'commands/copy/references/long-form-library.md': 'f1003c270ab42367',
  'commands/copy/references/headline-formulas.md': 'b7a02a65efe64a3c',
  'commands/copy/references/copy-review.md': 'cd69833a15e23077',
  'commands/copy/references/anti-patterns.md': 'aeb4d1e095bdef88',
  'commands/copy/references/belief-disruption.md': 'c73addbaed10cb3a',
  'commands/copy/references/discovery-story.md': '8a24406b99f5f480',
  'commands/copy/references/emotional-triggers.md': '11e8e2605bcc752b',
  'commands/copy/references/format-conventions.md': '1a0e3e124c12a6f9',
  'commands/copy/references/lifecycle-sequences.md': '62e3142190511029',
  'commands/copy/references/research-workflow.md': '29ca965976bd0a02',
  'commands/copy/agents/body-agent.md': 'e8b099c49cc5f73d',
  'commands/copy/agents/critic-agent.md': 'd0692d14b2ae99eb',
  'commands/copy/agents/cta-agent.md': '85998342b65dbb9e',
  'commands/copy/agents/hook-agent.md': '5d37b1af0aa45e3c',
  'commands/copy/agents/openai.yaml': '3a41d950b5820a1c',
  'commands/copy/agents/psychology-agent.md': '7e467920b5665868',
  'commands/copy/agents/social-proof-agent.md': 'e04be05c8844a730',
  'commands/copy/agents/variant-agent.md': 'fa0a4ab44792b0c1',
  'commands/copy/agents/voice-agent.md': 'fbcadfb8f7526d7e',
  'commands/copy/agents/zero-risk-agent.md': '11bfc849bedf0fce',
  'commands/copy/fallbacks/sequential.md': 'b10b6b2456bb16d4',
};
const LONG_SECTIONS = {
  'Anchor long-form work': 'c278bfca3b4c7c54',
  'Draft long-form copy from the craft': '6495d4f5654e04a0',
  'Check long-form copy after drafting': '585b1f6c05f806a5',
};
const LONG_UNITS = { 5: '6210ce21ab5c68f5', 6: '5d30dc534cfee9b3', 7: '294032aad10f8ce9', 8: '677bec632e4e0738', 10: '77c8dc8acc1ba7ba', 15: '81f40811eb2883f4' };
const LONG_PRODUCTS = { Rotawell: '5b5284f5b199b7f8', Auditrail: 'b235796872bb999f', 'Weeknight Kitchen': '2739f045b301e48a', 'Stride Nine': 'f449344123ef1494' };

test('long-form files, sections, and examples are unchanged', () => {
  for (const [path, digest] of Object.entries(LONG_FILES)) assert.equal(hash(read(path)), digest, `${path} changed`);
  const command = read('commands/copy/COMMAND.md');
  for (const [title, digest] of Object.entries(LONG_SECTIONS)) {
    const part = command.split(/^(?=## )/m).find(item => item.startsWith(`## ${title}\n`));
    assert.ok(part, `COMMAND lost ## ${title}`);
    assert.equal(hash(part.trimEnd()), digest, `COMMAND ## ${title} changed`);
  }
  const copy = read('commands/copy/references/examples/direct-response-examples.md');
  const units = copy.split(/^(?=### |## )/m).filter(item => item.startsWith('### '));
  for (const [number, digest] of Object.entries(LONG_UNITS)) {
    const unit = units.find(item => item.startsWith(`### ${number}. `));
    assert.ok(unit, `long-form example ${number} is missing`);
    assert.equal(hash(unit.trimEnd()), digest, `long-form example ${number} changed`);
  }
  const bullets = new Map();
  let name = null;
  for (const line of copy.split('\n')) {
    const start = line.match(/^- \*\*([^:*]+):\*\*/);
    if (start) { name = start[1].trim(); bullets.set(name, line); continue; }
    if (name && /^\s{2,}\S/.test(line)) bullets.set(name, `${bullets.get(name)}\n${line}`);
    else name = null;
  }
  assert.deepEqual([...bullets.keys()].sort(), Object.keys(LONG_PRODUCTS).sort(), 'only long-form products remain');
  for (const [product, digest] of Object.entries(LONG_PRODUCTS)) assert.equal(hash(bullets.get(product)), digest, `${product} facts changed`);
});

test('long-form requests keep the current method', () => {
  const entry = read('commands/copy/ENTRY.md');
  const longLine = entry.slice(entry.indexOf('**Long-form**'));
  for (const target of ['references/sales-argument.md', 'references/headline-formulas.md', 'references/examples/direct-response-examples.md',
    'references/copy-review.md', 'COMMAND.md']) assert.ok(links(longLine).includes(target), `ENTRY long-form misses ${target}`);
  assert.match(longLine, /operator\s+note/i);
  assert.match(longLine, /sourced numbers exact/i);
  const command = read('commands/copy/COMMAND.md');
  for (const role of ['hook', 'body', 'cta', 'social-proof', 'variant', 'voice', 'psychology', 'zero-risk', 'critic']) {
    assert.match(command, new RegExp(`\\(agents/${role}-agent\\.md\\)`), `COMMAND long-form lost the ${role} role`);
  }
  for (const rule of [/Draft 5–10 headlines/, /competitor-swap test/, /copy review/, /sequential fallback/]) assert.match(command, rule);
  assert.match(section(command, 'Deliver'), /operator note/i, 'long-form delivery keeps the operator note');
  for (const pass of ['hook, body, CTA, and social proof', 'voice, psychology, zero-risk, and critic']) assert.match(read('commands/copy/fallbacks/sequential.md'), new RegExp(pass));
  for (const task of LONG_TASKS) {
    const pack = packBrief(createBrief(task, options));
    assert.equal(pack.structured.command, 'copy', `${task} routes to copy`);
    const inlined = pack.structured.inlined.map(item => item.path);
    assert.ok(inlined.includes('skills/conquistador/commands/copy/references/sales-argument.md'), `${task}: ${JSON.stringify(inlined)}`);
    assert.ok(inlined.length >= 2, `${task} carries the craft, not ENTRY alone`);
  }
  const long = strongBlocks().filter(block => block.form === 'long').map(block => block.section);
  for (const name of ['Leads', 'Hero sections', 'A short sales argument']) assert.ok(long.includes(name), `no long-form example under ${name}`);
});

test('short-form briefs are smaller than long-form briefs', () => {
  const size = task => Buffer.byteLength(packBrief(createBrief(task, options)).text);
  const smallestLong = Math.min(...LONG_TASKS.map(size));
  for (const task of SHORT_TASKS) assert.ok(size(task) < smallestLong, `${task}: ${size(task)} bytes, long-form ${smallestLong}`);
});
