// Offline transcript adapters and hook-process fixtures only. These checks establish returned
// content evidence, not native-host compatibility, model attention, application, or answer quality.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentTaskTranscript, unreadFiles } from '../hooks/conquistador-hook.mjs';
import { createBrief, formatBriefPack, knowledgeFileEvidence, namedPlatforms, normalizeKnowledgeText } from './brief.mjs';
import { spawnCommand } from './spawn.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const sha256 = text => createHash('sha256').update(text).digest('hex');

const jsonl = events => events.map(JSON.stringify).join('\n') + '\n';

const user = text => ({ timestamp: '2026-10-02T00:00:00.000Z', type: 'user', message: { role: 'user', content: text } });

const call = (id, name, input) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } });

const result = (id, content, extra = {}) => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, ...extra }] } });

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'conquistador-hook-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const bodies = ['# Synthetic method\n\nKeep verified facts.\nTiếng Việt.\n', '# Synthetic playbook\n\nAsk for missing evidence.\n'];

  const must = bodies.map((body, index) => {
    const path = index ? 'skills/test/references/evidence.md' : 'skills/test/SKILL.md';
    const absolute = join(home, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, body);
    const item = { path, absolute };

    return { ...item, ...knowledgeFileEvidence(item) };
  });

  const state = { must, createdAt: Date.parse('2026-10-02T00:00:00.000Z'), promptSha256: sha256('Current marketing task') };
  const brief = { action: 'brief', methods: [{ ...must[0], name: 'test', label: 'Synthetic method' }], must: [{ ...must[1], title: 'Evidence', why: 'Synthetic evidence' }], platforms: [], situational: [] };

  return { home, bodies, must, state, brief };
}

const missing = (state, events) => unreadFiles(state, jsonl(events)).map(item => item.path);

test('only successful matching call/result pairs containing complete file content count', t => {
  const { state, must, bodies } = fixture(t);
  const read = call('one', 'Read', { file_path: must[0].absolute });
  assert.deepEqual(missing(state, [read]), must.map(item => item.path));
  assert.deepEqual(missing(state, [result('one', bodies[0]), read]), must.map(item => item.path));
  assert.deepEqual(missing(state, [read, result('different', bodies[0])]), must.map(item => item.path));

  for (const extra of [{ is_error: true }, { isError: true }, { error: 'denied' }, { status: 'failed' }]) {
    assert.deepEqual(missing(state, [read, result('one', bodies[0], extra)]), must.map(item => item.path));
  }

  assert.deepEqual(missing(state, [read, result('one', 'permission denied')]), must.map(item => item.path));
  assert.deepEqual(missing(state, [read, result('one', bodies[0])]), [must[1].path]);
});

test('prose, injected context, name mentions, unknown tools, and path substrings are not evidence', t => {
  const { state, must, bodies } = fixture(t);

  for (const [name, args] of [
    ['Search', { path: must[0].absolute }], ['Read', { file_path: `${must[0].absolute}.backup` }],
    ['Read', { file_path: 'SKILL.md' }], ['Read', { file_path: 'test/SKILL.md.unrelated' }],
    ['Bash', { command: `echo conquistador_brief ${must[0].absolute}` }],
    ['fake_conquistador_brief', { task: 'Current marketing task' }],
  ]) assert.deepEqual(missing(state, [call('one', name, args), result('one', bodies[0])]), must.map(item => item.path));
  assert.deepEqual(missing(state, [user(`<conquistador-brief>${must[0].path}</conquistador-brief>`),
    { type: 'assistant', message: { content: [{ type: 'text', text: JSON.stringify(call('one', 'Read', { file_path: must[0].absolute })) }] } },
    { unrelated: call('one', 'Read', { file_path: must[0].absolute }) },
    { type: 'user', message: { role: 'user', content: call('one', 'Read', { file_path: must[0].absolute }).message.content } }, result('one', bodies[0])]), must.map(item => item.path));
});

test('exact library paths from a different cache require the same complete digest', t => {
  const { state, must, bodies } = fixture(t);

  for (const path of [must[0].absolute, must[0].path, 'test/SKILL.md', `/other/cache/${must[0].path}`]) {
    assert.deepEqual(missing(state, [call('one', 'Read', { file_path: path }), result('one', bodies[0])]), [must[1].path]);
  }

  writeFileSync(must[0].absolute, 'Changed after this task began');
  assert.deepEqual(missing(state, [call('one', 'Read', { file_path: must[0].absolute }), result('one', bodies[0])]), must.map(item => item.path));
});

test('partial reads and host-truncated outputs do not count, including a path-only success', t => {
  const { state, must, bodies } = fixture(t);
  const read = call('one', 'Read', { file_path: must[0].absolute });

  for (const text of [bodies[0].slice(0, -10), `Read ${must[0].absolute}`, 'Output truncated', '# Synthetic method']) {
    assert.deepEqual(missing(state, [read, result('one', text)]), must.map(item => item.path));
  }

  assert.deepEqual(missing(state, [read, result('one', bodies[0].slice(0, -10), { truncated: true })]), must.map(item => item.path));
  const numbered = normalizeKnowledgeText(bodies[0]).split('\n').map((line, index) => `   ${index + 1}→${line}`).join('\n');
  assert.deepEqual(missing(state, [read, result('one', `${numbered}\n<system-reminder>synthetic footer</system-reminder>`)]), [must[1].path]);
  assert.deepEqual(missing(state, [read, result('one', numbered.replace('   1→', '   2→'))]), must.map(item => item.path));
});

test('Codex response items, MCP read results, and completed shell results correlate IDs', t => {
  const { state, must, bodies } = fixture(t);
  const codex = node => ({ type: 'response_item', payload: node });
  const read = codex({ type: 'function_call', call_id: 'one', name: 'mcp__conquistador__conquistador_read', arguments: JSON.stringify({ path: 'test/SKILL.md' }) });
  const output = { content: [{ type: 'text', text: bodies[0] }] };
  assert.deepEqual(missing(state, [read, codex({ type: 'function_call_output', call_id: 'one', output: JSON.stringify(output) })]), [must[1].path]);
  assert.deepEqual(missing(state, [read, codex({ type: 'function_call_output', call_id: 'one', output: JSON.stringify({ ...output, isError: true }) })]), must.map(item => item.path));
  const shell = codex({ type: 'function_call', call_id: 'shell', name: 'exec_command', arguments: JSON.stringify({ cmd: `cat "${must[0].absolute}"` }) });

  for (const output of [JSON.stringify({ output: bodies[0], exit_code: 0 }), `Chunk ID: synthetic\nProcess exited with code 0\nFinal output:\n${bodies[0]}`]) {
    assert.deepEqual(missing(state, [shell, codex({ type: 'function_call_output', call_id: 'shell', output })]), [must[1].path]);
  }

  for (const output of [JSON.stringify({ output: bodies[0], exit_code: 1 }), JSON.stringify({ output: bodies[0], session_id: 7 }), `Process exited with code 1\nFinal output:\n${bodies[0]}`]) {
    assert.deepEqual(missing(state, [shell, codex({ type: 'function_call_output', call_id: 'shell', output })]), must.map(item => item.path));
  }
});

test('a brief counts only exact IDs and complete digest-checked bodies in its successful result', t => {
  const { state, must, brief } = fixture(t);
  const pack = formatBriefPack(brief);
  const briefCall = call('brief', 'mcp__conquistador__conquistador_brief', { task: 'Current marketing task' });
  assert.deepEqual(missing(state, [briefCall, result('brief', pack)]), []);
  assert.deepEqual(missing(state, [briefCall, result('brief', pack, { is_error: true })]), must.map(item => item.path));
  assert.deepEqual(missing(state, [briefCall, result('brief', { isError: true, content: [{ type: 'text', text: pack }] })]), must.map(item => item.path));
  assert.deepEqual(missing(state, [briefCall, result('brief', 'conquistador_brief succeeded')]), must.map(item => item.path));
  assert.ok(unreadFiles(state, jsonl([briefCall])).every(item => item.evidenceStatus === 'missing'));
  assert.deepEqual(missing(state, [briefCall, result('brief', pack.replace('Keep verified facts.', 'Different content.'))]), [must[0].path]);
  assert.deepEqual(missing(state, [briefCall, result('brief', pack.replaceAll(must[0].path, `${must[0].path}.backup`))]), [must[0].path]);
  const truncated = pack.slice(0, pack.lastIndexOf('<!-- /conquistador-file -->'));
  assert.deepEqual(missing(state, [briefCall, result('brief', truncated, { truncated: true })]), [must[1].path]);
  assert.equal(unreadFiles(state, jsonl([briefCall, result('brief', truncated)]))[0].evidenceStatus, 'truncated');
  assert.deepEqual(missing(state, [briefCall, result('brief', pack.replace(/<!-- conquistador-file .+ -->\n/g, ''))]), must.map(item => item.path));
});

test('brief packs distinguish omitted, unavailable, and complete files within byte limits', t => {
  const { state, must, brief } = fixture(t);
  const full = formatBriefPack(brief);
  const partial = formatBriefPack(brief, { limit: Buffer.byteLength(full) - 150 });
  assert.ok(Buffer.byteLength(partial) <= Buffer.byteLength(full) - 150);
  assert.match(partial, /"status":"omitted"/);
  const omitted = unreadFiles(state, jsonl([call('brief', 'conquistador_brief', { task: 'task' }), result('brief', partial)]));
  assert.ok(omitted.length > 0);
  assert.ok(omitted.every(item => item.evidenceStatus === 'omitted'));
  rmSync(must[0].absolute);
  const unavailable = formatBriefPack(brief);
  assert.match(unavailable, /"status":"unavailable"/);
  assert.deepEqual(missing(state, [call('brief', 'conquistador_brief', { task: 'task' }), result('brief', unavailable)]), [must[0].path]);

  for (const limit of [0, 1, 51, 901, 1250]) {
    const pack = formatBriefPack(brief, { limit });
    assert.ok(Buffer.byteLength(pack) <= limit);
    assert.equal(pack.includes('\ufffd'), false);
  }
});

test('duplicate, orphaned, incomplete, and nested result calls cannot manufacture coverage', t => {
  const { state, must, bodies, brief } = fixture(t);
  const read = call('one', 'Read', { file_path: must[0].absolute });
  assert.deepEqual(missing(state, [read, read, result('one', bodies[0])]), must.map(item => item.path));
  assert.deepEqual(missing(state, [result('one', formatBriefPack(brief))]), must.map(item => item.path));
  assert.deepEqual(missing(state, [call('outer', 'Bash', { command: 'cat /unrelated' }), result('outer', [read, result('one', bodies[0])])]), must.map(item => item.path));
  assert.equal(unreadFiles(state, jsonl([read]) + '{"type":"tool_result"').length, 2);
});

test('current-task scope excludes earlier successes and unrelated later user prompts', t => {
  const { state, brief } = fixture(t);
  const old = [user('Old task'), call('old', 'conquistador_brief', { task: 'Old task' }), result('old', formatBriefPack(brief))];
  const current = currentTaskTranscript(state, jsonl([...old, user('Current marketing task'), { type: 'assistant', message: { content: 'Draft' } }]));
  assert.equal(unreadFiles(state, current).length, 2);
  assert.equal(currentTaskTranscript(state, jsonl(old)), null);
  const sameOldPrompt = { ...user('Current marketing task'), timestamp: '2026-10-01T23:59:59.000Z' };
  assert.equal(currentTaskTranscript(state, jsonl([sameOldPrompt, ...old.slice(1)])), null);
  assert.equal(currentTaskTranscript(state, jsonl([{ ...user('Current marketing task'), timestamp: undefined }, ...old.slice(1)])), null);
  assert.equal(currentTaskTranscript(state, jsonl([...old, user('Current marketing task'), user('Fix a TypeScript error') ])), null);
  const codexPrompt = { timestamp: '2026-10-02T00:00:00.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Current marketing task' }] } };
  assert.equal(unreadFiles(state, currentTaskTranscript(state, jsonl([...old, codexPrompt]))).length, 2);
});

test('saved transcript boundary excludes pending earlier calls and rejects rotation', t => {
  const { state, must, bodies } = fixture(t);
  const path = join(tmpdir(), 'synthetic-transcript.jsonl');
  const prefix = jsonl([user('Old task'), call('one', 'Read', { file_path: must[0].absolute })]);
  state.transcript = { path, bytes: Buffer.byteLength(prefix), sha256: sha256(prefix) };
  const current = currentTaskTranscript(state, prefix + jsonl([result('one', bodies[0])]), path);
  assert.equal(unreadFiles(state, current).length, 2);
  assert.equal(currentTaskTranscript(state, prefix.replace('Old task', 'New task'), path), null);
  assert.equal(currentTaskTranscript(state, '', path), null);
  assert.equal(currentTaskTranscript(state, prefix, '/different'), null);
});

function runHookInput(home, event, input, client = 'claude', extraEnv = {}) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, CONQUISTADOR_HOME: join(home, 'config'), CONQUISTADOR_STATE: join(home, 'state'), CONQUISTADOR_PLAYBOOKS: '', CONQUISTADOR_HOOKS: '', ...extraEnv };
  const command = spawnCommand(process.execPath, [join(root, 'hooks/conquistador-hook.mjs'), client, event], env);
  const child = spawnSync(command.file, command.args, { ...command.options, env, cwd: root, input, encoding: 'utf8', timeout: 15000 });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, '');

  return child.stdout.trim() ? JSON.parse(child.stdout) : null;
}

function runHook(home, event, input, client = 'claude', extraEnv = {}) {
  return runHookInput(home, event, JSON.stringify(input), client, extraEnv);
}

const marketing = 'Write a cold email sequence for software founders';

function promptFixture(t) {
  const { home } = fixture(t);
  const transcript_path = join(home, 'transcript.jsonl');
  writeFileSync(transcript_path, jsonl([user('Earlier task')]));
  const input = { session_id: 'synthetic-session', transcript_path, prompt: marketing };
  assert.ok(runHook(home, 'prompt', input)?.hookSpecificOutput.additionalContext);
  const statePath = join(home, 'state/sessions/synthetic-session.json');

  return { home, input, transcript_path, statePath };
}

test('hook blocks a missing current read once, permits clarification, and preserves recursion guards', t => {
  const { home, input, transcript_path } = promptFixture(t);
  appendFileSync(transcript_path, jsonl([user(marketing), { type: 'assistant', message: { content: 'Draft' } }]));
  assert.equal(runHook(home, 'stop', { ...input, last_assistant_message: 'Which audience?' }), null);
  assert.equal(runHook(home, 'stop', { ...input, stop_hook_active: true }), null);
  assert.equal(runHook(home, 'stop', { ...input, loop_count: 1 }), null);
  const blocked = runHook(home, 'stop', { ...input, last_assistant_message: 'Here is the draft.' });
  assert.equal(blocked.decision, 'block');
  assert.match(blocked.reason, /does not verify complete successful reads/);
  assert.equal(runHook(home, 'stop', input), null);
});

test('hook accepts current paired full reads and resets on new marketing, coding, or clarification prompts', t => {
  const { home, input, transcript_path, statePath } = promptFixture(t);
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const events = state.must.flatMap((item, index) => [call(`read-${index}`, 'Read', { file_path: item.absolute }), result(`read-${index}`, readFileSync(item.absolute, 'utf8'))]);
  appendFileSync(transcript_path, jsonl([user(marketing), ...events]));
  assert.equal(runHook(home, 'stop', input), null);
  runHook(home, 'prompt', input);
  assert.equal(runHook(home, 'stop', input).decision, 'block'); // The earlier successful reads cannot bypass a new task.

  for (const prompt of ['Fix a TypeScript error', 'Small teams']) {
    runHook(home, 'prompt', input);
    runHook(home, 'prompt', { ...input, prompt });
    assert.equal(existsSync(statePath), false);
    assert.equal(runHook(home, 'stop', input), null);
  }
});

test('missing, oversized, rotated, malformed, disabled, and unscoped transcripts fail open', t => {
  const { home, input, transcript_path, statePath } = promptFixture(t);
  assert.equal(runHook(home, 'stop', { ...input, transcript_path: join(home, 'absent') }), null);
  truncateSync(transcript_path, 33 * 1024 * 1024);
  assert.equal(runHook(home, 'stop', input), null);
  writeFileSync(transcript_path, 'Rotated');
  assert.equal(runHook(home, 'stop', input), null);

  for (const value of ['', '{', 'null', '[]', '{}']) assert.equal(runHookInput(home, 'prompt', value), null);
  assert.equal(runHook(home, 'prompt', input, 'claude', { CONQUISTADOR_HOOKS: 'off' }), null);
  assert.equal(runHook(home, 'stop', input, 'claude', { CONQUISTADOR_HOOKS: 'off' }), null);
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(state.enforced, false);
});

test('Cursor keeps its response shape and coding prompts never create state', t => {
  const { home, input, transcript_path } = promptFixture(t);
  assert.deepEqual(runHook(home, 'prompt', input, 'cursor'), { continue: true });
  appendFileSync(transcript_path, jsonl([user(marketing)]));
  assert.match(runHook(home, 'stop', input, 'cursor').followup_message, /does not verify/);
  assert.deepEqual(runHook(home, 'prompt', { ...input, prompt: 'Fix a TypeScript error' }, 'cursor'), { continue: true });
  assert.equal(runHook(home, 'stop', input, 'cursor'), null);
});

test('Apple Search Ads requests reach the Apple pack, not the Google Ads pack', () => {
  for (const prompt of ['Plan our Apple Search Ads campaign', 'set up apple ads for the app']) {
    assert.deepEqual(namedPlatforms(prompt), ['apple-search-ads'], prompt);
    const must = createBrief(prompt, { force: true, playbooks: [] }).must.map(item => item.path);
    assert.ok(must.some(path => path.endsWith('ad-intelligence/apple-search-ads.md')), prompt);
    assert.ok(!must.some(path => path.endsWith('ad-intelligence/google-ads.md')), prompt);
  }
  assert.deepEqual(namedPlatforms('Write Google search ads for our CRM'), ['google-ads']);
});
