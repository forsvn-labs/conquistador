// The front door: `conquistador` installs where needed and opens your agent with a task (tools/launch.mjs).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AGENTS, applyAgent, copyPayload, detectAgents, home, pluginHome, readState, removePayload, self, tilde, version, writeState } from './agents.mjs';
import { selfUpdate } from './self-update.mjs';

const bold = text => (process.stdout.isTTY ? `\x1b[1m${text}\x1b[22m` : text);
const dim = text => (process.stdout.isTTY ? `\x1b[2m${text}\x1b[22m` : text);

// Default help shows only what a new user needs. Everything else stays available under --all.
export const HELP = `Conquistador ${version}
Marketing and growth playbooks for your AI agents.

  conquistador           Pick a task and open your agent with it (installs on first run)
  conquistador "TASK"    Open your agent with this task
  conquistador update    Update to the latest version
  conquistador remove    Uninstall

In your agent: /conquistador [TASK]

All commands: conquistador help --all`;

export const HELP_ALL = `Conquistador ${version}: all commands

Start
  conquistador                      Install where needed, pick a task, open your agent
  conquistador "TASK"               Open your agent with this task
    --in AGENT                      Open this agent for one run
    --no-open                       Install only

Install
  conquistador add [AGENT...]       Install into agents: ${AGENTS.map(agent => agent.id).join(', ')}
  conquistador update               Get the latest version and update every agent
  conquistador remove [AGENT...]    Remove from agents (all when none named)
  conquistador agents               Show detected agents and install state

Use
  conquistador tour [AREA]          Print what Conquistador covers (all areas, or one)
  conquistador brief "TASK"         Show which playbooks a task needs (--full prints them)
  conquistador playbooks add DIR    Add your own playbook folder; it ranks first
  conquistador mcp [--http]         Run the playbook MCP server (stdio, or HTTP for remote apps)
  conquistador bot [--out DIR]      Write a system prompt and knowledge files for chat bots

Other routes (see INSTALL.md)
  conquistador project              Per-project operator copy
  conquistador --advanced | --skills | --plugin | --mcp [--host HOST] | --bot [grok-bot|hermes]
  conquistador status | doctor | route --prompt TEXT | hooks | runtime --help | operator status

Flags: --yes (no questions), --dry-run (print commands only).
Turn hooks off: CONQUISTADOR_HOOKS=off. Send instead of pre-fill in Claude Code: CONQUISTADOR_PREFILL=off.`;

const flag = (args, name) => args.includes(name);
const positional = args => args.filter(arg => !arg.startsWith('-'));

// Returns null after it reports the error: a bad copy must never reach an agent (I2).
function stageSource({ dryRun }) {
  const target = pluginHome();
  try { if (!dryRun) copyPayload(target); } catch (error) { console.error(`${error.message}\nNothing installed. Your agents are unchanged.`); return null; }
  return target;
}

function report(results) {
  let failed = 0;
  for (const { agent, result } of results) {
    if (result.ok) console.log(`  ✓ ${agent.label}`);
    else { failed += 1; console.log(`  ✗ ${agent.label}: ${result.error}`); }
  }
  return failed;
}

export async function runAdd(args) {
  const dryRun = flag(args, '--dry-run');
  const names = positional(args);
  const unknown = names.filter(name => !AGENTS.some(agent => agent.id === name));
  if (unknown.length) { console.error(`Unknown agent: ${unknown.join(', ')}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`); return 2; }
  const detected = detectAgents();
  let chosen = names.length ? detected.filter(agent => names.includes(agent.id)) : detected.filter(agent => agent.found);
  const missing = chosen.filter(agent => !agent.found && agent.id !== 'cursor');
  if (missing.length) { console.error(`Not found on PATH: ${missing.map(agent => agent.command).join(', ')}. Install that agent first.`); return 1; }
  if (!chosen.length) { console.error(`No supported agent found. Name one: ${self} add claude-code`); return 1; }
  if (!flag(args, '--yes') && !dryRun) {
    console.error(`Would install into: ${chosen.map(agent => agent.label).join(', ')}.\nRe-run with --yes to install, or --dry-run to print the commands.`);
    return 2;
  }
  console.log(`Installing Conquistador ${version}${dryRun ? ' (dry run)' : ''}`);
  const source = stageSource({ dryRun });
  if (!source) return 1;
  const results = chosen.map(agent => ({ agent, result: applyAgent(agent, 'install', { source, dryRun, log: line => console.log(dim(`  $ ${line}`)) }) }));
  const failed = report(results);
  if (!dryRun) {
    // Adding an agent by name undoes an earlier `remove AGENT`.
    const state = readState();
    writeState({ ...state, removed: (state.removed ?? []).filter(id => !chosen.some(agent => agent.id === id)) });
    console.log(self === 'conquistador' ? `\nStart a task: ${bold('conquistador')}, or type ${bold('/conquistador')} in your agent.` : `\nStart a task: type ${bold('/conquistador')} in your agent.`);
  }
  return failed ? 1 : 0;
}

export function runUpdate(args) {
  const dryRun = flag(args, '--dry-run');
  const state = readState();
  const ids = Object.keys(state.agents ?? {});
  if (!ids.length) { console.log('Conquistador is not installed into any agent yet. Run: conquistador'); return 1; }
  const log = line => console.log(dim(`  $ ${line}`));
  // A newer registry version installs itself and registers with the agents; this copy stops here.
  const handedOff = selfUpdate(args, { dryRun, log });
  if (handedOff !== null) return handedOff;
  const source = stageSource({ dryRun });
  if (!source) return 1;
  const results = AGENTS.filter(agent => ids.includes(agent.id)).map(agent => ({ agent, result: applyAgent(agent, 'update', { source, dryRun, log }) }));
  const failed = report(results);
  const from = process.env.CONQUISTADOR_UPDATED_FROM;
  console.log(failed ? '' : `${from ? `Updated from ${from} to ${version}` : `Updated to ${version}`}. Start a new agent session to load it.`);
  return failed ? 1 : 0;
}

export function runRemove(args) {
  const dryRun = flag(args, '--dry-run');
  const names = positional(args);
  const state = readState();
  const ids = names.length ? names : Object.keys(state.agents ?? {});
  const chosen = AGENTS.filter(agent => ids.includes(agent.id));
  if (!chosen.length) { console.log('Nothing to remove.'); return 0; }
  const results = chosen.map(agent => ({ agent, result: applyAgent(agent, 'remove', { dryRun, log: line => console.log(dim(`  $ ${line}`)) }) }));
  const failed = report(results);
  if (!dryRun) {
    // A bare `conquistador` must not reinstall an agent the user removed by name.
    const state = readState();
    writeState({ ...state, removed: names.length ? [...new Set([...(state.removed ?? []), ...chosen.map(agent => agent.id)])] : [] });
  }
  if (!names.length && !failed && !dryRun) removePayload(pluginHome());
  return failed ? 1 : 0;
}

export function runAgents(args) {
  const state = readState();
  const rows = detectAgents().map(agent => ({ id: agent.id, agent: agent.label, found: agent.found, installed: Boolean(state.agents?.[agent.id]), version: state.agents?.[agent.id]?.version ?? null, how: agent.how }));
  if (flag(args, '--json')) { console.log(JSON.stringify({ version, pluginHome: pluginHome(), agents: rows }, null, 2)); return 0; }
  console.log(`Conquistador ${version}  plugin copy: ${existsSync(pluginHome()) ? tilde(pluginHome()) : 'not installed'}\n`);
  for (const row of rows) console.log(`  ${row.installed ? '●' : row.found ? '○' : ' '} ${row.agent.padEnd(20)} ${row.installed ? `installed ${row.version}` : row.found ? 'found, not installed' : 'not found'}`);
  console.log(`\n● installed  ○ available. Install with: ${self} add ${rows.filter(row => row.found && !row.installed).map(row => row.id).join(' ') || 'AGENT'}`);
  return 0;
}

export async function runBrief(args) {
  const { createBrief, formatBriefPack, formatReadingList } = await import('./brief.mjs');
  const task = positional(args).join(' ').trim();
  if (!task) { console.error('Usage: conquistador brief "TASK" [--full] [--json]'); return 2; }
  const brief = createBrief(task, { force: true });
  if (flag(args, '--json')) console.log(JSON.stringify(brief, null, 2));
  else if (flag(args, '--full')) console.log(formatBriefPack(brief));
  else console.log(brief.action === 'brief' ? formatReadingList(brief) : 'No Conquistador method matches this task. Name the outcome and the channel, for example "write a win-back email flow for churned users". See every area: conquistador tour');
  return 0;
}

export function runPlaybooks(args) {
  const [action = 'list', ...rest] = positional(args);
  const file = join(home(), 'config.json');
  let config = {};
  try { config = JSON.parse(readFileSync(file, 'utf8')); } catch { /* New config. */ }
  config.playbooks = Array.isArray(config.playbooks) ? config.playbooks : [];
  if (action === 'add' || action === 'remove') {
    if (!rest.length) { console.error(`Usage: conquistador playbooks ${action} DIR`); return 2; }
    for (const item of rest.map(path => resolve(path))) {
      if (action === 'add') {
        if (!existsSync(item)) { console.error(`Not found: ${item}`); return 1; }
        if (!config.playbooks.includes(item)) config.playbooks.push(item);
      } else config.playbooks = config.playbooks.filter(path => path !== item);
    }
    mkdirSync(home(), { recursive: true });
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  } else if (action !== 'list') { console.error('Usage: conquistador playbooks add|remove|list DIR'); return 2; }
  const extra = [process.env.CONQUISTADOR_PLAYBOOKS, existsSync(join(home(), 'playbooks')) ? join(home(), 'playbooks') : null].filter(Boolean);
  console.log(config.playbooks.length || extra.length ? [...config.playbooks, ...extra].map(path => `  ${path}`).join('\n') : 'No playbook folders yet. Add one: conquistador playbooks add ~/notes/playbooks');
  console.log(dim('Your playbooks rank ahead of built-in guidance in every brief, hook, and MCP call. They are read in place, never copied.'));
  return 0;
}

// A task is any first argument with a space in it, or the start flags alone.
export const isStart = args => args.length > 0 && (/\s/.test(args[0]) || ['--in', '--no-open'].includes(args[0]) || args[0].startsWith('--in='));

export async function runFrontDoor(args) {
  const [command, ...rest] = args;
  const start = async () => (await import('./launch.mjs')).runStart(args);
  if (!command) {
    if (!(process.stdin.isTTY && process.stdout.isTTY)) { console.log(HELP); return 0; }
    return start();
  }
  if (isStart(args)) return start();
  if (command === '--help' || command === '-h' || command === 'help') { console.log(rest.includes('--all') || args.includes('--all') ? HELP_ALL : HELP); return 0; }
  if (command === 'add') return runAdd(rest);
  // `update` keeps its per-project operator meaning until you install into an agent.
  if (command === 'update' && Object.keys(readState().agents ?? {}).length && !rest.some(arg => arg.startsWith('--project') || arg.startsWith('--path'))) return runUpdate(rest);
  if (command === 'remove') return runRemove(rest);
  if (command === 'agents') return runAgents(rest);
  if (command === 'brief') return runBrief(rest);
  if (command === 'playbooks') return runPlaybooks(rest);
  // The task picker replaced the interactive tour. `tour AREA` and piped `tour` still print.
  if (command === 'tour') return rest.length || !(process.stdin.isTTY && process.stdout.isTTY) ? (await import('./tour.mjs')).runTour(rest.length ? rest : ['--list']) : (await import('./launch.mjs')).runStart([]);
  if (command === 'bot') return (await import('./bot-pack.mjs')).runBotPack(rest);
  return null;
}
