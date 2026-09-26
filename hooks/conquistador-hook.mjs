#!/usr/bin/env node
// Plugin hooks for Claude Code, Codex, and Cursor.
//   prompt: brief relevant requests and inject the must-read playbook list.
//   stop:   if the agent answered without reading those playbooks, send it back once.
//   start:  (Cursor) state the protocol, because Cursor cannot inject context per prompt.
// Hooks never fail the host: every error path exits 0 with no output.
// Turn them off with CONQUISTADOR_HOOKS=off or {"hooks": false} in ~/.conquistador/config.json.
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

// Collect the text of tool calls only. Hook-injected context and assistant prose do not count as reads.
export function toolCallText(transcript) {
  const calls = [];
  const visit = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 12) return;
    if (Array.isArray(node)) { for (const item of node) visit(item, depth + 1); return; }
    const type = node.type;
    if (['tool_use', 'server_tool_use', 'mcp_tool_use', 'function_call', 'custom_tool_call', 'local_shell_call', 'tool_call', 'toolCall', 'mcp_tool_call'].includes(type)) {
      calls.push(JSON.stringify([node.name ?? node.tool ?? '', node.input ?? node.arguments ?? node.action ?? node.args ?? node.parameters ?? '']));
      return;
    }
    if (node.toolCall || node.tool_call) calls.push(JSON.stringify(node.toolCall ?? node.tool_call));
    for (const value of Object.values(node)) if (value && typeof value === 'object') visit(value, depth + 1);
  };
  for (const line of transcript.split('\n')) {
    if (!line.trim() || line.includes('conquistador-brief>')) continue;
    try { visit(JSON.parse(line)); } catch { /* Skip partial lines. */ }
  }
  return calls.join('\n');
}

export function unreadFiles(state, calls) {
  // One brief call returns every must-read file inline.
  if (/conquistador_brief/.test(calls)) return [];
  return state.must.filter(item => ![item.absolute, item.path, item.tail].some(value => value && calls.includes(value)));
}

async function onPrompt(input) {
  const prompt = input.prompt ?? input.user_prompt ?? input.text;
  if (typeof prompt !== 'string' || !prompt.trim()) return client === 'cursor' ? { continue: true } : null;
  const { createBrief, formatReadingList } = await import('../tools/brief.mjs');
  const brief = createBrief(prompt.slice(0, 32_000), { root: pluginRoot });
  if (brief.action !== 'brief') return client === 'cursor' ? { continue: true } : null;
  const must = [...brief.methods, ...brief.must].map(item => ({
    absolute: item.absolute,
    path: item.path,
    // Hosts sometimes read through a different root (a symlinked cache or a copied skill); match the stable tail.
    tail: item.path.split('/').slice(-3).join('/'),
  }));
  saveState(input, { createdAt: Date.now(), methods: brief.methods.map(item => item.name), must, enforced: false });
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
  const unread = unreadFiles(state, toolCallText(transcript));
  if (!unread.length) return null;
  saveState(input, { ...state, enforced: true });
  const reason = [
    'Conquistador: you answered without reading the playbooks selected for this task.',
    'Read these files in full now, then revise your answer to apply their specific rules and end with "Playbooks applied":',
    ...unread.map(item => `- ${item.absolute}`),
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
