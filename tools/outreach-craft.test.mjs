// Failure modes covered before the outbound craft rebuild was written:
// 1. public text names a practitioner, course, book, creator, or a fixture used for blind tests;
// 2. an example invents a result for a real company, or does not declare its products synthetic;
// 3. the approval boundary for send, enrich, upload, CRM write, or schedule is lost;
// 4. the opt-out or unsubscribe requirement is lost;
// 5. a strong example email fails `conquistador check FILE --channel email` (error or warning);
// 6. a strong first touch exceeds the word limit the craft sets, or opens with the sender's introduction;
// 7. the drafting files speak in readiness labels or uncertainty instead of craft;
// 8. a numeric default in the craft files is not labeled as a starting point;
// 9. the brief for a cold email sequence no longer inlines the craft reference within the byte budget;
// 10. a relative link in the owned files is broken;
// 11. the method links a resource the routing overlay does not declare, so the manifests cannot regenerate.
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
const outreach = join(library, 'commands/outreach');
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const owned = [...walk(outreach), join(library, 'plays/outbound.md'), join(library, 'channels/email-newsletter.md')]
  .filter(path => path.endsWith('.md'));
const read = path => readFileSync(path, 'utf8');
const craftFiles = ['references/frameworks/cold-email-frameworks.md', 'references/channels/email.md', 'references/frameworks/sequences.md']
  .map(path => join(outreach, path));
const pairFiles = readdirSync(join(outreach, 'references/examples')).filter(name => name.startsWith('pairs-'))
  .map(name => join(outreach, 'references/examples', name));
const examples = [...pairFiles, join(outreach, 'references/examples/saas-sequence-no-proof.md')];

// Strong example emails are fenced `markdown` blocks with front matter; weak ones are fenced `text`.
const strongEmails = examples.flatMap(path => [...read(path).matchAll(/```markdown\n(---\n[\s\S]*?)```/g)]
  .map(match => ({ path: relative(root, path), source: match[1] })));
const frontField = (source, name) => source.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1].trim();
const bodyOf = source => {
  const lines = source.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  const start = lines.findIndex(line => line.trim());
  const from = /^(?:hi|hey|hello|dear)\b.*,$/i.test(lines[start]) ? start + 1 : start;
  const end = lines.findIndex((line, index) => index >= from && /^(?:[A-Z][a-z]+|\{\{sender_name\}\})$/.test(line.trim()));
  return lines.slice(from, end === -1 ? lines.length : end).join('\n').trim();
};
const wordCount = text => text.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length;

test('public outbound text names no source, creator, real company result, or blind-test fixture', () => {
  const banned = /\b(?:Saraev|Vacca|Nass|Cialdini|Hormozi|Haines|coreyhaines|Justin Michael|Money Button|Y Combinator|YC|Lavender|Isenberg|Castillo|Letz|Munneke|LaManna|VibeMarketer|Schneider|Palantir|Ramp|Linear's|Instantly|Smartlead|Ledgerly|Brightline|Stillwater|Mai Tran|Vanilla Ice Cream|Mouse Trap)\b/;
  for (const path of owned) {
    const hit = read(path).match(banned);
    assert.equal(hit, null, `${relative(root, path)} names "${hit?.[0]}"`);
  }
});

test('every example file declares its products synthetic and reports no real send or result', () => {
  assert.ok(pairFiles.length >= 2, 'expected annotated pair files');
  for (const path of examples) {
    const head = read(path).split('\n').slice(0, 12).join(' ');
    assert.match(head, /synthetic/i, `${relative(root, path)} must declare synthetic products in its opening lines`);
    assert.match(read(path), /No (?:message|email)s? (?:was|were) sent/i, `${relative(root, path)} must say nothing was sent`);
  }
});

test('the approval boundary covers send, enrich, upload, CRM writes, and scheduling', () => {
  const boundary = /send[\s\S]{0,80}enrich[\s\S]{0,80}upload[\s\S]{0,80}CRM[\s\S]{0,80}schedul/i;
  for (const path of ['commands/outreach/COMMAND.md', 'commands/outreach/references/method.md', 'plays/outbound.md']) {
    assert.match(read(join(library, path)), boundary, path);
  }
  assert.match(read(join(library, 'channels/email-newsletter.md')), /approv/i);
});

test('opt-out and suppression requirements survive', () => {
  assert.match(read(join(outreach, 'references/method.md')), /Unsubscribe or opt-out \| Suppress the contact on every channel/);
  assert.match(read(join(outreach, 'references/channels/email.md')), /unsubscribe|opt-out/i);
  assert.match(read(join(library, 'channels/email-newsletter.md')), /unsubscribe/i);
  for (const email of strongEmails) assert.match(email.source, /unsubscribe/i, email.path);
});

test('there are 10 to 20 annotated strong and weak pairs', () => {
  const pairs = pairFiles.flatMap(path => [...read(path).matchAll(/^## /gm)]).length;
  assert.ok(pairs >= 10 && pairs <= 20, `${pairs} pairs`);
  for (const path of pairFiles) {
    const text = read(path);
    assert.equal([...text.matchAll(/```markdown\n/g)].length, [...text.matchAll(/^## /gm)].length, `${relative(root, path)}: one strong email per pair`);
    assert.ok([...text.matchAll(/```text\n/g)].length >= [...text.matchAll(/^## /gm)].length, `${relative(root, path)}: one weak version per pair`);
    assert.ok([...text.matchAll(/^\*\*Why\b/gm)].length >= [...text.matchAll(/^## /gm)].length, `${relative(root, path)}: a note on why for each pair`);
  }
});

test('every strong example email passes the email checker without errors or warnings', t => {
  const temp = mkdtempSync(join(tmpdir(), 'outreach-craft-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  assert.ok(strongEmails.length >= 12, `${strongEmails.length} strong emails`);
  strongEmails.forEach((email, index) => {
    const file = join(temp, `email-${index}.md`);
    writeFileSync(file, email.source);
    const run = spawnSync(process.execPath, [join(root, 'runtime/bin/conquistador.js'), 'check', file, '--channel', 'email', '--json'], { encoding: 'utf8' });
    const findings = JSON.parse(run.stdout || '[]').filter(item => item.severity !== 'advisory');
    assert.deepEqual(findings.map(item => `${item.rule}: ${item.snippet}`), [], `${email.path} email ${frontField(email.source, 'subject')}`);
  });
});

test('strong emails keep to the craft word limits and never open with the sender introduction', () => {
  const limits = { first: 90, 'follow-up': 70, breakup: 45, reply: 90, forward: 90 };
  for (const email of strongEmails) {
    const touch = frontField(email.source, 'touch');
    assert.ok(touch in limits, `${email.path}: touch "${touch}" must be one of ${Object.keys(limits)}`);
    const body = bodyOf(email.source);
    assert.ok(wordCount(body) <= limits[touch], `${email.path} "${frontField(email.source, 'subject')}": ${wordCount(body)} words, limit ${limits[touch]}`);
    assert.doesNotMatch(body.split('\n')[0], /^(?:I'm [A-Z]|I am (?:the|a) |My name is|I hope|Hope (?:you|this)|I wanted to|I'm reaching out|Just following up|Just checking in)/, `${email.path}: opener`);
  }
});

test('drafting files teach craft, not readiness labels or uncertainty', () => {
  for (const path of craftFiles) {
    assert.doesNotMatch(read(path), /NEEDS_SIGNAL|readiness|must remain uncertain|What must remain uncertain/i, relative(root, path));
  }
});

test('numeric defaults in the craft files are labeled as starting points', () => {
  for (const path of craftFiles) {
    let section = '';
    for (const line of read(path).split('\n')) {
      if (/^#{2,3} /.test(line)) section = line;
      const bare = line.replace(/^\s*\d+\.\s/, '').replace(/`[^`]*`|"[^"]*"|\[[^\]]*\]\([^)]*\)/g, '');
      if (/\d/.test(bare) && !/^#/.test(line)) {
        assert.match(`${section} ${line}`, /Starting point/i, `${relative(root, path)}: "${line.trim()}" has a number outside a starting-point section`);
      }
    }
  }
});

test('a cold email sequence brief inlines the craft reference within the byte budget', () => {
  const options = { root, playbooks: [], persistCache: false, cwd: null };
  for (const task of ['Write a cold email sequence to agency founders', 'Write a cold email to RevOps leads']) {
    const brief = createBrief(task, options);
    assert.equal(brief.methods[0]?.name, 'outreach', task);
    const pack = packBrief(brief);
    const inlined = pack.structured.inlined.map(item => item.path);
    assert.ok(inlined.some(path => path.endsWith('outreach/references/frameworks/cold-email-frameworks.md')), `${task}: ${inlined}`);
    assert.ok(inlined.some(path => path.endsWith('outreach/references/channels/email.md')), `${task}: ${inlined}`);
    assert.ok(Buffer.byteLength(pack.text) <= 16_000, task);
    assert.ok(Buffer.byteLength(JSON.stringify({ content: [{ type: 'text', text: pack.text }], structuredContent: pack.structured })) <= 16_000, task);
  }
  const sequence = packBrief(createBrief('Write a cold email sequence to agency founders', options)).structured.inlined.map(item => item.path);
  assert.ok(sequence.some(path => path.endsWith('outreach/references/frameworks/sequences.md')), `${sequence}`);
});

test('relative links in the outbound files resolve', () => {
  for (const path of owned) {
    for (const [, target] of read(path).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      assert.ok(existsSync(join(dirname(path), target)), `${relative(root, path)} links to missing ${target}`);
    }
  }
});

test('the routing contract still builds from the outreach method', () => {
  assert.doesNotThrow(() => buildRoutingContract(root));
});
