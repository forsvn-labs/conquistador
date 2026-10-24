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

const words = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const grams = (text, max = 4) => {
  const list = words(text);
  const found = new Set();
  for (let size = 1; size <= max; size++) for (let at = 0; at + size <= list.length; at++) found.add(list.slice(at, at + size).join(' '));
  return found;
};
const hits = (text, hashes) => [...grams(text)].filter(gram => hashes.has(hash(gram)));

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

test('sourced specifics stay specific: the rule is in the craft, the check, and the brief', () => {
  const rule = /keep (?:the|a) sourced (?:number|specific)[^\n]*exact/i;
  for (const path of ['commands/copy/references/sales-argument.md', 'commands/copy/references/copy-review.md',
    'plays/landing/references/conversion/core-principles.md']) assert.match(read(path), rule, path);
  assert.doesNotMatch(read('commands/copy/references/copy-review.md'), /generali[sz]e (?:the|a) (?:number|result)|replace (?:the|a) number with/i);
  const pack = packBrief(createBrief('Write landing page copy for our SaaS', options));
  assert.match(pack.text, rule);
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
  let checked = 0;
  for (const path of [...examples, 'commands/copy/references/headline-formulas.md']) {
    const lines = read(path).split('\n');
    lines.forEach((line, index) => {
      const label = line.match(/^\*\*Strong\*\*.*\(check: ([a-z-]+)\)/);
      if (!label) return;
      const block = [];
      for (let at = index + 1; at < lines.length; at++) {
        if (lines[at].startsWith('>')) block.push(lines[at].replace(/^>\s?/, ''));
        else if (block.length || lines[at].trim()) break;
      }
      assert.ok(block.length, `${path}:${index + 1} strong label without a quoted block`);
      const findings = checkText(block.join('\n'), { channel: label[1], file: `${path}:${index + 1}.md` }).filter(counted);
      assert.deepEqual(findings.map(item => `${item.rule}: ${item.snippet}`), [], `${path}:${index + 1}`);
      checked++;
    });
  }
  assert.ok(checked >= 10, `only ${checked} strong examples are machine-checked`);
});

test('example set covers headlines, leads, heroes, a sales argument, and a before/after rewrite', () => {
  const copy = read('commands/copy/references/examples/direct-response-examples.md');
  const pairs = (copy.match(/^\*\*Weak\*\*/gm) ?? []).length + (read('commands/convert/references/examples/signup-page-rewrite.md').match(/^\*\*Weak\*\*/gm) ?? []).length;
  assert.ok(pairs >= 10 && pairs <= 20, `${pairs} annotated pairs`);
  for (const heading of [/^## Headlines/m, /^## Leads/m, /^## Hero sections/m, /^## A short sales argument/m]) assert.match(copy, heading);
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
