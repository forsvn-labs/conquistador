// Copy is a pass-through, except a sales page or sales letter (copy, convert, landing play, three specialists).
// Across 32 blind pairs, copy written with any version of the copy method lost 9–22 to the same model with
// no method. The one consistent method win was sales page openings (4 of 5).
// Failure modes, listed and checked before the change:
//  1. a copy drafting brief (headline, hero, rewrite, page copy, app page, email) that inlines, lists, or
//     stages any copy file other than ENTRY;
//  2. a landing play brief that inlines or stages a copy file for work that is not a sales page;
//  3. copy declaring required resources, which an assignment loads for every copy task;
//  4. a drafting instruction (copy, convert, landing play, section spec, specialists) that links a retired
//     craft file or names a drafting rule, pattern, example, or review role;
//  5. a facts check that adds text (a hedge, source text, a disclaimer, a qualifier, a footnote, a citation);
//  6. a sales page or sales letter request that routes elsewhere or loses the long-form method;
//  7. the long-form method missing a rule it held when it won sales page openings;
//  8. a lost approval boundary;
//  9. a retired craft file still present, a link to one, or a broken link in the method library;
// 10. public method text that names a practitioner or course, or an example that uses a real company or
//     the blind-test fixture.
// Name lists are stored as hashes so this public file does not name the sources it excludes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief, packBrief } from './brief.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const library = join(root, 'skills/conquistador');
const options = { root, playbooks: [], persistCache: false, cwd: null };
const read = path => readFileSync(join(library, path), 'utf8');
const pack = task => packBrief(createBrief(task, options));
const COPY = 'skills/conquistador/commands/copy/';
const ENTRY = `${COPY}ENTRY.md`;
const SALES = `${COPY}references/sales-argument.md`;

const SOURCE_HASHES = new Set(["a29150eecce86908","223b44349b89e3e4","d9913641fc2bb97b","ceee9bfc428c0f2e","23287acf826eaa5a","e094e13212ef43ce","98c7630e6ec3cb96","9e298e7de7022755","f709f5bae0805a13","f2486dfd64f3a9a7","9b227aebb0b24a93","ae2160090ce50a78","dc0a38c56b31e9c9","7831c62966a8eae2","2425e64752d309fb","a929c5789c0b2460","4f20db50275b0bcf","fe6bd0a76dd27305","e4d2432c256397b6","7f79b0a841464ecf","3e90907fc3ad3c1a","227043cd3ea94f96","358326385f017ce6","f8d87c4dc6db5f20","177026aee3800186","65b87ef1994c9e9f","1a9c42d1d24de126","f4e9a8387c459a2a","11f622e911f1aa94","481e4fbedcbb0255","006e39f60f196420","72f7ba8007d52ef3","d5da674069f59968","c97708b4e7f8ee1d","de0856dbaf727bcb","de9b63333fd4e998","8a4f602da17403c8","05724e2c891973c5","04d28a763e267534","016668639aae48b1","127cf78dd078786a","980cc4ecf43fd3ba","6dcbac4eaa4198c5","6a5351f8d7e6fe47","d99a675bb427a24b","eebcd76c019d506b","46bb176559dff5ac","0239d49a3e49d346","6f5d6b31a9271804","5e49a87810083c5b","fdec438ea518f588","bd44633a85080588","7fb88f30a75127d0","ca56f5429c3590b2","b10fcc4c629671b7","ca4d0cc5d08065da","f55898f0494c8616","4cd72718e6b1ccfa","72b14c2b1128cc5d","3278ba1a0bf234ca","d28d8c658f633660","a538d657dcc727c8","29cf64f73a654bec","4d94700f3a46ec44","8bd3cf322ab4b8e2"]);
const COMPANY_HASHES = new Set(["2bed2032ed3d8300","31f61ed3e6e210c5","50b7110eceb6157f","a638e70ffa28c67e","ea6f9c07a2f95c78","822b33ad87c148a0","91b6da07adf530f8","3ccbd9105a45d8fc","8a72266588ef612e","989cbe57e6200a17","4321dedb277b6216","c9d45754c8ed1d9e","70d991ae56206301","cc0acecd2fbde748","da944a0ab0fcef21","b0424e56be9a7ea9","7358bd4ec877e1b6","241c1e30ed886aa4","74c860f63661b29c","ab7d0a36ecbe10c2","9fbf261b62c1d7c0","75170593d559f227","c47b618e17c75f06","59e223bd8ec2ed14","d56d16d88324bdc4"]);
const FIXTURE_HASHES = new Set(["c1939260ea8f2d77","191c53b1529cf541","2a3b2bc4872c8308","76c4861efc135371"]);
const words = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const hits = (text, hashes) => {
  const list = words(text);
  const found = new Set();
  for (let size = 1; size <= 4; size++) for (let at = 0; at + size <= list.length; at++) found.add(list.slice(at, at + size).join(' '));
  return [...found].filter(gram => hashes.has(hash(gram)));
};
const walk = path => {
  const absolute = join(library, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute).sort().flatMap(name => walk(join(path, name)));
};
const links = text => [...text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)].map(match => match[1]);

// Copy requests that draft marketing copy. Each must carry the copy entry and nothing else.
const PASS_TASKS = ['Write five headline options for our product page', 'Rewrite this landing page to convert better',
  'Write landing page copy for our SaaS', 'Write the app store description for our habit tracker',
  'Write a welcome email for new trial users'];
const SALES_TASKS = ['Write the sales page for our course', 'Write a sales letter for our coaching program',
  'Write the headline and opening of our sales page'];
// The sales page method: the files it keeps.
const LONG_FORM = ['commands/copy/references/sales-argument.md', 'commands/copy/references/headline-formulas.md',
  'commands/copy/references/copy-review.md', 'commands/copy/references/examples/direct-response-examples.md'];
// Retired with the copy craft: roles, pattern lists, examples, references, and the fallback that ran the roles.
const RETIRED = ['agents/body-agent.md', 'agents/critic-agent.md', 'agents/cta-agent.md', 'agents/hook-agent.md',
  'agents/psychology-agent.md', 'agents/social-proof-agent.md', 'agents/variant-agent.md', 'agents/voice-agent.md',
  'agents/zero-risk-agent.md', 'fallbacks/sequential.md', 'references/anti-patterns.md', 'references/belief-disruption.md',
  'references/discovery-story.md', 'references/emotional-triggers.md', 'references/format-conventions.md',
  'references/lead-magnet-stack.md', 'references/long-form-library.md', 'references/page-sections.md',
  'references/research-workflow.md', 'references/examples/copywriting-walkthrough.md']
  .map(path => `commands/copy/${path}`).concat(['commands/convert/references/page-conversion-craft.md',
    'commands/convert/references/examples/signup-page-rewrite.md']);
// Every instruction that drafts marketing copy. Each must name the pass-through.
const DRAFTING = ['commands/copy/ENTRY.md', 'commands/copy/COMMAND.md', 'commands/convert/ENTRY.md',
  'commands/convert/COMMAND.md', 'commands/convert/fallbacks/sequential.md', 'plays/landing.md',
  'plays/landing/agents/section-spec-agent.md', 'specialists/copy-agent.md', 'specialists/dr-landing-agent.md',
  'specialists/saas-landing-agent.md'];
// The facts check, in the words every drafting instruction uses.
const FACTS_CHECK = [/own judgment/i, /user's facts/i, /remove (?:the )?claims the facts do not support/i,
  /keep fair inferences/i, /add nothing/i, /no\s+hedges/i, /no\s+source\s+text/i, /no\s+disclaimers/i];
// Text the facts check must not add to the copy.
const ADDS = /operator\s+note|qualifier|footnote|\badd (?:a|an|the|one)\b|\binclude (?:a|an|the)\b|\bcite\b|\bsource beside\b/i;
// Drafting rules, patterns, examples, and review roles. The pass-through names none of them.
const RULES = [/want,\s+pain,\s+or\s+identity/i, /one\s+proof/i, /one\s+mechanism/i, /\bbenefits?\b/i,
  /\bnumber in the headline/i, /offer terms/i, /social proof/i, /\bangles?\b/i, /\bpatterns?\b/i, /\*\*(?:Strong|Weak)\*\*/,
  /\bhook\b|\bvoice pass|\bpsychology\b|zero-risk|\bcritic\b/i, /competitor-swap/i, /\bpromise\b/i, /\bawareness\b/i];
const paragraph = (text, pattern) => {
  const at = text.search(pattern);
  if (at < 0) return '';
  const end = text.indexOf('\n\n', at);
  return text.slice(at, end < 0 ? undefined : end);
};
// The pass-through paragraph in a drafting instruction: the one that holds "own judgment".
const passage = path => paragraph(read(path), /[^\n]*own judgment/i);

test('copy drafting briefs carry the copy entry and nothing else', () => {
  for (const task of PASS_TASKS) {
    const { structured, text } = pack(task);
    assert.equal(structured.command, 'copy', `${task} routes to copy`);
    assert.deepEqual(structured.inlined.map(item => item.path), [ENTRY], task);
    assert.deepEqual(structured.situational, [], `${task} lists deferred files`);
    for (const rule of RULES) assert.doesNotMatch(text.replace(/\*\*Sales page or sales letter\*\*[^\n]*\n[^\n]*\n?/, ''), rule, `${task} brief carries ${rule}`);
    assert.match(text, /approval/i, `${task} keeps the approval boundary`);
  }
});

test('a landing play brief carries no copy file and stages none', () => {
  const brief = createBrief('Create a landing page for our SaaS', options);
  assert.equal(brief.play?.name ?? packBrief(brief).structured.play, 'landing');
  const { structured } = packBrief(brief);
  const listed = [...structured.inlined, ...structured.situational].map(item => item.path ?? item);
  assert.deepEqual(listed.filter(path => path.startsWith(COPY) && path !== ENTRY), [], JSON.stringify(listed));
  for (const step of brief.steps ?? []) {
    if (step.command === 'copy') assert.deepEqual(step.playbooks, [], 'the copy step stages no copy file');
  }
});

test('copy declares no required resources', () => {
  const overlay = JSON.parse(readFileSync(join(library, 'routing-overlay.json'), 'utf8'));
  assert.deepEqual(overlay.methods.copy.requiredResources, []);
  for (const item of overlay.methods.copy.conditionalResources) {
    if (LONG_FORM.includes(`commands/copy/${item.path}`)) assert.match(item.when, /sales page or sales letter/i, item.path);
  }
});

test('every drafting instruction is a pass-through with a facts check that adds nothing', () => {
  for (const path of DRAFTING) {
    const text = passage(path);
    assert.ok(text, `${path} names the pass-through`);
    for (const rule of FACTS_CHECK) assert.match(text, rule, `${path}: ${rule}`);
    assert.doesNotMatch(text, ADDS, `${path}: the facts check adds text`);
    for (const rule of RULES) assert.doesNotMatch(text, rule, `${path} pass-through carries ${rule}`);
    for (const target of links(text)) assert.match(target, /copy\/(?:ENTRY|COMMAND)\.md$|^COMMAND\.md$/, `${path} pass-through links ${target}`);
  }
});

test('drafting instructions reach the long-form method only for a sales page or sales letter', () => {
  for (const path of DRAFTING) {
    const text = read(path);
    for (const target of links(text).filter(target => /sales-argument|headline-formulas|copy-review|direct-response-examples/.test(target))) {
      const line = text.split('\n').find(line => line.includes(target));
      const near = text.slice(Math.max(0, text.indexOf(target) - 400), text.indexOf(target));
      assert.match(`${near}${line}`, /sales page or sales letter|sales page or a sales letter/i, `${path} links ${target} outside the sales page exception`);
    }
  }
});

test('sales page and sales letter requests keep the long-form method', () => {
  for (const task of SALES_TASKS) {
    const { structured } = pack(task);
    assert.equal(structured.command, 'copy', `${task} routes to copy`);
    const inlined = structured.inlined.map(item => item.path);
    assert.equal(inlined[0], ENTRY, task);
    assert.ok(inlined.includes(SALES), `${task}: ${JSON.stringify(inlined)}`);
  }
  for (const path of LONG_FORM) assert.ok(existsSync(join(library, path)), path);
  assert.match(read('commands/copy/ENTRY.md'), /sales page or sales letter[\s\S]{0,200}references\/sales-argument\.md/i);
});

test('the long-form method keeps every rule it held when it won sales page openings', () => {
  const sales = read('commands/copy/references/sales-argument.md');
  for (const rule of [/## Start from the reader/, /## Select before you write/, /## Argument order/, /\*\*Lead:\*\*/,
    /\*\*Cause:\*\*/, /\*\*Mechanism:\*\*/, /\*\*Offer:\*\*/, /\*\*Close:\*\*/, /## Promise and outcome/, /## Mechanism/,
    /## Awareness sets the lead/, /## Benefits, bullets, and rhythm/, /## Offer/, /## Proof/, /### Keep a sourced number exact/,
    /## Write with conviction/, /## Objections and calls to action/, /## Operator note/, /fair to write/i,
    /[Cc]hoosing testimonials|named person, a before-and-after/]) assert.match(sales, rule, `sales argument: ${rule}`);
  const headlines = read('commands/copy/references/headline-formulas.md');
  assert.ok((headlines.match(/^\| \*\*/gm) ?? []).length >= 13, 'headline patterns table');
  assert.match(headlines, /## Test each headline/);
  const command = read('commands/copy/COMMAND.md');
  for (const step of [/one-sentence promise and the two mechanism lines/i, /5–10 headlines/, /argument order/i,
    /offer and the call to action/i, /competitor-swap/i, /first screen alone/i, /copy review/i]) assert.match(command, step, `COMMAND: ${step}`);
  const examples = read('commands/copy/references/examples/direct-response-examples.md');
  for (const section of ['## Leads', '## A short sales argument']) assert.ok(examples.includes(section), section);
  assert.match(examples, /invented/i);
});

test('approval boundaries stay in every drafting instruction and the long-form method', () => {
  // The section spec drafts inside the landing play, which holds the play's approval boundary.
  for (const path of [...DRAFTING.filter(path => !path.includes('section-spec')), 'commands/copy/references/sales-argument.md']) {
    assert.match(read(path), /approv/i, `${path} keeps the approval boundary`);
  }
  assert.match(read('commands/copy/ENTRY.md'), /\bpublish/i);
});

test('retired craft files are gone and nothing links to them', () => {
  for (const path of RETIRED) assert.ok(!existsSync(join(library, path)), `${path} is retired`);
  const names = RETIRED.map(path => path.replace(/^commands\//, ''));
  for (const path of walk('.').filter(path => /\.(?:md|json)$/.test(path))) {
    const text = read(path);
    for (const target of links(text)) {
      const absolute = resolve(dirname(join(library, path)), target);
      if (!/^(?:https?:|mailto:)/.test(target)) assert.ok(existsSync(absolute), `${path} links missing ${target}`);
    }
    for (const name of names) assert.ok(!text.includes(name), `${path} names retired ${name}`);
  }
});

test('public method text names no practitioner and uses no real company or test fixture', () => {
  const owned = ['commands/copy', 'commands/convert', 'plays/landing', 'plays/landing.md', 'specialists/copy-agent.md',
    'specialists/dr-landing-agent.md', 'specialists/saas-landing-agent.md'].flatMap(walk).filter(path => path.endsWith('.md')
    && !path.endsWith('convert/references/hypothesis-framework.md'));
  for (const path of owned) {
    assert.deepEqual(hits(read(path), SOURCE_HASHES).map(hash), [], path);
    assert.deepEqual(hits(read(path), FIXTURE_HASHES).map(hash), [], path);
  }
  for (const path of LONG_FORM) assert.deepEqual(hits(read(path), COMPANY_HASHES).map(hash), [], path);
});

test('no 8-word run in the long-form method is shared with the private craft sources', { skip: !process.env.CONQUISTADOR_CRAFT_SOURCES && 'CONQUISTADOR_CRAFT_SOURCES is not set' }, () => {
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
  for (const path of [...LONG_FORM, 'commands/copy/ENTRY.md', 'commands/copy/COMMAND.md']) {
    const list = words(read(path));
    const shared = [];
    for (let at = 0; at + 8 <= list.length; at++) if (sources.has(list.slice(at, at + 8).join(' '))) shared.push(list.slice(at, at + 8).join(' '));
    assert.deepEqual(shared, [], path);
  }
});
