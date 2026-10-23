// Failure modes covered before implementation: rejected and quoted intent reactivation,
// topic-only engineering matches, wrong product method, policy bypass, oversized assistance,
// unrelated stop/edit advice, repeat injection, and lost positive/mixed marketing requests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createBrief, packBrief } from './brief.mjs';
import { selectRequestContext } from './context-selection.mjs';
import { createConquistador } from '../api/index.mjs';
import { advisory } from './proactive.mjs';
import { isMarketingFile } from './check/channels.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const options = { root, playbooks: [], persistCache: false, cwd: null };
const negative = [
  'Help me engineer a mail outreach system',
  'Implement the API handler for cold email retries',
  'Do not write cold email copy',
  'Explain the string "write a cold email" in this fixture',
  'What does outreach mean?',
  'Design a queue for marketing email delivery',
  'Debug the sales pipeline database',
];
test('hook, route, brief and app agree on rejected intent', () => {
  const app = createConquistador();
  for (const task of negative) {
    assert.equal(selectRequestContext(task).action, 'abstain', task);
    assert.equal(createBrief(task, { ...options, force: true }).action, 'none', task);
    assert.equal(app.callTool('conquistador_brief', { task }).structuredContent.action, 'none', task);
  }
});
test('positive, mixed and product work retain the requested operation', () => {
  for (const task of ['Write a cold email', 'Write a cold email and implement its retry handler', 'Write landing page copy for our API']) {
    assert.equal(createBrief(task, options).action, 'brief', task);
  }
  const spec = createBrief('Draft a product requirements document for an outreach system', options);
  assert.equal(spec.play?.name, 'spec');
  assert.equal(spec.methods[0]?.name, 'flow');
});
test('small edits have bounded assistance, commands have bounded initial context', () => {
  for (const [task, mode, budget] of [
    ['Shorten the subject line of this cold email', 'assist', 4000],
    ['Write a cold email to a qualified prospect', 'command', 16000],
    ['Plan our go-to-market strategy', 'workflow', 16000],
  ]) {
    const brief = createBrief(task, options);
    const pack = packBrief(brief);
    assert.equal(brief.mode, mode);
    assert.ok(Buffer.byteLength(pack.text) <= budget);
    assert.equal(pack.structured.readNow.length, 0, 'budget omissions must not become mandatory reads');
    assert.doesNotMatch(pack.text, /End your answer with|READ IN FULL|field-tested playbooks for this exact task/);
  }
});
test('off is final, manual suppresses automatic hooks, project allows relevant work', t => {
  const temp = mkdtempSync(join(tmpdir(), 'behavior-policy-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  cpSync(join(root, 'skills'), join(temp, 'skills'), { recursive: true });
  const profile = join(temp, 'skills/conquistador/operator-profile.json');
  for (const activation of ['off', 'manual', 'project']) {
    writeFileSync(profile, JSON.stringify({ activation }));
    const task = 'Write a cold email';
    assert.equal(createBrief(task, { ...options, root: temp, automatic: true }).action, activation === 'project' ? 'brief' : 'none');
    assert.equal(createBrief('/conquistador outreach ' + task, { ...options, root: temp }).action, activation === 'off' ? 'none' : 'brief');
  }
});
test('static events and technical files do not emit automatic marketing advice', () => {
  const config = { schemaVersion: 1, enabled: true, events: ['session-start', 'before-delivery', 'results-updated'] };
  for (const event of config.events) assert.deepEqual(advisory(event, config).instructions, []);
  for (const file of ['outreach/architecture.md', 'admin/index.html']) assert.equal(isMarketingFile(file, { data: {} }), false);
  assert.equal(isMarketingFile('outreach/sequence.md', { data: { channel: 'email' } }), true);
});
test('automatic plugin guidance is bounded, advisory and repeated events are suppressed', t => {
  const temp = mkdtempSync(join(tmpdir(), 'behavior-hook-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const env = { ...process.env, CONQUISTADOR_HOME: temp, CONQUISTADOR_STATE: temp, CONQUISTADOR_CACHE: temp, CONQUISTADOR_PLAYBOOKS: '', CONQUISTADOR_HOOKS: '', GROK_HOOK_EVENT: '' };
  const run = (event, input) => {
    const result = spawnSync(process.execPath, [join(root, 'hooks/conquistador-hook.mjs'), 'codex', event], { env, cwd: temp, input: JSON.stringify(input), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim() ? JSON.parse(result.stdout) : null;
  };
  for (const prompt of negative) assert.equal(run('prompt', { prompt }), null);
  const input = { prompt: '/conquistador outreach Write a cold email', session_id: 'bounded', transcript_path: join(temp, 'transcript') };
  writeFileSync(input.transcript_path, '');
  const first = run('prompt', input);
  assert.ok(first?.hookSpecificOutput?.additionalContext.length <= 1500);
  assert.equal(run('prompt', input), null);
  writeFileSync(input.transcript_path, JSON.stringify({ type: 'assistant', message: { content: 'Draft' } }) + '\n');
  assert.equal(run('stop', { ...input, last_assistant_message: 'Draft', stop_hook_active: false }), null);
  assert.equal(run('start', {}), null);
});

test('project and native hooks share one event owner; rotation restores guidance', async t => {
  const { promptAdvice } = await import('./prompt-advice.mjs');
  const temp = mkdtempSync(join(tmpdir(), 'behavior-events-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const old = process.env.CONQUISTADOR_STATE;
  process.env.CONQUISTADOR_STATE = join(temp, 'state');
  t.after(() => { if (old === undefined) delete process.env.CONQUISTADOR_STATE; else process.env.CONQUISTADOR_STATE = old; });
  const input = { prompt: '/conquistador outreach Write a cold email', session_id: 'shared', cwd: temp, transcript_path: join(temp, 'transcript') };
  writeFileSync(input.transcript_path, 'initial\n');
  assert.ok(promptAdvice(input, { root }));
  const config = { schemaVersion: 1, enabled: true, events: ['prompt-submitted'] };
  assert.deepEqual(advisory('prompt-submitted', config, { prompt: input.prompt, input, packageRoot: root }).instructions, []);
  writeFileSync(input.transcript_path, 'rotated\n');
  assert.ok(promptAdvice(input, { root }));
});

test('public tool envelopes include provenance within the total context budget', () => {
  const api = createConquistador();
  for (const [task, maximum] of [['Shorten the subject line of this cold email', 4000], ['Plan our go-to-market strategy', 16000]]) {
    const result = api.callTool('conquistador_brief', { task });
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= maximum, task);
    for (const item of result.structuredContent.inlined) assert.ok(result.content[0].text.includes(`File: ${item.path}`));
  }
});

test('a launch mentioned as the subject of a post does not start a launch workflow', () => {
  const app = createConquistador();
  for (const task of ['Write a LinkedIn post about our product launch', 'Write a LinkedIn post announcing our analytics launch']) {
    const brief = app.callTool('conquistador_brief', { task }).structuredContent;
    assert.equal(brief.command, 'social');
    assert.equal(brief.play, null);
  }
});
