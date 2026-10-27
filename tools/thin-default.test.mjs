// Thin by default (owner decision, 27 Oct 2026). Across about 100 blind pairs, a draft written with a
// Conquistador method beat the same model alone only for outbound (8–0) and social (4–2). Copy, ads, and
// decision work (pricing, experiments, channels) lost or tied; the method drafts added process lines
// (an approval section, reversibility warnings) while the bare drafts executed the decision better.
// Every practice whose method text has not won a blind test is a pass-through: its brief carries its
// entry alone. The detailed files stay in the library, unlinked from the brief, so a later blind test
// can bring the craft back.
// Failure modes, listed and checked before the change:
//  1. an in-scope brief that carries more than the thin entry (a reference, a deferred file, a required
//     file, a staged play step, a later step that points at a detailed procedure);
//  2. an in-scope entry that links or names a detailed method file for an ordinary request;
//  3. a kept-craft practice (outreach and the outbound play, social and its seven channels, copy's sales
//     page and sales letter) that loses its craft;
//  4. an unchanged practice (engineering, platform utilities, factcheck, vietnamese, the spec play) that
//     changes;
//  5. a lost facts check, approval boundary, or dated platform fact;
//  6. an entry, play, or parent instruction that adds process sections to the deliverable (an approval
//     section, a readiness label, evidence labels, gates, rubric scores, reversibility warnings);
//  7. routing that changes a primary method, including the two known ads misroutes;
//  8. a thin brief larger than its budget;
//  9. a broken link in a changed file;
// 10. a practice that loses its entry, or a detailed file that is deleted instead of kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief, formatReadingList, packBrief } from './brief.mjs';
import { loadCases } from './e2e/routing-breadth.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const library = join(root, 'skills/conquistador');
const options = { root, playbooks: [], persistCache: false, cwd: null };
const read = path => readFileSync(join(library, path), 'utf8');
const brief = task => createBrief(task, { ...options, force: true });
const entryOf = name => `skills/conquistador/commands/${name}/ENTRY.md`;

// The scope, stated here and not read from the code under test.
const THIN_COMMANDS = ['article', 'audit', 'brand', 'budget', 'campaign', 'channels', 'convert', 'creative', 'critique',
  'decide', 'diagnose', 'event', 'flow', 'funnel', 'ideas', 'measure', 'position', 'pricing', 'prioritize', 'results',
  'seo', 'shape', 'video', 'watch'];
// Already pass-through before this change: all ad drafting and all copy except a sales page or letter.
// The ads campaign test (structure, budget, decision and kill rules) joins them: it never won a blind test.
const PASS_THROUGH = ['ads', 'copy'];
const CRAFT_COMMANDS = ['outreach', 'social'];
const UNCHANGED_COMMANDS = ['architect', 'build', 'docs', 'ui', 'init', 'doctor', 'pin', 'connect', 'review', 'feedback',
  'check', 'factcheck', 'vietnamese'];
const THIN_PLAYS = ['answers', 'appstore', 'content', 'expand', 'experiment', 'gtm', 'interactive', 'landing', 'launch',
  'lifecycle', 'paid', 'plan', 'press', 'pseo', 'qa', 'referral', 'report', 'series', 'trailer'];
const KEPT_PLAYS = ['outbound', 'spec'];
const THIN_CHANNELS = ['tiktok', 'youtube'];
const CRAFT_CHANNELS = ['email-newsletter', 'x', 'linkedin', 'reddit', 'hacker-news', 'product-hunt', 'facebook', 'instagram'];
const THIN_FORMATS = ['founder-demo', 'motion-background', 'ugc'];
const THIN_SPECIALISTS = ['campaign-data-agent', 'creative-assets-agent', 'data-diagnosis-agent'];
const PASS_SPECIALISTS = ['ads-agent', 'copy-agent', 'dr-landing-agent', 'saas-landing-agent'];
const SALES_PAGE = /\bsales (?:pages?|letters?)\b/i;

const isThinRoute = item => (item.play ? THIN_PLAYS.includes(item.play.name)
  : [...THIN_COMMANDS, 'ads'].includes(item.methods[0]?.name) || (item.methods[0]?.name === 'copy' && !SALES_PAGE.test(item.task)));

// The facts check and the approval boundary, in the words the copy and ads pass-throughs use.
const FACTS_CHECK = [/own\s+judgment/i, /user's\s+facts/i, /remove\s+claims\s+the\s+facts\s+do\s+not\s+support/i,
  /keep\s+fair\s+inferences/i, /add\s+nothing/i, /no\s+hedges/i, /no\s+source\s+text/i, /no\s+disclaimers/i];
const APPROVAL = /without\s+the\s+user's\s+approval\s+for\s+that\s+exact\s+action/i;
// Process the deliverable must not carry. The approval boundary governs actions, not the deliverable.
const PROCESS = [/\bapproval\s*:/i, /\breadiness\b/i, /\bevidence\s+(?:labels?|class(?:es)?)\b/i, /\bgates?\b/i, /\brubric\b/i,
  /\bscores?\b/i, /\breversib/i, /\breview packet\b/i, /\bnext move\b/i, /\bwhy these choices\b/i, /\bthe bet\b/i,
  /\bmark (?:each )?assumptions?\b/i, /\bassumption (?:labels?|boundary)\b/i, /\bclaim boundary\b/i, /\bacceptance\b/i];
// Detailed method files an entry must not send the model to.
const DETAIL_LINK = /\]\((?!https?:)[^)]*\)|COMMAND\.md|references\/|agents\/|fallbacks\/|\bplaybooks?\b|\bcomplete method\b/i;
const links = text => [...text.matchAll(/\]\(([^)\s]+)\)/g)].map(match => match[1].split('#')[0]).filter(Boolean);
const playFile = name => `plays/${name}.md`;
const body = text => text.replace(/^---\n[\s\S]*?\n---\n/, '');

let cases;
const routed = async () => {
  if (!cases) cases = (await loadCases()).filter(item => !item.silent).map(item => ({ ...item, ...brief(item.task) }))
    .filter(item => item.action === 'brief');
  return cases;
};

test('every in-scope brief carries the selected entries and nothing else', async () => {
  const thin = (await routed()).filter(isThinRoute);
  assert.ok(thin.length >= 300, `in-scope routing cases: ${thin.length}`);
  for (const item of thin) {
    const { structured } = packBrief(item);
    const entries = item.methods.map(method => method.path);
    const extra = structured.inlined.map(file => file.path).filter(path => !entries.includes(path));
    // A kept-craft secondary method keeps its own files; everything else is an entry.
    const foreign = extra.filter(path => !CRAFT_COMMANDS.some(name => path.startsWith(`skills/conquistador/commands/${name}/`))
      && !CRAFT_CHANNELS.some(name => path === `skills/conquistador/channels/${name}.md`));
    assert.deepEqual(foreign, [], `${item.task}: inlined ${JSON.stringify(extra)}`);
    const deferred = structured.situational.filter(path => !CRAFT_COMMANDS.some(name => path.startsWith(`skills/conquistador/commands/${name}/`)));
    assert.deepEqual(deferred, [], `${item.task}: deferred files`);
    assert.deepEqual(item.deferredRequired ?? [], [], `${item.task}: required files`);
    if (item.play) {
      for (const step of item.play.steps) {
        assert.deepEqual(step.playbooks, [], `${item.task}: step ${step.step} stages files`);
        if (step.command) assert.equal(step.path, entryOf(step.command), `${item.task}: step ${step.step} points at ${step.path}`);
      }
      for (const later of structured.readAtStep) assert.doesNotMatch(later.path, /COMMAND\.md$/, `${item.task}: ${later.path}`);
    }
  }
});

test('a thin brief stays inside a small budget', async () => {
  for (const item of (await routed()).filter(isThinRoute)) {
    const { text } = packBrief(item);
    const limit = 3000 + 2600 * (item.methods.length - 1);
    assert.ok(Buffer.byteLength(text) <= limit, `${item.task}: ${Buffer.byteLength(text)} bytes`);
    assert.doesNotMatch(text, /Mark assumptions|Follow relevant method rules|Deferred files are optional/, item.task);
    assert.match(formatReadingList(item), /Entry: skills\/conquistador\/(?:commands|plays)\//, item.task);
  }
});

test('every in-scope entry is a pass-through with the facts check and the approval boundary', () => {
  for (const name of [...THIN_COMMANDS, ...PASS_THROUGH]) {
    const path = `commands/${name}/ENTRY.md`;
    const text = read(path);
    assert.match(text, /^# \S/, `${path} keeps its title`);
    for (const rule of FACTS_CHECK) assert.match(text, rule, `${path}: ${rule}`);
    assert.match(text, APPROVAL, `${path} keeps the approval boundary`);
    assert.match(text, /approval[^.]*governs?[^.]*action|adds? nothing to the (?:deliverable|work)/i, `${path}: the boundary governs actions`);
  }
});

test('an in-scope entry links no detailed method file for an ordinary request', () => {
  for (const name of [...THIN_COMMANDS, 'ads']) {
    const text = read(`commands/${name}/ENTRY.md`);
    assert.doesNotMatch(text, DETAIL_LINK, `commands/${name}/ENTRY.md`);
    assert.match(text, /load no other file/i, `commands/${name}/ENTRY.md`);
  }
  // Copy links its long-form method for a sales page or sales letter only.
  const copy = read('commands/copy/ENTRY.md');
  for (const target of links(copy)) assert.match(copy.slice(0, copy.indexOf(target)), /sales page or sales letter[^\n]*\n?[^\n]*$/i, target);
});

test('no in-scope instruction adds process sections to the deliverable', () => {
  const files = [...[...THIN_COMMANDS, ...PASS_THROUGH].map(name => `commands/${name}/ENTRY.md`),
    ...THIN_PLAYS.map(playFile), ...THIN_CHANNELS.map(name => `channels/${name}.md`),
    ...THIN_FORMATS.map(name => `formats/${name}.md`), ...[...THIN_SPECIALISTS, ...PASS_SPECIALISTS].map(name => `specialists/${name}.md`)];
  for (const path of files) {
    const text = body(read(path)).replace(/^- \*\*[^*]+:\*\*.*(?:\n {2}.*)*$/gm, '');
    for (const pattern of PROCESS) assert.doesNotMatch(text, pattern, `${path}: ${pattern}`);
  }
  const deliverable = read('SKILL.md').split('## Deliverable')[1] ?? '';
  for (const pattern of PROCESS) assert.doesNotMatch(deliverable, pattern, `SKILL.md deliverable: ${pattern}`);
  assert.match(deliverable, /only what the user asked for/i);
});

test('dated platform facts stay in the entries that need them', () => {
  const seo = read('commands/seo/ENTRY.md');
  for (const name of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
    'PerplexityBot', 'Google-Extended', 'Applebot-Extended']) assert.ok(seo.includes(`\`${name}\``), `seo: ${name}`);
  assert.match(seo, /checked \w+ 20\d\d/i);
  assert.match(seo, /subtitle[^.\n]*30/i);
  assert.match(seo, /keyword field[^.\n]*100/i);
  assert.match(seo, /short description[^.\n]*80/i);
  const video = read('commands/video/ENTRY.md');
  for (const platform of [/YouTube Shorts/, /TikTok/, /Reels/, /9:16/]) assert.match(video, platform, `video: ${platform}`);
  assert.match(video, /checked \w+ 20\d\d/i);
  const ads = read('commands/ads/ENTRY.md');
  for (const fact of [/125 characters/, /15 headlines of 30 characters/, /special ad categories/, /Spark Ads/]) assert.match(ads, fact, `ads: ${fact}`);
  for (const name of THIN_CHANNELS) {
    const text = read(`channels/${name}.md`);
    assert.match(text, /checked \w+ 20\d\d/i, name);
    assert.match(text, APPROVAL, name);
  }
});

test('plays keep their step order, and each in-scope play is thin', () => {
  const contract = JSON.parse(read('routing-contract.json'));
  for (const name of THIN_PLAYS) {
    const play = contract.plays.find(item => item.name === name);
    assert.ok(play, name);
    const text = read(playFile(name));
    const steps = play.chain.map(step => step.command ?? step.method);
    let at = 0;
    const order = body(text);
    for (const step of steps) {
      const found = order.indexOf(`\`${step}\``, at);
      assert.ok(found >= 0, `${name}: step ${step} is listed in order`);
      at = found + 1;
    }
    for (const rule of FACTS_CHECK) assert.match(text, rule, `${name}: ${rule}`);
    assert.match(text, APPROVAL, name);
    assert.doesNotMatch(body(text), DETAIL_LINK, `${name} links a detailed file`);
  }
});

test('kept-craft practices keep their method', () => {
  const outreach = brief('Write a cold email sequence to CTOs at fintech startups');
  assert.equal(outreach.methods[0].name, 'outreach');
  assert.ok(outreach.must.some(item => item.path.includes('/commands/outreach/references/')), 'outreach loads its craft');
  assert.match(read('commands/outreach/ENTRY.md'), /COMMAND\.md|references\//);
  const outbound = brief('Run an outbound play to book demos with heads of finance');
  assert.equal(outbound.play?.name, 'outbound');
  assert.ok(outbound.play.steps.some(step => step.playbooks.length), 'outbound stages its steps');
  const social = brief('Write a LinkedIn post announcing our new feature');
  assert.equal(social.methods[0].name, 'social');
  assert.ok(social.must.some(item => item.path.endsWith('channels/linkedin.md')), 'social loads its LinkedIn channel');
  assert.ok(social.must.some(item => item.path.includes('/commands/social/')), 'social loads its craft');
  const sales = brief('Write a sales page for our course');
  assert.equal(sales.methods[0].name, 'copy');
  assert.ok(sales.must.some(item => item.path.endsWith('copy/references/sales-argument.md')), 'a sales page loads the sales argument');
  for (const name of CRAFT_CHANNELS) {
    assert.doesNotMatch(read(`channels/${name}.md`), /load no other file/i, `${name} keeps its craft`);
  }
});

test('unchanged practices keep their method', async () => {
  for (const name of UNCHANGED_COMMANDS) {
    const text = read(`commands/${name}/ENTRY.md`);
    assert.match(text, /COMMAND\.md/, `${name} still points to its complete method`);
    assert.doesNotMatch(text, /load no other file/i, name);
  }
  const unchanged = (await routed()).filter(item => !item.play && UNCHANGED_COMMANDS.includes(item.methods[0]?.name));
  assert.ok(unchanged.length >= 10, `unchanged routing cases: ${unchanged.length}`);
  for (const item of unchanged.filter(entry => entry.mode !== 'assist')) {
    const { structured } = packBrief(item);
    assert.ok(structured.inlined.length + structured.situational.length > 1, `${item.task} keeps its method files`);
  }
  const spec = brief('Turn this feature idea into a product spec and implementation plan');
  assert.equal(spec.play?.name, 'spec');
  assert.ok(spec.must.some(item => item.path.includes('/commands/flow/')), 'the spec play keeps its flow files');
  for (const name of KEPT_PLAYS) assert.doesNotMatch(read(playFile(name)), /load no other file/i, name);
});

test('in-scope methods declare no required resources', () => {
  const overlay = JSON.parse(read('routing-overlay.json'));
  for (const name of [...THIN_COMMANDS, ...PASS_THROUGH]) assert.deepEqual(overlay.methods[name].requiredResources, [], name);
});

test('the parent skill sends in-scope commands to their entries', () => {
  const skill = read('SKILL.md');
  for (const name of THIN_COMMANDS) {
    assert.ok(skill.includes(`](commands/${name}/ENTRY.md)`), `${name} links its entry`);
    assert.ok(!skill.includes(`](commands/${name}/COMMAND.md)`), `${name} links its complete method`);
  }
  for (const name of [...CRAFT_COMMANDS, ...UNCHANGED_COMMANDS]) assert.ok(skill.includes(`](commands/${name}/COMMAND.md)`), name);
});

test('the two ads misroutes reach ads', () => {
  for (const task of ['Plan a Meta ads test for our new offer: daily budget, and a stop rule',
    'Plan our Meta ads account structure: campaigns, ad sets, and audiences']) {
    for (const force of [true, false]) {
      const result = createBrief(task, { ...options, force });
      assert.equal(result.play, null, `${task}: ${result.play?.name}`);
      assert.equal(result.methods[0]?.name, 'ads', `${task}: ${result.methods.map(item => item.name)}`);
    }
  }
});

test('every practice keeps its entry and its detailed files', () => {
  for (const name of [...THIN_COMMANDS, ...PASS_THROUGH, ...CRAFT_COMMANDS, ...UNCHANGED_COMMANDS]) {
    assert.ok(existsSync(join(library, `commands/${name}/ENTRY.md`)), `${name} entry`);
    assert.ok(existsSync(join(library, `commands/${name}/COMMAND.md`)), `${name} complete method`);
  }
  for (const name of THIN_COMMANDS) {
    const kept = readdirSync(join(library, 'commands', name)).filter(entry => statSync(join(library, 'commands', name, entry)).isDirectory());
    assert.ok(kept.includes('references') || name === 'watch', `${name} keeps its references`);
  }
  for (const name of [...THIN_PLAYS, ...KEPT_PLAYS]) assert.ok(existsSync(join(library, playFile(name))), `${name} play`);
  // A thin play, channel, format, or specialist keeps its detailed text as its COMMAND.md.
  for (const path of [...THIN_PLAYS.map(name => `plays/${name}`), ...THIN_CHANNELS.map(name => `channels/${name}`),
    ...THIN_FORMATS.map(name => `formats/${name}`), ...THIN_SPECIALISTS.map(name => `specialists/${name}`)]) {
    assert.ok(existsSync(join(library, `${path}.md`)), `${path}.md entry`);
    assert.ok(existsSync(join(library, `${path}/COMMAND.md`)), `${path}/COMMAND.md keeps the detailed text`);
  }
});

test('changed files have no broken links', () => {
  const files = [...[...THIN_COMMANDS, ...PASS_THROUGH].map(name => `commands/${name}/ENTRY.md`), 'SKILL.md',
    ...THIN_PLAYS.flatMap(name => [playFile(name), `plays/${name}/COMMAND.md`]),
    ...[...THIN_CHANNELS.map(name => `channels/${name}`), ...THIN_FORMATS.map(name => `formats/${name}`),
      ...THIN_SPECIALISTS.map(name => `specialists/${name}`)].flatMap(path => [`${path}.md`, `${path}/COMMAND.md`])];
  for (const path of files.filter(file => existsSync(join(library, file)))) {
    for (const target of links(read(path)).filter(href => !/^(?:https?:|mailto:)/.test(href))) {
      assert.ok(existsSync(resolve(dirname(join(library, path)), decodeURIComponent(target))), `${path} links missing ${target}`);
    }
  }
});
