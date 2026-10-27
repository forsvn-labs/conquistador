// Failure modes recorded before implementation:
// 1. App prompts, served steps, assignments, or installs load an archived method by default.
// 2. A thin entry is accompanied by shared process instructions or deferred role pipelines.
// 3. Outreach, social, sales pages, engineering, utilities, or the spec play lose their method.
// 4. An installed entry has missing metadata, broken links, changed source bytes, or missing imports.
// 5. MCP discovery advertises archived procedures as the default entry.
// 6. A shared play step reintroduces process sections or a detailed reference chain.
// 7. Selecting entries changes command/play routing or exceeds the brief budget.
// 8. A missing entry silently restores a detailed method.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkillAssets, skillMethodContext } from '../runtime/src/skill-assets.ts';
import { loadRuntimeCorpus } from '../runtime/src/corpus.ts';
import { loadAssignment } from '../hosts/coding-agent/contracts.mjs';
import { runSpecialistTeam } from '../hosts/coding-agent/orchestrate.mjs';
import { prepareAssignmentResources } from './routing-contract.mjs';
import { createMethodAccess } from './skills-mcp.mjs';
import { buildBotPack, GROUPS } from './bot-pack.mjs';
import { loadRoutingContract } from './routing-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const skills = join(root, 'skills');
// Independent owner scope, rather than the policy under test.
const thin = ['ads', 'article', 'audit', 'brand', 'budget', 'campaign', 'channels', 'convert', 'creative', 'critique',
  'decide', 'diagnose', 'event', 'flow', 'funnel', 'ideas', 'measure', 'position', 'pricing', 'prioritize', 'results',
  'seo', 'shape', 'video', 'watch', 'copy'];
const kept = ['outreach', 'social', 'architect', 'build', 'docs', 'ui', 'init', 'doctor', 'pin', 'connect', 'review',
  'feedback', 'check', 'factcheck', 'vietnamese'];
const read = path => readFileSync(join(root, path), 'utf8');
const assignment = (extra = {}) => ({ id: 'work', role: 'outcome', goal: 'Produce the requested deliverable.',
  skills: [], workflows: [], knowledgeHandles: [], dependsOn: [], ...extra });

test('served method context starts with the same thin entry as the brief', () => {
  for (const name of thin) {
    const assets = loadSkillAssets(name, skills);
    const context = skillMethodContext(assets);
    assert.match(context, /path="ENTRY.md"/, name);
    assert.ok(context.includes(read(`skills/conquistador/commands/${name}/ENTRY.md`)), name);
    assert.doesNotMatch(context, /path="COMMAND.md"|path="(?:references|agents)\//, name);
  }
  for (const name of kept) assert.match(skillMethodContext(loadSkillAssets(name, skills)), /path="COMMAND.md"/, name);
  const sales = skillMethodContext(loadSkillAssets('copy', skills), 24_000, { task: 'Write a sales page for our course' });
  assert.match(sales, /path="COMMAND.md"/);
  assert.match(sales, /sales-argument/);
});

test('a new practice defaults to thin and cannot restore its procedure when the entry is missing', t => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-new-practice-')));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const directory = join(temporary, 'conquistador/commands/new-practice');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'COMMAND.md'), '# Unproven method\nDetailed process.\n');
  assert.throws(() => skillMethodContext(loadSkillAssets('new-practice', temporary)), /entry is missing/);
});

test('app corpus serves thin entries without the parent process or archived channel methods', () => {
  const corpus = loadRuntimeCorpus(skills);
  for (const name of thin) {
    const selected = corpus.resolve(`/conquistador ${name}`);
    assert.deepEqual(selected.fileIds, [`conquistador/commands/${name}/ENTRY.md`], name);
    assert.ok(Buffer.byteLength(selected.systemInstructions) < 4000, name);
  }
  for (const task of ['Write a YouTube script', 'Make a TikTok video', 'Plan our launch campaign']) {
    const selected = corpus.resolve(task);
    assert.ok(selected.fileIds.every(path => !path.endsWith('/COMMAND.md')), `${task}: ${selected.fileIds}`);
    assert.ok(!selected.fileIds.includes('conquistador/standards/quality.md'), task);
  }
  for (const name of kept) assert.ok(corpus.resolve(`/conquistador ${name}`).fileIds.includes(`conquistador/commands/${name}/COMMAND.md`), name);
  assert.ok(corpus.resolve('/conquistador copy Write a sales letter').fileIds.includes('conquistador/commands/copy/COMMAND.md'));
});

test('specialist assignments and their resource planner load entries without deferred pipelines', async () => {
  for (const name of thin) {
    const loaded = await loadAssignment(root, assignment({ skills: [name] }));
    assert.deepEqual(loaded.methods.map(item => item.path), [`skills/conquistador/commands/${name}/ENTRY.md`], name);
    assert.deepEqual(loaded.deferred, [], name);
    const prepared = prepareAssignmentResources(root, name);
    assert.deepEqual(prepared.required, [`skills/conquistador/commands/${name}/ENTRY.md`], name);
    assert.deepEqual(prepared.deferred, [], name);
  }
  const sales = await loadAssignment(root, assignment({ skills: ['copy'], goal: 'Write a sales page for our course' }));
  assert.ok(sales.methods.some(item => item.path.endsWith('/copy/COMMAND.md')));
  const spec = await loadAssignment(root, assignment({ skills: ['flow'], workflows: ['spec'] }));
  assert.ok(spec.methods.some(item => item.path.endsWith('/flow/COMMAND.md')));
  const mixed = await loadAssignment(root, assignment({ skills: ['pricing'], workflows: ['spec'] }));
  assert.ok(mixed.methods.some(item => item.path.endsWith('/pricing/ENTRY.md')));
  assert.ok(!mixed.methods.some(item => item.path.endsWith('/pricing/COMMAND.md')), 'A kept play cannot restore an unrelated thin method');
  const role = await loadAssignment(root, assignment({ role: 'campaign-data', skills: ['measure'], workflows: ['launch'] }));
  assert.ok(role.methods.some(item => item.path.endsWith('/specialists/campaign-data-agent.md')));
  assert.ok(role.methods.every(item => !item.path.endsWith('/COMMAND.md') && !item.path.includes('/standards/')));
});

test('standalone installs expose the entry, retain metadata and archived bytes, and keep sales-page links', t => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-thin-install-')));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  for (const name of [...thin, 'outreach', 'social', 'build']) {
    const target = join(temporary, name);
    const result = spawnSync(process.execPath, ['tools/install.mjs', 'install', `skill:${name}`, target], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const installed = readFileSync(join(target, 'skills', name, 'SKILL.md'), 'utf8');
    if (thin.includes(name)) {
      assert.match(installed, new RegExp(`^---\\nname: ${name}\\n`), name);
      assert.ok(installed.includes(read(`skills/conquistador/commands/${name}/ENTRY.md`)), name);
      assert.equal(readFileSync(join(target, 'skills', name, 'COMMAND.md'), 'utf8'), read(`skills/conquistador/commands/${name}/COMMAND.md`), name);
    } else assert.equal(installed, read(`skills/conquistador/commands/${name}/COMMAND.md`), name);
  }
});

// Additional failure found during integration review: coordinator assignments can restore the full
// parent even when every requested specialist uses thin entries. Exercise the real coordinator.
test('team integration and correction cannot restore the parent method for thin assignments', async () => {
  const seen = [];
  const plan = { schemaVersion: 'conquistador.specialist/v1', id: 'thin-team', goal: 'Write the launch message.',
    assignments: [assignment({ role: 'copy', skills: ['copy'] })],
    limits: { concurrency: 1, timeoutSeconds: 10, maxAttempts: 1, maxDispatches: 6, maxOutputBytes: 4000 } };
  const parent = { async execute(packet) {
    seen.push(packet.phase);
    assert.ok(packet.context.methods.every(item => !item.path.endsWith('/COMMAND.md') && !item.path.endsWith('/SKILL.md')
      && !item.path.endsWith('/METHOD.md') && !item.path.includes('/standards/')), packet.phase);
    return { executionId: 'same-parent', isolated: false, result: { schemaVersion: plan.schemaVersion,
      assignmentId: packet.assignment.id, status: packet.phase === 'review' && packet.assignment.id === 'review' ? 'revise' : 'draft',
      artifact: 'The requested launch message.', evidence: [], gaps: [], reviewedDigest: packet.integratedDigest } };
  } };
  const result = await runSpecialistTeam({ plan, root, parent });
  assert.ok(seen.includes('integrate') && seen.includes('correct'));
  assert.equal(result.receipt.humanAccepted, false);
});

test('MCP discovery advertises entry paths and hides archived files from default thin discovery', () => {
  const access = createMethodAccess(skills);
  const methods = access.methods().methods;
  for (const name of thin) {
    assert.equal(methods.find(item => item.method === name)?.path, `conquistador/commands/${name}/ENTRY.md`, name);
    assert.deepEqual(access.files(name).files, [`conquistador/commands/${name}/ENTRY.md`], name);
  }
  for (const name of kept) assert.equal(methods.find(item => item.method === name)?.path, `conquistador/commands/${name}/COMMAND.md`, name);
  // An explicit archive read remains available for an approved future craft test.
  assert.equal(access.read('conquistador/commands/pricing/COMMAND.md'), read('skills/conquistador/commands/pricing/COMMAND.md'));
});

// Export inventory found a further default loader: upload-only chat apps consume generated files.
// Its short entries must not be followed by archived references or universal process instructions.
test('bot knowledge exports thin entries and keeps sales-page craft in a conditional file', t => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-thin-bot-')));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const out = join(temporary, 'pack');
  buildBotPack(out, { root, includeUser: false });
  const contract = loadRoutingContract(root);
  for (const [file, names] of GROUPS) {
    const text = readFileSync(join(out, 'knowledge', `${file}.md`), 'utf8');
    for (const name of names.filter(name => thin.includes(name))) {
      const section = text.split(`# METHOD: ${contract.methods[name].label}\n\n`)[1]?.split('\n\n# METHOD: ')[0];
      assert.ok(section?.trim().startsWith(read(`skills/conquistador/commands/${name}/ENTRY.md`).trim()), name);
      assert.doesNotMatch(section, /## PLAYBOOK:/, name);
    }
  }
  const prompt = readFileSync(join(out, 'SYSTEM-PROMPT.md'), 'utf8');
  assert.doesNotMatch(prompt, /End with "Playbooks applied"|Then give two to four reasons/);
  assert.match(prompt, /sales page or sales letter/);
  const sales = readFileSync(join(out, 'knowledge/12-sales-pages-and-letters.md'), 'utf8');
  assert.ok(sales.includes(read('skills/conquistador/commands/copy/references/sales-argument.md')));
  assert.doesNotMatch(sales, /## PLAYBOOK: .*lifecycle-sequences/);
  const shared = readFileSync(join(out, 'knowledge/11-channels-standards-workflows.md'), 'utf8');
  assert.doesNotMatch(shared, /## conquistador\/references\//);
  assert.match(shared, /Spec play only: complete flow method/);
  assert.ok(shared.includes(read('skills/conquistador/commands/flow/COMMAND.md')));
});

test('shared play steps retain factual checks and action boundaries without process output', () => {
  for (const name of ['video-production', 'artifact-hygiene', 'share-card-verification']) {
    const text = read(`skills/conquistador/methods/${name}.md`);
    assert.match(text, /own judgment/);
    assert.match(text, /facts do not support/);
    assert.doesNotMatch(text, /Load recovered|Return the production record|Return the artifact identity|Return observed defects/);
    assert.match(text, /approval/);
  }
});
