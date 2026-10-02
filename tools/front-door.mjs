// The front door: `conquistador` installs where needed and opens your agent with a task (tools/launch.mjs).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AGENTS, OWNED, agentId, applyAgent, copyPayload, detectAgents, home, installTargets, normalizeScope, payloadCurrent, pluginHome, projectFolders, projectRoot, readState, removePayload, self, setHooks, skillCurrent, tilde, version, writeState } from './agents.mjs';
import { selfUpdate } from './self-update.mjs';

const bold = text => (process.stdout.isTTY ? `\x1b[1m${text}\x1b[22m` : text);
const dim = text => (process.stdout.isTTY ? `\x1b[2m${text}\x1b[22m` : text);

// Default help shows only what a new user needs. Everything else stays available under --all.
export const HELP = `Conquistador ${version}
Growth, marketing, sales, and product playbooks for your AI agents.

Start
  npx @forsvn/conquistador    Detect your agents, install, and open one
  conquistador "TASK"         Open your agent with this task

In your agent
  /conquistador init          Record PRODUCT.md and GROWTH.md for this project
  /conquistador               Show the menu for this project
  /conquistador launch        Plan and run a launch
  /conquistador outreach ...  Write outreach, for example to churned customers
  /conquistador check         Check marketing copy against the rules

Maintain
  conquistador update         Update the CLI and every install
  conquistador doctor         Find and repair install and project drift
  conquistador remove         Remove Conquistador from your agents

All commands: conquistador help --all`;

export const HELP_ALL = `Conquistador ${version}: all commands

Start
  conquistador [TASK]               Detect agents, install where needed, open one
    --providers=NAME[,NAME]         Install for these agents: ${AGENTS.map(agent => agent.id).join(', ')}
    --scope=project|global          Project skill folder, or global (plugin with hooks and MCP)
    -y, --yes                       Accept detected agents and the default scope
    --no-hooks                      Install without prompt hooks
    --dry-run                       Show the plan; change nothing
    --in AGENT                      Open this agent
    --no-open                       Install only
  conquistador task WORD            Start a one-word task

Maintain
  conquistador update [--dry-run]   Update the CLI, plugin installs, and skill copies
  conquistador doctor [--fix]       Report (and repair) drift in installs, hooks, and project context
  conquistador remove [AGENT...]    Remove installs (--scope=project|global; default both)
  conquistador agents [--json]      Show detected agents and install state
  conquistador add AGENT... --yes   Install into named agents (same as --providers)

Use
  conquistador brief "TASK"         Show which playbooks a task needs (--full prints them)
  conquistador tour [AREA]          Print what Conquistador covers
  conquistador playbooks add DIR    Add your own playbook folder; it ranks first
  conquistador mcp [--http]         Run the playbook MCP server (stdio, or HTTP for remote apps)
  conquistador bot [--out DIR]      Write a system prompt and knowledge files for chat bots

Other routes (see INSTALL.md)
  conquistador project              Per-project operator copy
  conquistador --advanced | --skills | --plugin | --mcp [--host HOST] | --bot [grok-bot|hermes]
  conquistador status | operator doctor | route --prompt TEXT | hooks | runtime --help

Removal keeps playbooks, config, bot exports, and the npm CLI.
Turn hooks off later: CONQUISTADOR_HOOKS=off. Send instead of pre-fill in Claude Code: CONQUISTADOR_PREFILL=off.`;

const flag = (args, name) => args.includes(name);
const positional = args => args.filter(arg => !arg.startsWith('-'));

function agentArguments(args, allowed, { names = true } = {}) {
  const unknown = args.filter(arg => arg.startsWith('-') && !allowed.includes(arg));

  if (unknown.length) throw Error(`Unknown option: ${unknown.join(', ')}. Use conquistador help --all.`);
  const selected = positional(args);

  if (!names && selected.length) throw Error('This command does not accept agent names.');
  const invalid = selected.filter(name => !agentId(name));

  if (invalid.length) throw Error(`Unknown agent: ${invalid.join(', ')}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`);

  if (selected.length && flag(args, '--all')) throw Error('Choose named agents or --all, not both.');

  return [...new Set(selected.map(agentId))];
}

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
  let names;

  try {
    names = agentArguments(args, ['--yes', '-y', '--dry-run', '--all']);
  } catch (error) {
    console.error(error.message);

    return 2;
  }

  const detected = detectAgents();
  const available = detected.filter(agent => agent.found);

  if (!names.length && !flag(args, '--all') && available.length > 1) {
    console.error(`Choose agents explicitly: ${self} add AGENT --yes (available: ${available.map(agent => agent.id).join(', ')}).\nFor every detected agent: ${self} add --all --yes. Use --dry-run to preview.`);

    return 2;
  }

  const chosen = names.length ? detected.filter(agent => names.includes(agent.id)) : available;
  const missing = chosen.filter(agent => !agent.found && agent.how !== 'skill' && agent.id !== 'cursor');
  if (missing.length) { console.error(`Not found on PATH: ${missing.map(agent => agent.command).join(', ')}. Install that agent first.`); return 1; }
  if (!chosen.length) { console.error(`No supported agent found. Name one: ${self} add claude-code`); return 1; }
  if (!flag(args, '--yes') && !flag(args, '-y') && !dryRun) {
    console.error(`Would install into: ${chosen.map(agent => agent.label).join(', ')}.\nRe-run with --yes to install, or --dry-run to print the commands.`);
    return 2;
  }

  console.log(`Installing Conquistador ${version}${dryRun ? ' (dry run)' : ''} into ${chosen.map(agent => agent.label).join(', ')}.\nShared plugin copy: ${tilde(pluginHome())}. Already registered hosts also use this shared copy.\nProject files, personal playbooks, and account connections are unchanged.`);

  if (chosen.some(agent => agent.id === 'grok')) console.log('Grok installation trusts the bundled plugin scripts (--trust).');
  const log = line => console.log(dim(`  $ ${line}`));
  if (dryRun) { report(chosen.map(agent => ({ agent, result: applyAgent(agent, 'install', { source: pluginHome(), dryRun, log }) }))); return 0; }
  const { results } = installTargets(chosen, { scope: 'global', root: projectRoot(), log });
  const failed = report(results);
  console.log(self === 'conquistador' ? `\nStart a task: ${bold('conquistador')}, or type ${bold('/conquistador')} in your agent.` : `\nStart a task: type ${bold('/conquistador')} in your agent.`);
  return failed ? 1 : 0;
}

export function runUpdate(args) {
  try {
    agentArguments(args, ['--yes', '-y', '--dry-run', '--no-hooks'], { names: false });
  } catch (error) {
    console.error(error.message);

    return 2;
  }

  const dryRun = flag(args, '--dry-run');
  const state = readState();
  const root = projectRoot();
  const ids = Object.keys(state.agents ?? {});
  const folders = projectFolders(root).filter(folder => existsSync(join(folder.path, OWNED)));
  if (!ids.length && !folders.length) { console.log(`Conquistador is not installed into any agent yet. Run: ${self}`); return 1; }
  const log = line => console.log(dim(`  $ ${line}`));
  // A newer registry version installs itself and registers with the agents; this copy stops here.
  const handedOff = selfUpdate(args, { dryRun, log });
  if (handedOff !== null) return handedOff;
  if (flag(args, '--no-hooks') && !dryRun) setHooks(false);
  const tracked = AGENTS.filter(agent => ids.includes(agent.id));
  const plugins = tracked.filter(agent => agent.how !== 'skill');
  const source = plugins.length ? stageSource({ dryRun }) : pluginHome();
  if (!source) return 1;
  const done = new Set();
  const results = [
    ...tracked.map(agent => ({ agent, result: applyAgent(agent, !dryRun && !agent.installed() ? 'install' : 'update', { source, dryRun, log, done }) })),
    ...folders.map(folder => ({ agent: { label: `${tilde(folder.path)} (project)` }, result: applyAgent(folder.agents[0], 'update', { scope: 'project', root, dryRun, log, done }) })),
  ];
  const failed = report(results);
  const from = process.env.CONQUISTADOR_UPDATED_FROM;
  console.log(failed ? '' : dryRun ? 'Preview only; no files changed or commands executed.' : `${from ? `Updated from ${from} to ${version}` : `Updated to ${version}`}. Start a new agent session to load it.`);
  return failed ? 1 : 0;
}

export function runRemove(args) {
  const dryRun = flag(args, '--dry-run');
  let names, scope = null;

  try {
    const scoped = args.find(arg => arg.startsWith('--scope='));
    if (scoped) { scope = normalizeScope(scoped.slice('--scope='.length)); if (!scope) throw Error(`Unknown scope: ${scoped.slice(8)}. Use --scope=project or --scope=global.`); }
    names = agentArguments(args.filter(arg => arg !== scoped), ['--yes', '-y', '--dry-run']);
  } catch (error) {
    console.error(error.message);

    return 2;
  }

  const state = readState();
  const root = projectRoot();
  const log = line => console.log(dim(`  $ ${line}`));
  const ids = names.length ? names : Object.keys(state.agents ?? {});
  const chosen = scope === 'project' ? [] : AGENTS.filter(agent => ids.includes(agent.id) && (names.length ? state.agents?.[agent.id] || agent.how !== 'skill' : true));
  // Hosts that share a project folder share one copy; removing one host removes that copy.
  const folders = scope === 'global' ? [] : projectFolders(root, names.length ? AGENTS.filter(agent => names.includes(agent.id)) : AGENTS).filter(folder => existsSync(join(folder.path, OWNED)));

  if (!chosen.length && !folders.length) {
    if (!names.length && !dryRun && scope !== 'project') removePayload(pluginHome());
    console.log('No tracked registrations to remove. Personal playbooks, config, bot exports, and npm CLI are preserved.');

    return 0;
  }
  const done = new Set();
  const results = [
    ...chosen.map(agent => ({ agent, result: applyAgent(agent, 'remove', { dryRun, log, done }) })),
    ...folders.map(folder => ({ agent: { label: `${tilde(folder.path)} (project)` }, result: applyAgent(folder.agents[0], 'remove', { scope: 'project', root, dryRun, log, done }) })),
  ];
  const failed = report(results);
  if (!dryRun) {
    // A bare `conquistador` must not reinstall an agent the user removed by name.
    const state = readState();
    writeState({ ...state, removed: names.length ? [...new Set([...(state.removed ?? []), ...results.filter(item => item.result.ok && item.agent.id).map(item => item.agent.id)])] : [] });
  }
  if (!names.length && !failed && !dryRun && scope !== 'project') removePayload(pluginHome());
  console.log('Personal playbooks, config, bot exports, and the npm CLI are preserved.\nTo also remove a global CLI: npm uninstall -g @forsvn/conquistador');
  return failed ? 1 : 0;
}

export function runAgents(args) {
  if (args.some(arg => arg !== '--json')) {
    console.error('Usage: conquistador agents [--json]');

    return 2;
  }

  const state = readState();
  const payloadHealthy = payloadCurrent(pluginHome());
  const folders = projectFolders(projectRoot());

  const rows = detectAgents().map(agent => {
    const recordedInstalled = Boolean(state.agents?.[agent.id]);
    const registered = agent.found || agent.id === 'cursor' || agent.how === 'skill' ? agent.installed() : false;
    const folder = folders.find(item => item.agents.some(host => host.id === agent.id));
    const project = existsSync(join(folder.path, OWNED)) ? { path: folder.path, current: skillCurrent(folder.path) } : null;

    return { id: agent.id, agent: agent.label, how: agent.how, found: agent.found, foundAt: agent.foundAt, installed: registered, registered, recordedInstalled,
      version: state.agents?.[agent.id]?.version ?? null, payloadHealthy: agent.how === 'skill' ? agent.healthy() : payloadHealthy && (agent.healthy?.() ?? true),
      project, activation: 'unverified', hookTrust: 'unverified' };
  });

  if (flag(args, '--json')) {
    console.log(JSON.stringify({ version, pluginHome: pluginHome(), payloadHealthy, agents: rows }, null, 2));

    return 0;
  }

  console.log(`Conquistador ${version}  plugin copy: ${existsSync(pluginHome()) ? `${tilde(pluginHome())} (${payloadHealthy ? 'integrity checked' : 'needs repair'})` : 'not installed'}\n`);

  for (const row of rows) {
    const global = row.registered ? `global (${row.how}); recorded version ${row.version ?? 'unknown'}` : row.recordedInstalled ? 'recorded install; registration not verified' : row.found ? 'found; no global install' : 'not found';
    console.log(`  ${row.registered || row.project ? '●' : row.found ? '○' : ' '} ${row.agent.padEnd(20)} ${global}${row.project ? `; project copy ${row.project.current ? 'current' : 'needs repair'}` : ''}`);
  }
  console.log(`\nHost loading and hook trust are unverified. Install or repair: ${self} --providers=AGENT -y, or ${self} doctor --fix`);
  return 0;
}

export async function runBrief(args) {
  const unknown = args.filter(arg => arg.startsWith('-') && !['--full', '--json'].includes(arg));

  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(', ')}. Usage: conquistador brief "TASK" [--full] [--json]`);

    return 2;
  }

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
  if (args.some(arg => arg.startsWith('-'))) {
    console.error('Usage: conquistador playbooks add|remove|list DIR (no flags).');

    return 2;
  }

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

// Explicit task supports one-word prompts without taking reserved runtime commands. Install flags start the flow too.
const START_FLAGS = ['task', '--in', '--no-open', '--providers', '--scope', '-y', '--yes', '--no-hooks', '--dry-run'];
export const isStart = args => args.length > 0 && (/\s/.test(args[0]) || START_FLAGS.includes(args[0]) || /^--(?:in|providers|scope)=/.test(args[0]));

export async function runFrontDoor(args) {
  const [command, ...rest] = args;
  const start = async () => (await import('./launch.mjs')).runStart(command === 'task' ? rest : args);
  if (!command) {
    if (!(process.stdin.isTTY && process.stdout.isTTY)) { console.log(HELP); return 0; }
    return start();
  }
  if (isStart(args)) return start();
  if (command === '--help' || command === '-h' || command === 'help') { console.log(rest.includes('--all') || args.includes('--all') ? HELP_ALL : HELP); return 0; }
  if (command === 'add') return runAdd(rest);
  // `update` keeps its per-project operator meaning until you install into an agent.
  const installed = () => Object.keys(readState().agents ?? {}).length || projectFolders(projectRoot()).some(folder => existsSync(join(folder.path, OWNED)));
  if (command === 'update' && installed() && !rest.some(arg => arg.startsWith('--project') || arg.startsWith('--path'))) return runUpdate(rest);
  if (command === 'remove') return runRemove(rest);
  if (command === 'agents') return runAgents(rest);
  // `doctor --project`, `--path`, and `--config` keep their operator and runtime meanings.
  if (command === 'doctor' && !rest.some(arg => /^--(?:project|path|config)(?:=|$)/.test(arg))) return (await import('./doctor.mjs')).runDoctor(rest);
  if (command === 'brief') return runBrief(rest);
  if (command === 'playbooks') return runPlaybooks(rest);
  // The task picker replaced the interactive tour. `tour AREA` and piped `tour` still print.
  if (command === 'tour') return rest.length || !(process.stdin.isTTY && process.stdout.isTTY) ? (await import('./tour.mjs')).runTour(rest.length ? rest : ['--list']) : (await import('./launch.mjs')).runStart([]);
  if (command === 'bot') return (await import('./bot-pack.mjs')).runBotPack(rest);
  return null;
}
