#!/usr/bin/env node
// After the agent writes or edits a marketing file, run `conquistador check` on it and
// return the findings to the agent. Claude Code, Codex, and Grok: PostToolUse additional context.
// Cursor: postToolUse `additional_context`. GitHub Copilot CLI: postToolUse `additionalContext`.
// The hook never blocks: every path exits 0. It is silent on code, docs, clean files, and
// findings it already reported for the same file in this session.
// Turn it off with CONQUISTADOR_HOOKS=off or {"hooks": false} in ~/.conquistador/config.json.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { detectChannel, isMarketingFile } from '../tools/check/channels.mjs';
import { extractDocument, scannableExtensions } from '../tools/check/extract.mjs';
import { checkDocument, counted, globToRegExp, loadConfig } from '../tools/check/index.mjs';

// Usage: check-hook.mjs <claude|codex|cursor|copilot|grok> edit
const [client = 'claude'] = process.argv.slice(2);

const maxFindings = 12;

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

    const timer = setTimeout(() => finish(null), 1000);

    process.stdin.on('data', chunk => {
      size += chunk.length;

      if (size <= 4_194_304) chunks.push(chunk);
    });
    process.stdin.on('end', () => { try { finish(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { finish(null); } });
    process.stdin.on('error', () => finish(null));
  });
}

// Copilot sends its tool arguments as toolArgs, as a JSON string or an object.
function toolArgs(input) {
  const value = input.toolArgs;

  if (value && String(value) === value) {
    try { return JSON.parse(value); } catch { return {}; }
  }

  return value ?? {};
}

// File paths from Claude Code Write/Edit/MultiEdit, Cursor Write, Codex apply_patch, Copilot edit
// and create, and Grok search_replace and write_file.
function editedFiles(input, root) {
  const tool = input.tool_input ?? input.toolInput ?? input.input ?? toolArgs(input);
  const found = [];
  const direct = [tool.file_path, tool.path, tool.target_file, tool.filePath, input.file_path];

  for (const value of direct) if (value && String(value) === value) found.push(value);
  const patchText = [tool.command, tool.patch, tool.input, tool.content && /^\*\*\* Begin Patch/m.test(tool.content) ? tool.content : null].flat().filter(value => value && String(value) === value).join('\n');

  for (const match of patchText.matchAll(/^\*\*\* (?:Update|Add) File: (.+?)\s*$/gm)) found.push(match[1]);

  for (const match of patchText.matchAll(/^\*\*\* Move to: (.+?)\s*$/gm)) found.push(match[1]);

  return [...new Set(found.map(path => (isAbsolute(path) ? path : resolve(root, path))))];
}

const stateFile = input => {
  const key = String(input.session_id ?? input.conversation_id ?? input.sessionId ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);

  return key ? join(process.env.CONQUISTADOR_STATE || process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA || join(tmpdir(), 'conquistador-hooks'), 'check', `${key}.json`) : null;
};

function readState(path) {
  try { return path ? JSON.parse(readFileSync(path, 'utf8')) : {}; } catch { return {}; }
}

function writeState(path, state) {
  if (!path) return;

  try {
    mkdirSync(join(path, '..'), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(state), { mode: 0o600 });
  } catch { /* State is best effort; without it the hook may repeat itself once. */ }
}

const signature = findings => createHash('sha256').update(findings.map(finding => `${finding.rule}:${finding.snippet}`).join('\n')).digest('hex').slice(0, 16);

function report(file, findings, advisory) {
  const shown = findings.slice(0, maxFindings);
  const lines = [`Conquistador check found ${findings.length} issue${findings.length === 1 ? '' : 's'} in ${file}${advisory ? ` (plus ${advisory} advisory)` : ''}:`];

  for (const finding of shown) lines.push(`- L${finding.line} [${finding.rule}] ${finding.message} "${finding.snippet}" Fix: ${finding.fix}`);

  if (findings.length > shown.length) lines.push(`- ...and ${findings.length - shown.length} more. Run \`conquistador check ${file}\` for the full list.`);
  lines.push(
    '',
    'Fix real problems now. Never invent a source, number, or quote to clear a claim finding: ask the user for the source, or cut the claim.',
    'If a finding is intentional, add `<!-- conquistador-disable-next-line <rule>: <reason> -->` above the line and tell the user.',
    'After your fixes, this hook rechecks the file once more; it does not repeat the same findings.',
  );

  return lines.join('\n');
}

function payload(text) {
  if (client === 'cursor') return { additional_context: text };

  if (client === 'copilot') return { additionalContext: text };

  return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } };
}

const emit = value => new Promise(done => (value ? process.stdout.write(`${JSON.stringify(value)}\n`, () => done()) : done()));

async function main() {
  if (disabled()) return;
  const input = await readInput();

  if (!input || (input.tool_response && input.tool_response.success === false)) return;
  const root = input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd();
  const files = editedFiles(input, root).filter(file => scannableExtensions.includes(extname(file).toLowerCase()) && existsSync(file));

  if (!files.length) return;
  const config = loadConfig(root);
  const statePath = stateFile(input);
  const state = readState(statePath);
  const messages = [];

  for (const file of files) {
    if (statSync(file).size > 2 * 1024 * 1024) continue;
    const display = relative(root, file).startsWith('..') ? file : relative(root, file);
    const document = extractDocument(readFileSync(file, 'utf8'), extname(file));

    if (!isMarketingFile(display, document)) continue;

    if (config.ignoreFiles.some(glob => globToRegExp(glob).test(display.split('\\').join('/')))) continue;
    const channel = detectChannel(display, document, null);
    const all = checkDocument(document, { channel, file: display, ignoreRules: config.ignoreRules });
    const findings = all.filter(counted);
    const key = signature(findings);

    if (!findings.length) { delete state[file]; continue; }

    if (state[file] === key) continue;
    state[file] = key;
    messages.push(report(display, findings, all.length - findings.length));
  }

  writeState(statePath, state);

  if (messages.length) await emit(payload(messages.join('\n\n')));
}

try { await main(); } catch { /* A hook error must never block the host. */ }

process.exitCode = 0;
