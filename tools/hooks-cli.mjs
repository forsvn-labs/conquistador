import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AGENTS, home, readState, setHooks, tilde } from './agents.mjs';

const USAGE = 'Usage: conquistador hooks on|off|status';

// The agents whose Conquistador plugin carries hooks. Skill-copy agents have none.
const HOOKED = ['claude-code', 'codex', 'cursor', 'copilot', 'grok'];

// Where the hooks setting comes from: the environment wins over ~/.conquistador/config.json.
function hooksState() {
  const flag = String(process.env.CONQUISTADOR_HOOKS ?? '').toLowerCase();
  if (['0', 'off', 'false', 'no', 'disabled'].includes(flag)) return { on: false, why: `CONQUISTADOR_HOOKS=${process.env.CONQUISTADOR_HOOKS} is set in this environment` };
  const file = join(home(), 'config.json');
  try {
    if (JSON.parse(readFileSync(file, 'utf8')).hooks === false) return { on: false, why: `"hooks": false in ${tilde(file)}` };
  } catch { /* No config: hooks are on. */ }
  return { on: true, why: null };
}

// The user-level switch. Hooks read the setting on every run, so a change applies from the next
// prompt or edit; no agent restarts.
function runSwitch(action) {
  if (action === 'on' || action === 'off') setHooks(action === 'on');
  const state = hooksState();
  const labels = AGENTS.filter(agent => HOOKED.includes(agent.id)).map(agent => agent.label);
  const installed = Object.keys(readState().agents ?? {}).filter(id => HOOKED.includes(id));
  const lines = [`Hooks are ${state.on ? 'on' : 'off'}${state.why ? ` (${state.why})` : ''}.`];
  if (action === 'on' && !state.on) lines.push('The environment still turns them off. Unset CONQUISTADOR_HOOKS to turn them on.');
  lines.push(`Agents with Conquistador hooks: ${labels.join(', ')}.${installed.length ? '' : ' None of them has a Conquistador install yet.'}`);
  lines.push('They give the agent the right playbooks for growth, marketing, and sales prompts and check marketing copy after each edit.');
  lines.push(state.on ? 'Turn them off: conquistador hooks off (in your agent: /conquistador hooks off).' : 'Turn them on: conquistador hooks on (in your agent: /conquistador hooks on).');
  if (action !== 'status') lines.push('The change applies from the next prompt; no agent needs a restart.');
  console.log(lines.join('\n'));
}

export async function runHooks(args) {
  const projectIndex = args.indexOf('--project');
  if (projectIndex < 0) {
    const [action = 'status', ...extra] = args;
    if (!['on', 'off', 'status'].includes(action) || extra.length) { console.error(USAGE); process.exitCode = 2; return; }
    runSwitch(action);
    return;
  }
  // The older per-project operator hooks.
  if (!args[projectIndex + 1]) throw Error('Supply --project ABS for hook ownership.');
  const project = resolve(args[projectIndex + 1]);
  const install = ['.conquistador', '.conquistador-operator'].map(name => join(project, name, 'tools/conquistador-mode.mjs')).find(existsSync);
  if (!install && args[0] === 'enable') throw Error('Install this project operator before enabling hooks.');
  // Bind routing to the installed library and its domain restriction, not the global CLI library.
  const { main } = install ? await import(pathToFileURL(install)) : await import('./conquistador-mode.mjs');
  console.log(JSON.stringify(main(args), null, 2));
}
