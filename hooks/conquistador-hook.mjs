#!/usr/bin/env node
// Plugin hooks for Claude Code, Codex, and Cursor.
//   prompt: brief relevant requests and inject the must-read playbook list.
//   stop:   if the agent answered without reading those playbooks, send it back once.
//   start:  (Cursor) state the protocol, because Cursor cannot inject context per prompt.
// Hooks never fail the host: every error path exits 0 with no output.
// Turn them off with CONQUISTADOR_HOOKS=off or {"hooks": false} in ~/.conquistador/config.json.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [client = 'claude', event = 'prompt'] = process.argv.slice(2);
const STATE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_TRANSCRIPT = 32 * 1024 * 1024;

function disabled() {
  const flag = String(process.env.CONQUISTADOR_HOOKS ?? '').toLowerCase();
  if (['0', 'off', 'false', 'no', 'disabled'].includes(flag)) return true;
  try {
    const config = JSON.parse(readFileSync(join(process.env.CONQUISTADOR_HOME || join(homedir(), '.conquistador'), 'config.json'), 'utf8'));
    return config.hooks === false;
  } catch { return false; }
}

function readInput() {
  return new Promise(done => {
    const chunks = [];
    let size = 0;
    const finish = value => { clearTimeout(timer); done(value); };
    const timer = setTimeout(() => finish(null), 2000);
    process.stdin.on('data', chunk => { size += chunk.length; if (size <= 1_048_576) chunks.push(chunk); });
    process.stdin.on('end', () => { try { finish(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { finish(null); } });
    process.stdin.on('error', () => finish(null));
  });
}

const stateDirectory = () => join(process.env.CONQUISTADOR_STATE || process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA || join(tmpdir(), 'conquistador-hooks'), 'sessions');
const sessionKey = input => String(input.session_id ?? input.conversation_id ?? input.sessionId ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
const statePath = input => { const key = sessionKey(input); return key ? join(stateDirectory(), `${key}.json`) : null; };

function saveState(input, value) {
  const path = statePath(input);
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
  // Drop stale sessions so state never leaks into a later, unrelated session.
  try {
    for (const name of readdirSync(dirname(path))) {
      const file = join(dirname(path), name);
      if (Date.now() - statSync(file).mtimeMs > STATE_TTL_MS) rmSync(file, { force: true });
    }
  } catch { /* Cleanup is best effort. */ }
}

function loadState(input) {
  const path = statePath(input);
  if (!path) return null;
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    return Date.now() - value.createdAt > STATE_TTL_MS ? null : value;
  } catch { return null; }
}

// Pipes are asynchronous on macOS: wait for the write before exiting.
const emit = value => new Promise(done => (value ? process.stdout.write(`${JSON.stringify(value)}\n`, () => done()) : done()));

const digest = text => createHash('sha256').update(text).digest('hex');

const normalizeText = text => text.replace(/\r\n/g, '\n').trim();

// oxlint-disable-next-line anti-slop/no-runtime-typeof -- Decode untrusted hook and transcript JSON objects before inspecting their fields.
const object = value => value && typeof value === 'object' && !Array.isArray(value);

function parseObject(value) {
  if (object(value)) return value;

  try {
    const parsed = JSON.parse(value);

    return object(parsed) ? parsed : null;
  } catch { return null; }
}

function records(transcript) {
  return transcript.split('\n').flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; } // Incomplete host writes are not evidence.
  });
}

// Only recognized transcript envelopes are inspected. Assistant prose, hook context, arbitrary
// nested objects, and JSON-looking text inside a result cannot introduce tool calls.
function wireItems(record) {
  if (!object(record)) return [];

  if (record.type === 'response_item' || record.type === 'event_msg') return wireItems(record.payload);
  const content = record.message?.content ?? record.content;
  const role = record.message?.role ?? record.role ?? record.type;

  if (Array.isArray(content) && ['assistant', 'user'].includes(role)) {
    return content.filter(item => role === 'assistant' ? callTypes.has(item.type) : resultTypes.has(item.type));
  }

  return [record];
}

function userTexts(record) {
  if (!object(record) || record.isMeta === true) return [];

  if (record.type === 'response_item' || record.type === 'event_msg') return userTexts(record.payload);

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate text in the untrusted host user-message envelope before using it as task scope.
  if (record.type === 'user_message' && typeof record.message === 'string') return [record.message];

  if (record.type !== 'user' && record.role !== 'user' && record.message?.role !== 'user') return [];
  const content = record.message?.content ?? record.content;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Decode the host transcript content union before checking task scope.
  if (typeof content === 'string') return content.includes('<conquistador-brief>') ? [] : [content];

  if (!Array.isArray(content) || content.some(item => item.type === 'tool_result')) return [];

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Only string text blocks from the untrusted host transcript can establish a human prompt.
  return content.filter(item => ['text', 'input_text'].includes(item.type) && typeof item.text === 'string')
    .map(item => item.text).filter(text => !text.includes('<conquistador-brief>'));
}

function transcriptSnapshot(input) {
  try {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the host-supplied transcript path before any filesystem access.
    if (typeof input.transcript_path !== 'string') return null;
    const path = resolve(input.transcript_path);

    if (statSync(path).size > MAX_TRANSCRIPT) return null;
    const bytes = readFileSync(path);

    return { path, bytes: bytes.length, sha256: digest(bytes) };
  } catch { return null; }
}

// A saved byte boundary is preferred; a new timestamped exact human prompt is the fallback. If the
// transcript was rotated, exceeded the cap, or cannot be scoped, fail open without claiming reads.
export function currentTaskTranscript(state, transcript, path) {
  let scoped = transcript;

  if (state.transcript) {
    const bytes = Buffer.from(transcript);
    const boundary = state.transcript;

    if (resolve(path || '') !== boundary.path || bytes.length < boundary.bytes || digest(bytes.subarray(0, boundary.bytes)) !== boundary.sha256) return null;
    scoped = bytes.subarray(boundary.bytes).toString('utf8');
  }

  const lines = scoped.split('\n');
  let matched = Boolean(state.transcript);
  let start = 0;

  for (let index = 0; index < lines.length; index++) {
    let record;

    try { record = JSON.parse(lines[index]); } catch { continue; }

    const texts = userTexts(record);

    if (!texts.length) continue;
    const timestamp = Date.parse(record.timestamp ?? record.payload?.timestamp ?? '');
    const fresh = Boolean(state.transcript) || Number.isFinite(state.createdAt) && timestamp >= state.createdAt;

    if (fresh && texts.some(text => digest(normalizeText(text)) === state.promptSha256)) {
      matched = true;
      start = index + 1;
    } else {
      // A newer human request is never held to a previous task's reading list.
      matched = false;
      start = index + 1;
    }
  }

  return matched ? lines.slice(start).join('\n') : null;
}

const callTypes = new Set(['tool_use', 'server_tool_use', 'mcp_tool_use', 'function_call', 'custom_tool_call', 'local_shell_call', 'tool_call', 'toolCall', 'mcp_tool_call']);

const resultTypes = new Set(['tool_result', 'function_call_output', 'custom_tool_call_output', 'local_shell_call_output', 'tool_output', 'tool_call_result', 'toolResult', 'mcp_tool_result']);

function toolKind(name) {
  if (/(?:^|__)conquistador_brief$/.test(name)) return 'brief';

  if (/(?:^|__)conquistador_read$/.test(name)) return 'read';

  if (['Read', 'read_file', 'readFile'].includes(name)) return 'read';

  if (['Bash', 'bash', 'exec_command', 'shell_command', 'shell', 'local_shell'].includes(name) || /(?:^|[.])exec_command$/.test(name)) return 'shell';

  return null;
}

function failed(value) {
  if (!object(value)) return false;

  if (value.is_error === true || value.isError === true || value.error || value.session_id != null) return true;

  if (['error', 'failed', 'cancelled', 'canceled', 'in_progress', 'running'].includes(value.status)) return true;

  if (value.exit_code != null && value.exit_code !== 0 || value.exitCode != null && value.exitCode !== 0) return true;

  return ['content', 'result', 'output', 'data'].some(key => {
    if (Array.isArray(value[key])) return value[key].some(failed);
    const nested = parseObject(value[key]);

    return nested ? failed(nested) : false;
  });
}

function resultTexts(value) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Decode the host tool-result union at the transcript input boundary without coercion.
  if (typeof value === 'string') {
    const parsed = parseObject(value);

    return parsed ? resultTexts(parsed) : [value];
  }

  if (Array.isArray(value)) return value.flatMap(resultTexts);

  if (!object(value)) return [];

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate untrusted tool-result text blocks before accepting returned content.
  if (typeof value.text === 'string' && ['text', 'output_text', undefined].includes(value.type)) return [value.text];

  for (const key of ['content', 'output', 'result', 'data', 'stdout']) if (value[key] !== undefined) return resultTexts(value[key]);

  return [];
}

function resultFailed(node, texts) {
  if (failed(node)) return true;

  return texts.some(text => /(?:Process exited with code|exit code:)\s*[1-9]\d*\b|(?:Process|Script) running with (?:session|cell) ID|Command running in background/i.test(text));
}

function packFileEvidence(text) {
  const files = [];

  for (const match of text.matchAll(/<!-- conquistador-file ([^\n]+) -->\n/g)) {
    const evidence = parseObject(match[1]);

    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate identifiers decoded from untrusted transcript evidence markers before matching files.
    if (!evidence || typeof evidence.id !== 'string') continue;

    if (['omitted', 'unavailable'].includes(evidence.status)) { files.push(evidence); continue; }

    if (evidence.status !== 'complete') continue;
    const start = match.index + match[0].length;
    const end = text.indexOf('\n<!-- /conquistador-file -->', start);

    if (end < 0) { files.push({ ...evidence, status: 'truncated' }); continue; }

    const body = normalizeText(text.slice(start, end));
    files.push(evidence.bytes === Buffer.byteLength(body) && evidence.sha256 === digest(body) ? evidence : { ...evidence, status: 'incomplete' });
  }

  return files;
}

function pathMatches(item, path) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate paths decoded from untrusted host call arguments before matching file identities.
  if (typeof path !== 'string') return false;
  const clean = path.replace(/\\/g, '/').replace(/^\.\//, '');
  const id = item.path.replace(/\\/g, '/');

  // Whole library IDs may be rebased by a host cache; basename/tail substrings never count.
  return clean === item.absolute.replace(/\\/g, '/') || clean === id ||
    (!id.startsWith('/') && (clean.endsWith(`/${id}`) || clean === id.replace(/^skills\//, '')));
}

function pathsFromCall(call) {
  const args = parseObject(call.arguments) ?? call.arguments;

  if (!object(args)) return [];

  if (call.kind === 'read') return [args.file_path ?? args.path ?? args.file];
  const command = args.command ?? args.cmd;
  const text = Array.isArray(command) ? command.join(' ') : command;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate the untrusted host shell-command representation before extracting path tokens.
  if (typeof text !== 'string' || !/(?:^|[\s;&|])(?:cat|sed|head|tail)\s/.test(text)) return [];

  // Quoted filenames and whole unquoted tokens only. The returned content must also match.
  return [...text.matchAll(/"([^"\n]+)"|'([^'\n]+)'|([^\s;&|<>]+)/g)].map(match => match[1] ?? match[2] ?? match[3]);
}

function bodyReturned(texts, body) {
  const expected = `\n${body}\n`;

  return texts.some(text => {
    const normalized = normalizeText(text);

    if (`\n${normalized}\n`.includes(expected)) return true;
    // Claude's Read tool numbers lines. Only an uninterrupted run beginning at 1 is full text.
    let numbered = [];

    for (const line of normalized.split('\n')) {
      const match = /^\s*(\d+)[\t→](.*)$/.exec(line);

      if (match && Number(match[1]) === numbered.length + 1) numbered.push(match[2]);
      else if (numbered.length) break;
    }

    return numbered.length > 0 && normalizeText(numbered.join('\n')) === body;
  });
}

// Evidence means a successful paired tool result returned the complete selected bytes. It is
// neither a measure of model attention nor proof that an answer applies the playbook well.
export function unreadFiles(state, transcript) {
  const pending = new Map();
  const seen = new Set();
  const covered = new Set();
  const bodies = new Map();
  const statuses = new Map(state.must.map(item => [item.path, item.status === 'unavailable' ? 'unavailable' : 'missing']));

  for (const item of state.must) {
    try {
      if (statSync(item.absolute).size > 1_000_000) continue;
      const body = normalizeText(readFileSync(item.absolute, 'utf8'));

      if (body && item.sha256 === digest(body) && item.bytes === Buffer.byteLength(body)) bodies.set(item.path, body);
    } catch { statuses.set(item.path, 'unavailable'); }
  }

  for (const record of records(transcript)) for (const node of wireItems(record)) {
    if (!object(node)) continue;

    if (callTypes.has(node.type)) {
      const id = node.call_id ?? node.id ?? node.tool_call_id;
      const name = node.name ?? node.tool ?? (node.type === 'local_shell_call' ? 'local_shell' : '');
      const kind = toolKind(name);

      // Duplicate IDs are ambiguous; never let a later call inherit an earlier result.
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate untrusted host tool-call identifiers before correlating transcript results.
      if (typeof id !== 'string' || !kind || seen.has(id)) { if (id) pending.delete(id); continue; }

      seen.add(id);
      pending.set(id, { kind, arguments: node.input ?? node.arguments ?? node.action ?? node.args ?? node.parameters });
    } else if (resultTypes.has(node.type)) {
      const id = node.tool_use_id ?? node.call_id ?? node.tool_call_id ?? node.id;
      const call = pending.get(id);
      pending.delete(id);

      if (!call) continue;
      const texts = resultTexts(node);
      const paths = pathsFromCall(call);
      const targets = state.must.filter(item => paths.some(path => pathMatches(item, path)));

      if (resultFailed(node, texts)) {
        for (const item of targets) statuses.set(item.path, 'failed');
        continue;
      }

      if (call.kind === 'brief') {
        for (const evidence of texts.flatMap(packFileEvidence)) {
          const item = state.must.find(item => item.path === evidence.id);

          if (!item) continue;

          if (evidence.status === 'complete' && item.sha256 === evidence.sha256 && item.bytes === evidence.bytes) covered.add(item.path);
          else statuses.set(item.path, evidence.status === 'complete' ? 'incomplete' : evidence.status);
        }
      } else {
        for (const item of targets) {
          if (bodies.has(item.path) && bodyReturned(texts, bodies.get(item.path))) covered.add(item.path);
          else if (texts.length) statuses.set(item.path, 'incomplete');
        }
      }
    }
  }

  return state.must.filter(item => !covered.has(item.path)).map(item => ({ ...item, evidenceStatus: statuses.get(item.path) }));
}

async function onPrompt(input) {
  const prompt = input.prompt ?? input.user_prompt ?? input.text;
  if (typeof prompt !== 'string' || !prompt.trim()) return client === 'cursor' ? { continue: true } : null;
  const previous = statePath(input);

  if (previous) rmSync(previous, { force: true });
  const { createBrief, formatReadingList, knowledgeFileEvidence } = await import('../tools/brief.mjs');
  const brief = createBrief(prompt.slice(0, 32_000), { root: pluginRoot });
  if (brief.action !== 'brief') return client === 'cursor' ? { continue: true } : null;
  const must = [...(brief.play ? [brief.play] : []), ...brief.methods, ...brief.must].map(item => ({
    absolute: item.absolute,
    path: item.path,
    ...knowledgeFileEvidence(item),
  }));

  saveState(input, { createdAt: Date.now(), promptSha256: digest(normalizeText(prompt)), transcript: transcriptSnapshot(input), methods: brief.methods.map(item => item.name), play: brief.play?.name ?? null, must, enforced: false });
  if (client === 'cursor') return { continue: true };
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: formatReadingList(brief) } };
}

function onStop(input) {
  if (input.stop_hook_active === true || Number(input.loop_count ?? 0) > 0) return null;
  const state = loadState(input);
  if (!state || state.enforced || !state.must?.length) return null;
  const last = String(input.last_assistant_message ?? '');
  // A short clarifying question is a legitimate stop before any drafting.
  if (last && last.length < 600 && last.trim().endsWith('?')) return null;
  let transcript = '';
  try {
    const path = input.transcript_path;
    if (typeof path === 'string' && statSync(path).size <= MAX_TRANSCRIPT) transcript = readFileSync(path, 'utf8');
  } catch { return null; }
  if (!transcript) return null;
  const current = currentTaskTranscript(state, transcript, input.transcript_path);

  if (current === null) return null;
  const unread = unreadFiles(state, current);
  if (!unread.length) return null;
  saveState(input, { ...state, enforced: true });
  const reason = [
    'Conquistador: the current task transcript does not verify complete successful reads of these selected playbooks.',
    'Read the available files in full now, disclose any unavailable files, then revise your answer to apply their specific rules and end with "Playbooks applied":',
    ...unread.map(item => `- ${item.absolute} (${item.evidenceStatus})`),
  ].join('\n');
  if (client === 'cursor') return { followup_message: reason };
  return { decision: 'block', reason };
}

function onStart() {
  const text = 'Conquistador is installed. For growth, GTM, launch, marketing, sales, pricing, positioning, copy, content, SEO, ads, or outreach work: call the conquistador_brief MCP tool with the task before drafting, read the whole result, apply its playbooks, and end with "Playbooks applied". For other work, ignore this.';
  if (client === 'cursor') return { additional_context: text };
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!disabled()) {
      const input = await readInput();
      if (input && typeof input === 'object') {
        if (event === 'prompt') await emit(await onPrompt(input));
        else if (event === 'stop') await emit(onStop(input));
        else if (event === 'start') await emit(onStart());
      }
    }
  } catch (error) {
    if (process.env.CONQUISTADOR_DEBUG) process.stderr.write(`[conquistador hook] ${error.stack}\n`);
  }
  process.exit(0);
}
