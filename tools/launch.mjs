// The start: the terminal installs Conquistador into coding agents; the work happens in the agent.
// A first run (or `conquistador add`, or an install flag) opens the installer: the full-screen TUI
// in a terminal (tools/installer-tui.mjs), line prompts with --plain or TERM=dumb (onboard.mjs).
// A later run shows what is installed. `conquistador "TASK"` prints the task's context for an
// agent. Nothing here opens an agent or asks for a task.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { AGENTS, OWNED, agentId, detectAgents, payloadCurrent, pluginHome, projectFolders, projectRoot, readState, self, version } from './agents.mjs';
import { installWithoutTerminal, parseOnboard, printPlan, runInstaller } from './onboard.mjs';
import { plainUi } from './onboard-ui.mjs';

export { normalizeScope } from './agents.mjs';

const PROJECT_MARKERS = /^(?:\.git|package\.json|readme(?:\..+)?|pyproject\.toml|cargo\.toml|go\.mod|gemfile|composer\.json|pubspec\.yaml|package\.swift|index\.html|.+\.xcodeproj)$/i;

// A7: the home folder or an empty folder has no product to read.
export function isProject(cwd = process.cwd()) {
  if (resolve(cwd) === resolve(homedir())) return false;
  try { return readdirSync(cwd).some(name => PROJECT_MARKERS.test(name)); } catch { return false; }
}

// A project without GROWTH.md starts with `/conquistador init`.
export const needsInit = cwd => isProject(cwd) && !existsSync(join(projectRoot(cwd), 'GROWTH.md'));
export const initPrompt = agent => (agent.slash ? `${agent.slash}init` : 'Use Conquistador: run init to record PRODUCT.md and GROWTH.md for this project.');

// What to type in an agent: init first in a new project, then the task or the menu.
export function nextStep(agent, cwd = process.cwd(), task = '') {
  if (!task && needsInit(cwd)) return initPrompt(agent);
  if (agent.slash) return `${agent.slash}${task}`.trim();
  return task ? `Use Conquistador: ${task}` : 'Use Conquistador';
}

export function parseProviders(value) {
  const names = String(value ?? '').split(',').map(item => item.trim()).filter(Boolean);
  const invalid = names.filter(name => !agentId(name));
  if (!names.length) throw Error('--providers needs agent names. Example: --providers=claude,codex');
  if (invalid.length) throw Error(`Unknown agent: ${invalid.join(', ')}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`);
  return [...new Set(names.map(agentId))];
}

// Where Conquistador is installed for this folder: tracked global installs and project skill copies.
export function installsHere(root) {
  const state = readState();
  const global = AGENTS.filter(agent => state.agents?.[agent.id]);
  const project = projectFolders(root).filter(folder => existsSync(join(folder.path, OWNED)));
  return { global, project, agents: AGENTS.filter(agent => global.includes(agent) || project.some(folder => folder.agents.includes(agent))) };
}

// The scope a plain Enter selects: global gives hooks and the MCP server; a project that already
// has a project copy keeps project scope.
export const defaultScope = root => (installsHere(root).project.length ? 'project' : 'global');

// One row per install for the status views: label, where, and whether it needs `update`.
export function installRows(root) {
  const state = readState();
  const here = installsHere(root);
  const current = payloadCurrent(pluginHome());
  return [
    ...here.global.map(agent => {
      const recorded = state.agents[agent.id]?.version ?? null;
      const stale = recorded !== version || (agent.how !== 'skill' && !current);
      return { agent, where: 'all projects', recorded, stale };
    }),
    ...here.project.map(folder => ({ agent: folder.agents[0], label: folder.agents.map(agent => agent.label).join(', '), where: 'this project', recorded: null, stale: false })),
  ];
}

// Validate before detecting hosts, opening a UI, or writing state. `--` quotes task words
// that begin with a dash; `task` supplies an unambiguous route for one-word tasks.
export const parseStart = parseOnboard;

// `conquistador "TASK"`: the playbooks the task needs, for the agent to read. It installs nothing
// and opens nothing; the agent does the work.
async function printTaskContext(task, cwd) {
  const { createBrief, formatReadingList } = await import('./brief.mjs');
  const brief = createBrief(task, { force: true, cwd });
  console.log(brief.action === 'brief' ? formatReadingList(brief)
    : 'No Conquistador method matches this task. Name the outcome and the channel, for example "write a win-back email flow for churned users". See every area: conquistador tour');
  const here = installsHere(projectRoot(cwd));
  const agent = here.agents.find(item => item.slash) ?? AGENTS[0];
  console.log(`\nConquistador does this work inside your coding agent. In the agent, type:\n  ${nextStep(agent, cwd, task)}`);
  if (!here.agents.length) console.log(`Conquistador is not in an agent yet. Install it: ${self}`);
  return 0;
}

// Installed already, without a terminal or with --dry-run: list the installs and change nothing.
function printStatus(options, cwd, root) {
  const rows = installRows(root);
  console.log(`${options.dryRun ? 'Dry run. ' : ''}Conquistador ${version}`);
  for (const row of rows) console.log(`  ${row.label ?? row.agent.label}: ${row.where}${row.stale ? `; run ${self} update` : ''}`);
  const agent = rows.map(row => row.agent).find(item => item.slash) ?? rows[0].agent;
  console.log(`In your agent, type: ${nextStep(agent, cwd)}`);
  console.log(`Change installs: ${self} add. No files changed, commands executed, or agent opened.`);
  return 0;
}

// The line flow (--plain, TERM=dumb, or a supplied UI): install, summarize, say what to type.
async function plainStart(ui, options, cwd, install, root) {
  if (!install) {
    ui.intro(`Conquistador ${version}`);
    ui.note(installRows(root).map(row => `${row.label ?? row.agent.label}: ${row.where}${row.stale ? `; run ${self} update` : ''}`).join('\n'), 'Installed');
    const agent = installsHere(root).agents.find(item => item.slash) ?? installsHere(root).agents[0];
    ui.outro(`In your agent, type: ${nextStep(agent, cwd)}\nChange installs: ${self} add · Repair: ${self} doctor · Update: ${self} update`);
    return 0;
  }
  const outcome = await runInstaller(options, { cwd, ui, updateCheck: !options.suppliedUi });
  if (!outcome.finish) return outcome.code;
  outcome.finish();
  const lead = outcome.ready.find(agent => agent.slash) ?? outcome.ready[0];
  ui.outro(lead ? `Next: open ${lead.label} in this project and type: ${nextStep(lead, cwd, options.task)}` : outcome.code ? `Installed with problems. Fix them, then run ${self} doctor.` : 'Done.');
  return outcome.code;
}

export async function runStart(args = [], { cwd = process.cwd(), tty = process.stdin.isTTY && process.stdout.isTTY, ui: suppliedUi, installer = false } = {}) {
  let options;

  try {
    options = parseOnboard(args);
  } catch (error) {
    console.error(error.message);

    return 2;
  }

  // A task without install flags is a request for context. --in and --no-open are accepted and ignored.
  const installFlags = Boolean(options.surfacesFrom && options.surfacesFrom !== 'implied') || Boolean(options.providers) || Boolean(options.scope) || !options.hooks || options.yes || options.installer || installer;
  if (options.task && !installFlags && !options.json && !options.dryRun) return printTaskContext(options.task, cwd);
  if (options.notice) process.stderr.write(`Note: ${options.notice}\n`);
  const root = projectRoot(cwd);
  const here = installsHere(root);
  // --in names the agent to install. One that is not installed here opens the installer.
  if (options.wanted && !options.providers) {
    const missing = !here.agents.some(agent => agent.id === options.wanted);
    options = { ...options, providers: [options.wanted], ...(missing ? { surfaces: options.surfaces ?? ['agents'], surfacesFrom: options.surfacesFrom ?? 'implied' } : {}) };
  }
  // Flags, --yes, `conquistador add`, a first run, or an agent that is not installed here open the installer.
  const install = installer || options.installer || Boolean(options.surfacesFrom) || Boolean(options.scope) || !options.hooks || options.yes || !here.agents.length;

  if (options.json || options.dryRun || (!tty && !options.yes)) {
    if (!install && !options.json) return printStatus(options, cwd, root);
    return printPlan(options, { cwd });
  }
  if (!tty) return installWithoutTerminal(options, { cwd });
  const plain = options.plain || process.env.TERM === 'dumb';
  if (suppliedUi || plain) {
    const ui = suppliedUi ?? plainUi();
    try { return await plainStart(ui, { ...options, plain, suppliedUi: Boolean(suppliedUi) }, cwd, install, root); } finally { ui.close?.(); }
  }
  const { runTui } = await import('./installer-tui.mjs');
  return runTui(options, { cwd, screen: install ? 'install' : 'home' });
}
