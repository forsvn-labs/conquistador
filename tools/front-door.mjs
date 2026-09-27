// The one-command experience: `conquistador` finds your agents and installs the plugin into them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AGENTS, applyAgent, copyPayload, detectAgents, home, pluginHome, readState, removePayload, version } from './agents.mjs';

const bold = text => (process.stdout.isTTY ? `\x1b[1m${text}\x1b[22m` : text);
const dim = text => (process.stdout.isTTY ? `\x1b[2m${text}\x1b[22m` : text);

export const HELP = `Conquistador ${version}
Growth, GTM, launch, and marketing playbooks for your AI agents.

Install
  conquistador                      Find your agents and install (recommended)
  conquistador add [AGENT...]       Install into agents: ${AGENTS.map(agent => agent.id).join(', ')}
  conquistador update               Update every agent you installed into
  conquistador remove [AGENT...]    Remove from agents (all when none named)
  conquistador agents               Show detected agents and install state

Use
  conquistador brief "TASK"         Show which playbooks a task needs (--full prints them)
  conquistador playbooks add DIR    Add your own playbook folder; it ranks first
  conquistador mcp                  Run the playbook MCP server (stdio)
  conquistador mcp --http           Run it over HTTP for bots and remote apps
  conquistador bot [--out DIR]      Write a system prompt and knowledge files for chat bots

Other ways to install
  Claude Code     /plugin marketplace add forsvn-labs/conquistador
  Skills only     npx skills add forsvn-labs/conquistador
  Project copy    conquistador project        (per-project operator; see INSTALL.md)

Advanced (per-project and legacy routes)
  conquistador project              Per-project operator guide
  conquistador --advanced           Combine installation families in one folder
  conquistador --skills | --plugin | --mcp [--host HOST]
  conquistador --bot [grok-bot|hermes]
  conquistador status | doctor | route --prompt TEXT | hooks | runtime --help
  conquistador operator status      Per-project operator lifecycle

Flags: --yes (no questions), --dry-run (print commands only).
Turn hooks off: CONQUISTADOR_HOOKS=off.`;

const flag = (args, name) => args.includes(name);
const positional = args => args.filter(arg => !arg.startsWith('-'));

function stageSource({ dryRun }) {
  const target = pluginHome();
  if (!dryRun) copyPayload(target);
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

function nextSteps(agents) {
  console.log(`\n${bold('Next')}`);
  for (const agent of agents) console.log(`  ${agent.label}: ${agent.tryIt}`);
  console.log(`\n  Your own playbooks: conquistador playbooks add ~/path/to/playbooks`);
  console.log(`  Check a task first:  conquistador brief "plan a Product Hunt launch"`);
}

export async function runAdd(args, { interactive = false } = {}) {
  const dryRun = flag(args, '--dry-run');
  const names = positional(args);
  const unknown = names.filter(name => !AGENTS.some(agent => agent.id === name));
  if (unknown.length) { console.error(`Unknown agent: ${unknown.join(', ')}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`); return 2; }
  const detected = detectAgents();
  let chosen = names.length ? detected.filter(agent => names.includes(agent.id)) : detected.filter(agent => agent.found);
  const missing = chosen.filter(agent => !agent.found && agent.id !== 'cursor');
  if (missing.length) { console.error(`Not found on PATH: ${missing.map(agent => agent.command).join(', ')}. Install that agent first.`); return 1; }
  if (interactive) {
    const ui = await import('./vendor/clack.mjs');
    ui.intro(`Conquistador ${version}`);
    ui.log.message('Growth, GTM, launch, and marketing playbooks for your AI agents.\nInstalls as a plugin: 39 skills, a playbook MCP server, and hooks that make the agent read the playbooks.');
    const options = detected.map(agent => ({ value: agent.id, label: agent.label, hint: agent.found ? agent.how : 'not found' }));
    if (!detected.some(agent => agent.found)) {
      ui.note('No supported agent found on this machine.\nSkills for any agent:   npx skills add forsvn-labs/conquistador\nMCP for any client:     conquistador mcp\nChat bots:              conquistador bot', 'Other ways');
      ui.outro('Nothing installed.');
      return 1;
    }
    const picked = await ui.multiselect({ message: 'Install into (space to toggle, enter to confirm)', options: options.filter(option => detected.find(agent => agent.id === option.value).found), initialValues: detected.filter(agent => agent.found).map(agent => agent.id), required: true });
    if (ui.isCancel(picked)) { ui.cancel('Cancelled. Nothing changed.'); return 130; }
    chosen = detected.filter(agent => picked.includes(agent.id));
    const plan = [`Copy the plugin to ${pluginHome()}`, ...chosen.map(agent => `${agent.label}: ${agent.install(pluginHome()).map(item => item.copy ? `copy to ${item.copy()}` : `${item.command} ${item.args.join(' ')}`).join(' → ')}`)];
    ui.note(plan.join('\n'), 'Plan');
    const go = await ui.confirm({ message: 'Install now?' });
    if (ui.isCancel(go) || !go) { ui.cancel('Cancelled. Nothing changed.'); return 130; }
    const spin = ui.spinner();
    spin.start('Installing');
    const source = stageSource({ dryRun });
    const results = chosen.map(agent => { spin.message(agent.label); return { agent, result: applyAgent(agent, 'install', { source, dryRun }) }; });
    spin.stop('Installed');
    let failed = 0;
    for (const { agent, result } of results) {
      if (result.ok) ui.log.success(agent.label);
      else { failed += 1; ui.log.error(`${agent.label}: ${result.error}`); }
    }
    const ready = chosen.filter((agent, index) => results[index].result.ok);
    if (ready.length) ui.note([...ready.map(agent => `${agent.label}: ${agent.tryIt}`), '', 'Add your own playbooks:  conquistador playbooks add ~/path/to/playbooks', 'See what a task reads:   conquistador brief "plan a Product Hunt launch"'].join('\n'), 'Next');
    ui.outro(failed ? `${failed} agent(s) failed. Fix the error above and run: conquistador add ${results.filter(item => !item.result.ok).map(item => item.agent.id).join(' ')}` : 'Installed.');
    return failed ? 1 : 0;
  }
  if (!chosen.length) { console.error('No supported agent found. Name one: conquistador add claude-code'); return 1; }
  if (!flag(args, '--yes') && !dryRun) {
    console.error(`Would install into: ${chosen.map(agent => agent.label).join(', ')}.\nRe-run with --yes to install, or --dry-run to print the commands.`);
    return 2;
  }
  console.log(`Installing Conquistador ${version}${dryRun ? ' (dry run)' : ''}`);
  const source = stageSource({ dryRun });
  const results = chosen.map(agent => ({ agent, result: applyAgent(agent, 'install', { source, dryRun, log: line => console.log(dim(`  $ ${line}`)) }) }));
  const failed = report(results);
  if (!dryRun) nextSteps(chosen.filter((agent, index) => results[index].result.ok));
  return failed ? 1 : 0;
}

export function runUpdate(args) {
  const dryRun = flag(args, '--dry-run');
  const state = readState();
  const ids = Object.keys(state.agents ?? {});
  if (!ids.length) { console.log('Conquistador is not installed into any agent yet. Run: conquistador'); return 1; }
  const source = stageSource({ dryRun });
  const results = AGENTS.filter(agent => ids.includes(agent.id)).map(agent => ({ agent, result: applyAgent(agent, 'update', { source, dryRun, log: line => console.log(dim(`  $ ${line}`)) }) }));
  const failed = report(results);
  console.log(failed ? '' : `Updated to ${version}. Start a new agent session to load it.`);
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
  if (!names.length && !failed && !dryRun) removePayload(pluginHome());
  return failed ? 1 : 0;
}

export function runAgents(args) {
  const state = readState();
  const rows = detectAgents().map(agent => ({ id: agent.id, agent: agent.label, found: agent.found, installed: Boolean(state.agents?.[agent.id]), version: state.agents?.[agent.id]?.version ?? null, how: agent.how }));
  if (flag(args, '--json')) { console.log(JSON.stringify({ version, pluginHome: pluginHome(), agents: rows }, null, 2)); return 0; }
  console.log(`Conquistador ${version}  plugin copy: ${existsSync(pluginHome()) ? pluginHome() : 'not installed'}\n`);
  for (const row of rows) console.log(`  ${row.installed ? '●' : row.found ? '○' : ' '} ${row.agent.padEnd(20)} ${row.installed ? `installed ${row.version}` : row.found ? 'found, not installed' : 'not found'}`);
  console.log(`\n● installed  ○ available. Install with: conquistador add ${rows.filter(row => row.found && !row.installed).map(row => row.id).join(' ') || 'AGENT'}`);
  return 0;
}

export async function runBrief(args) {
  const { createBrief, formatBriefPack, formatReadingList } = await import('./brief.mjs');
  const task = positional(args).join(' ').trim();
  if (!task) { console.error('Usage: conquistador brief "TASK" [--full] [--json]'); return 2; }
  const brief = createBrief(task, { force: true });
  if (flag(args, '--json')) console.log(JSON.stringify(brief, null, 2));
  else if (flag(args, '--full')) console.log(formatBriefPack(brief));
  else console.log(brief.action === 'brief' ? formatReadingList(brief) : 'No Conquistador method matches this task.');
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

export async function runFrontDoor(args) {
  const [command, ...rest] = args;
  if (!command) {
    if (!(process.stdin.isTTY && process.stdout.isTTY)) { console.log(HELP); return 0; }
    return runAdd([], { interactive: true });
  }
  if (command === '--help' || command === '-h' || command === 'help') { console.log(HELP); return 0; }
  if (command === 'add') return runAdd(rest);
  // `update` keeps its per-project operator meaning until you install into an agent.
  if (command === 'update' && Object.keys(readState().agents ?? {}).length && !rest.some(arg => arg.startsWith('--project') || arg.startsWith('--path'))) return runUpdate(rest);
  if (command === 'remove') return runRemove(rest);
  if (command === 'agents') return runAgents(rest);
  if (command === 'brief') return runBrief(rest);
  if (command === 'playbooks') return runPlaybooks(rest);
  if (command === 'bot') return (await import('./bot-pack.mjs')).runBotPack(rest);
  return null;
}
