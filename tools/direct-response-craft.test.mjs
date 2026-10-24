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
// 18. the example set missing hero sections, headline sets, lead magnet pages, or consumer app pages.
// Round 3 (the method won long-form work and lost short-form work across 16 blind pairs; the owner split copy by length):
// 19. a short-form request loading the long-form review roles or long-form files (brief, ENTRY, checklist, COMMAND);
// 20. a short-form strong example missing offer terms that its product facts include;
// 21. a headline set whose options share one angle;
// 22. a short-form strong example with no concrete specific in the headline when its facts include one,
//     or with a number in the headline that its facts do not contain;
// 23. a short-form strong example dropping the social proof its facts include;
// 24. long-form requests losing their current method (sales argument, roles, review, examples);
// 25. the short-form checklist missing one of its rules, or growing past its size budget;
// 26. a short-form brief no smaller than the long-form brief.
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
  'commands/copy/references/page-sections.md', 'commands/copy/references/lifecycle-sequences.md',
  'commands/copy/references/examples/direct-response-examples.md',
  'commands/copy/references/short-form-copy.md',
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
const SHORT = 'commands/copy/references/short-form-copy.md';
// Files whose invented products carry a facts bullet ("- **Name:** …").
const rosterFiles = [...examples, SHORT];

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
const strongFiles = [...examples, 'commands/copy/references/headline-formulas.md', SHORT];
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
  for (const path of ['commands/copy/ENTRY.md', 'commands/copy/references/sales-argument.md', 'commands/copy/references/headline-formulas.md',
    'commands/copy/agents/hook-agent.md', 'commands/convert/references/page-conversion-craft.md', 'plays/landing/references/conversion/core-principles.md']) {
    assert.match(read(path), reader, path);
  }
  for (const path of ['commands/copy/ENTRY.md', 'commands/copy/references/sales-argument.md', 'commands/copy/agents/hook-agent.md',
    'commands/copy/fallbacks/sequential.md']) assert.match(read(path), select, path);
  for (const path of ['commands/copy/references/copy-review.md', 'commands/copy/COMMAND.md', 'commands/copy/fallbacks/sequential.md',
    'commands/copy/agents/voice-agent.md', 'commands/copy/agents/psychology-agent.md', 'commands/copy/agents/zero-risk-agent.md',
    'commands/copy/agents/critic-agent.md', 'commands/copy/agents/cta-agent.md', 'commands/copy/agents/hook-agent.md',
    'plays/landing/references/conversion-principles.md']) assert.match(read(path), noHedge, path);
  for (const path of ['commands/copy/references/copy-review.md', 'commands/copy/agents/critic-agent.md',
    'commands/copy/agents/psychology-agent.md', 'commands/copy/fallbacks/sequential.md']) assert.match(read(path), /fair\s+inference/i, path);
  for (const task of ['Write landing page copy for our SaaS', 'Write a headline for our product page']) {
    const pack = packBrief(createBrief(task, options));
    for (const pattern of [reader, select, /operator\s+note/i]) assert.match(pack.text, pattern, task);
  }
});

test('approval boundaries remain in every entry', () => {
  for (const path of ['commands/copy/COMMAND.md', 'commands/copy/fallbacks/sequential.md', 'commands/convert/COMMAND.md',
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
  assert.ok(blocks.length >= 14, `only ${blocks.length} strong examples are machine-checked`);
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
  assert.ok(audiences.length >= 6, 'each invented product names its audience in the roster');
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
  assert.ok(products.length >= 8 && customers.length >= 3, 'roster names products and customers');
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

test('example set covers headlines, leads, heroes, a sales argument, and a before/after rewrite', () => {
  const copy = read('commands/copy/references/examples/direct-response-examples.md');
  const pairs = (copy.match(/^\*\*Weak\*\*/gm) ?? []).length + (read('commands/convert/references/examples/signup-page-rewrite.md').match(/^\*\*Weak\*\*/gm) ?? []).length;
  assert.ok(pairs >= 10 && pairs <= 20, `${pairs} annotated pairs`);
  for (const heading of [/^## Headlines$/m, /^## Headline sets$/m, /^## Leads$/m, /^## Hero sections$/m, /^## Lead magnet pages$/m,
    /^## Consumer app pages$/m, /^## A short sales argument$/m]) assert.match(copy, heading);
  assert.match(read('commands/convert/references/examples/signup-page-rewrite.md'), /^## Before/m);
  assert.match(read('commands/convert/references/examples/signup-page-rewrite.md'), /^## After/m);
});

test('the brief carries the craft within its budget', () => {
  for (const [task, path] of [
    ['Write landing page copy for our SaaS', 'skills/conquistador/commands/copy/references/sales-argument.md'],
    ['Rewrite this landing page to convert better', 'skills/conquistador/commands/copy/references/sales-argument.md'],
    ['Write a headline for our product page', 'skills/conquistador/commands/copy/references/headline-formulas.md'],
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
  for (const [path, first] of [['commands/copy/ENTRY.md', 'references/sales-argument.md'], ['commands/convert/ENTRY.md', 'references/page-conversion-craft.md']]) {
    const text = read(path);
    assert.ok(Buffer.byteLength(text) <= 1400, `${path} is ${Buffer.byteLength(text)} bytes`);
    assert.equal(text.match(/\]\(([^)]+)\)/)?.[1], first, path);
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

// Round 3: short-form and long-form modes.
const SHORT_TASKS = ['Write a headline for our product page', 'Write five headline options for our product page',
  'Write a lead magnet landing page for our free template', 'Write the hero headline, subheadline, and bullets for our app landing page'];
const LONG_TASKS = ['Write landing page copy for our SaaS', 'Rewrite this landing page to convert better'];
const LONG_FILES = /\/agents\/|\/fallbacks\/|references\/(?:sales-argument|copy-review|page-sections)\.md$|examples\/direct-response-examples\.md$/;
const ANGLES = new Set(['outcome', 'pain', 'proof', 'objection', 'identity']);
// A concrete specific: a number, a price, a spelled number, or a named day or time.
const SPECIFIC = /\d|\$|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|once|twice|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weeknight|tonight|morning|evening|sunrise|a\.m\.|p\.m\.)\b/i;
const numbers = text => (text.match(/\d[\d,.]*\d|\d/g) ?? []).map(value => value.replace(/,/g, '').replace(/\.$/, ''));
// Each invented product's facts bullet, keyed by name.
const productFacts = () => {
  const facts = new Map();
  for (const path of rosterFiles) {
    let name = null;
    for (const line of read(path).split('\n')) {
      const start = line.match(/^- \*\*([^:*]+):\*\*/);
      if (start) { name = start[1].trim(); facts.set(name, line); continue; }
      if (name && /^\s{2,}\S/.test(line)) facts.set(name, `${facts.get(name)} ${line.trim()}`);
      else name = null;
    }
  }
  return facts;
};
const offerTerms = facts => [...(facts.match(/Offer terms: ([^\n]*?)(?:\.\s|\.$|$)/)?.[1] ?? '').matchAll(/`([^`]+)`/g)].map(match => match[1]);
const shortBlocks = () => strongBlocks().filter(block => block.form === 'short');
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

test('every strong example names its mode, and the checklist examples are short-form', () => {
  const blocks = strongBlocks();
  for (const block of blocks) assert.ok(['short', 'long'].includes(block.form), `${block.where} needs form: short or form: long`);
  const short = blocks.filter(block => block.path === SHORT);
  assert.ok(short.length >= 1 && short.length <= 2, `the short-form checklist carries one or two examples, not ${short.length}`);
  for (const block of short) assert.equal(block.form, 'short', block.where);
  for (const block of blocks.filter(block => block.form === 'short' && block.section !== 'Headlines')) {
    assert.ok(block.product && productFacts().has(block.product), `${block.where} must name a product from the roster (product: …)`);
  }
});

test('short-form requests load the short-form checklist, not the long-form roles or files', () => {
  const entry = read('commands/copy/ENTRY.md');
  const shortLine = paragraph(entry, '**Short-form**');
  assert.ok(shortLine, 'ENTRY names the short-form mode');
  assert.deepEqual(links(shortLine), ['references/short-form-copy.md'], 'the short-form mode loads only the checklist');
  assert.match(shortLine, /one pass/i);
  assert.match(shortLine, /(?:do not|don't|never) (?:load|run|use) the review roles/i);
  const checklist = read(SHORT);
  for (const target of links(checklist)) assert.doesNotMatch(target, /agents\/|fallbacks\/|sales-argument|copy-review|page-sections|direct-response-examples/, `${SHORT} links ${target}`);
  const command = section(read('commands/copy/COMMAND.md'), 'Short-form');
  assert.ok(command, 'COMMAND.md has a short-form section');
  assert.match(command, /one pass/i);
  for (const target of links(command)) assert.doesNotMatch(target, /agents\/|fallbacks\/|sales-argument|page-sections/, `COMMAND short-form links ${target}`);
  for (const task of SHORT_TASKS) {
    const pack = packBrief(createBrief(task, options));
    const inlined = pack.structured.inlined.map(item => item.path);
    assert.ok(inlined.includes(`skills/conquistador/${SHORT}`), `${task}: ${JSON.stringify(inlined)}`);
    for (const path of inlined) assert.doesNotMatch(path, LONG_FILES, `${task} inlines long-form ${path}`);
  }
});

test('long-form requests keep the current method', () => {
  const entry = read('commands/copy/ENTRY.md');
  const longLine = entry.slice(entry.indexOf('**Long-form**'));
  for (const target of ['references/sales-argument.md', 'references/headline-formulas.md', 'references/examples/direct-response-examples.md',
    'references/copy-review.md', 'COMMAND.md']) assert.ok(links(longLine).includes(target), `ENTRY long-form misses ${target}`);
  const command = read('commands/copy/COMMAND.md');
  for (const role of ['hook', 'body', 'cta', 'social-proof', 'variant', 'voice', 'psychology', 'zero-risk', 'critic']) {
    assert.match(command, new RegExp(`\\(agents/${role}-agent\\.md\\)`), `COMMAND long-form lost the ${role} role`);
  }
  for (const rule of [/Draft 5–10 headlines/, /competitor-swap test/, /copy review/, /sequential fallback/]) assert.match(command, rule);
  for (const pass of ['hook, body, CTA, and social proof', 'voice, psychology, zero-risk, and critic']) assert.match(read('commands/copy/fallbacks/sequential.md'), new RegExp(pass));
  for (const task of LONG_TASKS) {
    const inlined = packBrief(createBrief(task, options)).structured.inlined.map(item => item.path);
    assert.ok(inlined.includes('skills/conquistador/commands/copy/references/sales-argument.md'), `${task}: ${JSON.stringify(inlined)}`);
    assert.ok(!inlined.includes(`skills/conquistador/${SHORT}`), `${task} inlines the short-form checklist`);
  }
  const long = strongBlocks().filter(block => block.form === 'long').map(block => block.section);
  for (const name of ['Leads', 'Hero sections', 'A short sales argument']) assert.ok(long.includes(name), `no long-form example under ${name}`);
});

test('short-form briefs are smaller than long-form briefs', () => {
  const size = task => Buffer.byteLength(packBrief(createBrief(task, options)).text);
  const smallestLong = Math.min(...LONG_TASKS.map(size));
  for (const task of SHORT_TASKS) assert.ok(size(task) < smallestLong, `${task}: ${size(task)} bytes, long-form ${smallestLong}`);
});

test('the short-form checklist carries every rule and stays small', () => {
  const text = read(SHORT);
  assert.ok(Buffer.byteLength(text) <= 4000, `${SHORT} is ${Buffer.byteLength(text)} bytes`);
  for (const rule of [
    /most concrete specific[\s\S]{0,40}headline/i,
    /label,?\s+then\s+the\s+benefit/i,
    /offer terms/i, /\bprice\b/i, /\btrial\b/i, /\bfree\b/i, /waitlist/i,
    /one piece of social proof/i,
    /outcome,\s+pain,\s+proof,\s+objection,\s+(?:or\s+|and\s+)?identity/i,
    /cut adjectives,\s+not facts/i,
    /want,\s+pain,\s+or\s+identity/i,
    /(?:do\s+not|never)\s+add\s+disclaimers,\s+hedges,\s+or\s+source\s+text/i,
    /fair\s+inference/i,
    /operator\s+note/i,
  ]) assert.match(text, rule, `${SHORT} misses ${rule}`);
  assert.match(text, /invented/i);
});

test('short-form strong examples keep the offer terms their facts include', () => {
  const facts = productFacts();
  for (const block of shortBlocks().filter(block => block.section !== 'Headlines')) {
    const terms = offerTerms(facts.get(block.product) ?? '');
    assert.ok(terms.length, `${block.product} facts need an "Offer terms:" list`);
    for (const term of terms) assert.ok(block.text.toLowerCase().includes(term.toLowerCase()), `${block.where} drops the offer term "${term}"`);
  }
});

test('short-form strong examples keep the social proof their facts include', () => {
  const facts = productFacts();
  for (const block of shortBlocks().filter(block => block.section !== 'Headlines')) {
    const rating = (facts.get(block.product) ?? '').match(/\b(\d\.\d) from ([\d,]+)/);
    if (rating) assert.ok(block.text.includes(rating[1]) && block.text.includes(rating[2]), `${block.where} drops the ${rating[0]} rating`);
  }
});

test('short-form headlines carry a concrete specific from the facts', () => {
  const facts = productFacts();
  for (const block of shortBlocks()) {
    const known = facts.get(block.product) ?? [...facts.values()].join(' ');
    const headlines = headlinesOf(block);
    if (/\d/.test(known)) {
      const specific = headlines.filter(headline => SPECIFIC.test(headline)).length;
      const needed = block.lead === 'set' ? 2 : 1;
      assert.ok(specific >= needed, `${block.where}: ${specific} of ${headlines.length} headlines carry a specific`);
    }
    if (!block.product) continue;
    const allowed = new Set(numbers(known));
    for (const headline of headlines) for (const value of numbers(headline)) assert.ok(allowed.has(value), `${block.where} headline number ${value} is not in the ${block.product} facts`);
  }
});

test('headline sets give each option a different angle', () => {
  const sets = strongBlocks().filter(block => block.lead === 'set');
  assert.ok(sets.length >= 2, 'at least two strong headline sets');
  for (const block of sets) {
    const headlines = headlinesOf(block);
    assert.equal(block.angles.length, headlines.length, `${block.where} names one angle per option (angles: …)`);
    for (const angle of block.angles) assert.ok(ANGLES.has(angle), `${block.where} angle ${angle}`);
    assert.equal(new Set(block.angles).size, block.angles.length, `${block.where} repeats an angle`);
    const openings = headlines.map(headline => words(headline).slice(0, 2).join(' '));
    assert.equal(new Set(openings).size, openings.length, `${block.where} options share an opening`);
  }
});
