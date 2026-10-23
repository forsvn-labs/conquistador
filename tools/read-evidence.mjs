// Full-file evidence checks shared by advisory context reuse and offline verification.
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

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

