#!/usr/bin/env node
// Plugin hooks for Claude Code, Codex, Cursor, and GitHub Copilot CLI.
//   prompt: brief relevant requests and inject the must-read playbook list.
//   stop:   silent; automatic advice never blocks completion.
//   start:  silent until a relevant request arrives.
// Copilot and Grok get no stop gate: their transcript formats are not verified, and the read
// check counts an unknown format as "nothing read", which would block a good answer.
// Grok discards prompt-hook output, so inside Grok (GROK_HOOK_EVENT is set) only the copy check runs.
// Hooks never fail the host: every error path exits 0 with no output.
// Turn them off with CONQUISTADOR_HOOKS=off or {"hooks": false} in ~/.conquistador/config.json.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hooksEnabled, promptAdvice } from '../tools/prompt-advice.mjs';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [named = 'claude', event = 'prompt'] = process.argv.slice(2);
// Grok also runs Claude-format hooks it finds; it marks every hook with GROK_HOOK_EVENT.
const client = process.env.GROK_HOOK_EVENT ? 'grok' : named;

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

// Pipes are asynchronous on macOS: wait for the write before exiting.
const emit = value => new Promise(done => (value ? process.stdout.write(`${JSON.stringify(value)}\n`, () => done()) : done()));

export { currentTaskTranscript, unreadFiles } from '../tools/read-evidence.mjs';

async function onPrompt(input) {
  if (client === 'grok') return null;
  const context = promptAdvice(input, { root: pluginRoot });
  if (client === 'cursor') return context ? { continue: true, additional_context: context } : { continue: true };
  if (!context) return null;
  if (client === 'copilot') return { additionalContext: context };
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context } };
}

// Automatic relevance is advisory. A missing read must never block completion.
function onStop() { return null; }
function onStart() { return null; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (hooksEnabled()) {
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
