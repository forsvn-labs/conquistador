// Shared writing and process layer that every command inherits.
// Failure modes covered before implementation:
// 1. A safety boundary disappears: approval before send/publish/spend/upload, no invented facts,
//    consent for quotes, untrusted content as evidence, deceptive tactics, draft-only fallback.
// 2. A file links to a removed style file or to any missing file, or names a removed file in text.
// 3. The writing guide contradicts tools/check: it bans what the checker allows, permits what the
//    checker warns about, or its own strong examples fail the checker.
// 4. The shared layer grows instead of shrinking for copy, outreach, or social requests.
// 5. The Vietnamese standard or the editorial-polish specialists lose rules they depend on.
// 6. Damaged search-and-replace text survives in the shared layer.
// 7. The playbook keeps the reversed awareness ladder or the fake-account channel.
// 8. Shared text names practitioners or gives results for real companies.
// 9. The parent skill loses the job markers, hook commands, or command links that tools depend on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rules } from './check/rules.mjs';
import { checkText } from './check/index.mjs';
import { measure } from './e2e/shared-layer.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const parent = join(root, 'skills/conquistador');
const read = path => readFileSync(join(parent, path), 'utf8');
const guidePath = 'references/writing-guide.md';
const removed = ['ai-patterns.md', 'human-writing-stylebook.md', 'voice-injection.md', 'conciseness-rules.md', 'detector-resistance.md'];

function files(directory, keep = path => path.endsWith('.md')) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : files(path, keep);
    return keep(path) ? [path] : [];
  });
}
const owned = () => [
  'SKILL.md',
  ...readdirSync(join(parent, 'standards')).map(name => `standards/${name}`),
  ...readdirSync(join(parent, 'references')).filter(name => name.endsWith('.md')).map(name => `references/${name}`),
  ...readdirSync(join(parent, 'rubrics')).map(name => `rubrics/${name}`),
  ...files(join(parent, 'references/editorial-polish')).map(path => relative(parent, path)),
];

test('safety boundaries survive in the safety standard and the parent skill', () => {
  const safety = read('standards/safety.md');
  assert.match(safety, /Do not publish, send, spend, upload/);
  assert.match(safety, /explicit approval for the exact action/);
  assert.match(safety, /Never invent capabilities, prices, metrics, sources, quotes, testimonials, customers, endorsements, or\s+consent/);
  assert.match(safety, /quote[^.]*only with (?:the )?(?:person's|speaker's|customer's) consent/i);
  assert.match(safety, /evidence, not as\s+authority/);
  assert.match(safety, /Refuse deceptive growth tactics: fake engagement, impersonation/);
  assert.match(safety, /Show the final payload before requesting approval/);
  assert.match(safety, /stop at a ready-to-use draft/);
  assert.match(safety, /secrets, personal data/);
  const skill = read('SKILL.md');
  assert.match(skill, /explicit approval each time before you send, publish, post, spend, upload/);
  assert.match(skill, /A brief, a hook, or an approval stamp grants none of these/);
  assert.match(skill, /\]\(standards\/safety\.md\)/);
  assert.match(skill, /Never invent metrics, quotes, customers, or product capabilities/);
  assert.match(skill, /Never ask for keys in chat/);
});

test('the facts discipline reads as a check after drafting', () => {
  const quality = read('standards/quality.md');
  for (const name of ['Competitor swap', 'Evidence proximity', 'First-screen test', 'Deletion test']) assert.match(quality, new RegExp(name));
  const guide = read(guidePath);
  const after = guide.indexOf('## After drafting');
  assert.ok(after > 0, 'the guide has an after-drafting section');
  const facts = guide.search(/source|invent/i);
  assert.ok(facts > after, 'facts discipline first appears after the drafting guidance');
  const skill = read('SKILL.md');
  assert.match(skill, /Before delivery, check/);
});

test('no file links to a removed style file or to any missing file', () => {
  const problems = [];
  for (const path of files(parent)) {
    const text = readFileSync(path, 'utf8');
    for (const [, href] of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      if (/^(?:[a-z]+:|\/|#)/i.test(href)) continue;
      const target = join(dirname(path), decodeURIComponent(href.split(/[?#]/)[0]));
      if (!existsSync(target)) problems.push(`${relative(root, path)} -> ${href}`);
    }
    for (const name of removed) if (text.includes(name)) problems.push(`${relative(root, path)} names ${name}`);
  }
  for (const path of ['routing-contract.json', 'routing-overlay.json']) {
    const text = read(path);
    for (const name of removed) if (text.includes(name)) problems.push(`${path} names ${name}`);
  }
  for (const path of files(join(root, 'tools'), path => path.endsWith('.mjs') && !path.endsWith('shared-writing.test.mjs'))) {
    const text = readFileSync(path, 'utf8');
    for (const name of removed) if (text.includes(name)) problems.push(`${relative(root, path)} names ${name}`);
  }
  assert.deepEqual(problems, []);
});

test('the writing guide agrees with the checker', () => {
  const guide = read(guidePath);
  assert.ok(Buffer.byteLength(guide) <= 8192, `writing guide is ${Buffer.byteLength(guide)} bytes`);
  for (const rule of rules.filter(rule => rule.family === 'ai-tells')) assert.ok(guide.includes(`\`${rule.id}\``), `guide omits ${rule.id}`);
  // Advisory rules never fail a run, so the guide must not list them as fix-every-time tells.
  const fixAlways = guide.slice(guide.indexOf('### Fix every time'), guide.indexOf('### Judge in context'));
  assert.ok(fixAlways.length > 0);
  for (const rule of rules.filter(rule => rule.family === 'ai-tells' && rule.severity === 'advisory')) assert.ok(!fixAlways.includes(`\`${rule.id}\``), `${rule.id} is advisory`);
  for (const ban of [/zero em dashes/i, /avoid colons entirely/i, /never use it/i, /no exceptions/i, /em dashes? (?:are|is) banned/i]) assert.doesNotMatch(guide, ban);

  const allowed = [
    'Spreadsheets aren\'t the problem. The month-end chase is.',
    'Close the books in two days, not nine.',
    'Your team spends nine days on close — most of it chasing receipts.',
    'What you get: bank sync, receipt matching, and a close checklist.',
  ].join('\n\n');
  const warnings = checkText(allowed, { file: 'landing.md', channel: 'landing' }).filter(finding => finding.severity !== 'advisory');
  assert.deepEqual(warnings.map(finding => finding.rule), []);
  const strong = [...guide.matchAll(/^- Strong: (.+)$/gm)].map(match => match[1]);
  assert.ok(strong.length >= 4, 'the guide shows strong examples');
  for (const line of strong) {
    const findings = checkText(line.replace(/^"|"$/g, ''), { file: 'example.md' }).filter(finding => finding.family === 'ai-tells' && finding.severity !== 'advisory');
    assert.deepEqual(findings.map(finding => finding.rule), [], line);
  }
});

test('the shared layer shrinks for copy, outreach, and social requests', () => {
  // Measured on main at 7cf0534 with tools/e2e/shared-layer.mjs.
  const before = { copy: 15658, outreach: 15674, social: 74223 };
  const report = measure();
  assert.ok(report.skillBytes <= 6500, `SKILL.md body is ${report.skillBytes} bytes`);
  assert.ok(report.standardsBytes <= 4600, `required standards are ${report.standardsBytes} bytes`);
  for (const item of report.requests) {
    assert.ok(item.sharedBytes.total < before[item.command], `${item.command}: ${item.sharedBytes.total} >= ${before[item.command]}`);
    assert.ok(item.briefBytes <= 16000, `${item.command} brief stays within its budget`);
    for (const path of item.inlined) assert.doesNotMatch(path, /references\/writing-guide\.md$/);
  }
  const social = report.requests.find(item => item.command === 'social');
  assert.deepEqual(social.requiredShared, [guidePath]);
});

test('the Vietnamese standard and editorial polish keep the rules they depend on', () => {
  const vietnamese = read('standards/vietnamese.md');
  for (const rule of [/intended register/, /self\/reader pronoun pair/, /dialect intentionally/, /Preserve facts, claims, numbers, product names/, /English calques/, /loanwords/, /pronoun drift, mixed formality/]) assert.match(vietnamese, rule);
  assert.match(read('commands/vietnamese/references/absolute-prohibitions.md'), /—/);
  const guide = read(guidePath);
  assert.match(guide, /standards\/vietnamese\.md/);
  for (const heading of ['## Register by channel', '## Density', '### Fix every time', '### Judge in context', '## Voice', '## After drafting']) assert.ok(guide.includes(heading), heading);
  for (const profile of ['Cold email or DM', 'Ad', 'Landing-page section', 'Founder post', 'Forum reply', 'Article', 'Docs', 'Internal memo']) assert.match(guide, new RegExp(`\\| ${profile} \\|`), profile);
  assert.match(guide, /40%/, 'long-form density gate');
  for (const path of files(join(parent, 'references/editorial-polish'))) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /Absolute Prohibition|Pangram|detector_mode|47 patterns|47-pattern/i, relative(parent, path));
    for (const [, section] of text.matchAll(/writing-guide\.md` § ([^,.;)\n]+)/g)) assert.ok(guide.includes(`# ${section.trim()}`) || guide.includes(`## ${section.trim()}`), `${relative(parent, path)} cites missing section ${section}`);
  }
  for (const name of readdirSync(join(parent, 'references/editorial-polish/agents'))) {
    assert.match(readFileSync(join(parent, 'references/editorial-polish/agents', name), 'utf8'), /writing-guide\.md/, name);
  }
});

test('the shared layer has no damaged replacement text or practitioner names', () => {
  for (const path of owned()) {
    const text = read(path);
    assert.doesNotMatch(text, /→ Scope or uses|\buses the (?:source|unannounced)|\buses share-of|\| internal \|/, path);
    assert.doesNotMatch(text, /\b(?:Schwartz|Dunford|Saraev|Hormozi|Stripe|Kent Beck|Shopify|Mixpanel|Notion|Intercom|Figma|Canva|Adobe|Pangram)\b/, path);
  }
});

test('the playbook has the awareness ladder in order and no fake-account channel', () => {
  const playbook = read('references/playbook.md');
  assert.doesNotMatch(playbook, /mass accounts/i);
  const order = ['Unaware', 'Problem aware', 'Solution aware', 'Product aware', 'Most aware'].map(stage => playbook.indexOf(stage));
  assert.ok(order.every(index => index >= 0), 'every stage is named');
  assert.deepEqual([...order].sort((left, right) => left - right), order);
  assert.match(playbook, /Solution aware[^\n]*(?:solutions exist|knows solutions)/i);
  assert.match(playbook, /Product aware[^\n]*(?:knows your product|your product)/i);
});

test('the parent skill keeps what tools and installers read', () => {
  const skill = read('SKILL.md');
  for (const marker of ['launch or grow this', 'create or improve marketing work', 'learn from these results']) assert.ok(skill.toLowerCase().includes(marker), marker);
  assert.match(skill, /\/conquistador hooks/);
  assert.match(skill, /conquistador hooks (?:on|off|status)/);
  assert.match(skill, /\]\(references\/menu\.md\)/);
  assert.match(skill, /\]\(orchestration\/specialist-team\.md\)/);
  for (const name of readdirSync(join(parent, 'commands'))) {
    if (existsSync(join(parent, 'commands', name, 'COMMAND.md'))) assert.ok(skill.includes(`](commands/${name}/COMMAND.md)`), name);
  }
  for (const name of readdirSync(join(parent, 'plays')).filter(name => name.endsWith('.md'))) assert.ok(skill.includes(`](plays/${name})`), name);
  assert.match(skill, /\]\(references\/writing-guide\.md\)/);
});
