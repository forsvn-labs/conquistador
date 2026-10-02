// The agent-first start: `conquistador` ends inside the user's agent with the task typed in.
// Pick one agent, preview and confirm its installation, then start one bounded task.
import { spawn, spawnSync } from 'node:child_process';
import { spawnCommand } from './spawn.mjs';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { START_CONTEXT } from './brief.mjs';
import { AGENTS, applyAgent, copyPayload, detectAgents, payloadCurrent, pluginHome, readState, self, tilde, version, writeState } from './agents.mjs';

// Tasks that fit any product. The first one is the default.
export const STARTS = Object.freeze([
  'Draft one welcome email for new trial users; do not send it',
  'Diagnose our signup funnel and propose one small growth experiment; do not launch it',
  'Map our signup user flow and specify error recovery with acceptance criteria; do not implement it',
]);

const startsFor = () => STARTS;

const PROJECT_MARKERS = /^(?:\.git|package\.json|readme(?:\..+)?|pyproject\.toml|cargo\.toml|go\.mod|gemfile|composer\.json|pubspec\.yaml|package\.swift|index\.html|.+\.xcodeproj)$/i;

// A7: the home folder or an empty folder has no product to read.
export function isProject(cwd = process.cwd()) {
  if (resolve(cwd) === resolve(homedir())) return false;
  try { return readdirSync(cwd).some(name => PROJECT_MARKERS.test(name)); } catch { return false; }
}

export function promptFor(agent, task, cwd = process.cwd()) {
  const sentence = task.trim().replace(/[.!?]*$/, '.');
  const context = isProject(cwd) ? START_CONTEXT.project : START_CONTEXT.ask;
  return `${agent.slash ?? 'Use Conquistador: '}${sentence} ${context}`;
}

// A shell line a person can copy. Display only; launches never go through a shell (A6).
const quote = value => (/^[\w./=:-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`);
export const commandLine = launch => [launch.command, ...launch.args].map(quote).join(' ');

// Read the selected host's registration as well as local content. Neither proves that the
// host loaded the plugin, trusted hooks, or produced a useful answer.
function needsInstall(agent, state) {
  return !payloadCurrent(pluginHome()) || state.agents?.[agent.id]?.version !== version
    || agent.healthy?.() === false || !agent.installed();
}

async function ensureInstalled(ui, agent, { yes = false } = {}) {
  const state = readState();

  if (!needsInstall(agent, state)) return { ready: true };
  ui.note(`Shared plugin copy: ${tilde(pluginHome())}\nRegister or repair only ${agent.label}. Already registered hosts also use this shared copy.\nNo project files, accounts, or model calls are part of installation.\nRemove later: ${self} remove ${agent.id}`
    + (agent.id === 'grok' ? '\nGrok installation explicitly trusts the bundled plugin scripts (--trust).' : '')
    + (agent.note ? `\n${agent.note}` : ''), 'Installation scope');

  if (!yes) {
    const consent = await ui.confirm({ message: `Install Conquistador into ${agent.label}?`, initialValue: true });

    if (ui.isCancel(consent) || !consent) return { ready: false, cancelled: true };
  }

  const spin = ui.spinner();
  spin.start(`Installing into ${agent.label}`);
  try { copyPayload(pluginHome()); } catch (error) {
    spin.stop('Install failed', 2);
    ui.log.error(error.message);

    return { ready: false };
  }

  // Reinstall restores a registration removed through the host's own plugin manager.
  const action = state.agents?.[agent.id] && agent.installed() ? 'update' : 'install';
  const result = applyAgent(agent, action, { source: pluginHome() });
  spin.stop(result.ok ? `Installed into ${agent.label}` : `Could not install into ${agent.label}`, result.ok ? 0 : 2);

  if (!result.ok) {
    ui.log.error(`${agent.label}: ${result.error}\n  Retry: ${self} add ${agent.id} --yes`);

    return { ready: false };
  }

  const updated = readState();
  writeState({ ...updated, removed: (updated.removed ?? []).filter(id => id !== agent.id) });

  return { ready: true };
}

async function pickTask(ui, cwd) {
  const starts = startsFor(isProject(cwd));
  const choice = await ui.select({
    message: 'What should we work on?',
    options: [...starts.map(task => ({ value: task, label: task })), { value: '#areas', label: 'Browse all areas…' }, { value: '#own', label: 'Something else…' }],
  });
  if (ui.isCancel(choice)) return null;
  if (choice === '#own') return describe(ui);
  if (choice !== '#areas') return choice;
  const { AREAS } = await import('./tour.mjs');
  const areaId = await ui.select({ message: 'Which area?', options: AREAS.map(area => ({ value: area.id, label: area.title, hint: area.covers })) });
  if (ui.isCancel(areaId)) return null;
  const area = AREAS.find(item => item.id === areaId);
  const example = await ui.select({ message: 'Pick a task', options: [...area.examples.map(item => ({ value: item.prompt, label: item.prompt })), { value: '', label: 'Something else…' }] });
  if (ui.isCancel(example)) return null;
  // Examples hold sample facts. Let the user make them true before an agent acts on them.
  return example ? describe(ui, example) : describe(ui);
}

async function describe(ui, initialValue) {
  const typed = await ui.text(initialValue
    ? { message: 'Edit the task, then press Enter', initialValue }
    : { message: 'Describe the task in one sentence', placeholder: 'Write a welcome email sequence for new trial users' });
  if (ui.isCancel(typed) || !String(typed ?? '').trim()) return null;
  return String(typed).trim();
}

async function pickAgent(ui, ready, wanted) {
  if (wanted) return ready.find(agent => agent.id === wanted) ?? null;
  const state = readState();
  const last = ready.find(agent => agent.id === state.lastAgent);
  if (last) return last;
  let agent = ready[0];
  if (ready.length > 1) {
    const id = await ui.select({ message: 'Open in', options: ready.map(item => ({ value: item.id, label: item.label })), initialValue: ready[0].id });
    if (ui.isCancel(id)) return null;
    agent = ready.find(item => item.id === id);
  }
  return agent;
}

// A5: non-TTY and explicit dry-run are read-only, even when a terminal is present.
// Do not probe host versions/registration or copy to the clipboard in a preview.
function printOnly(task, wanted, cwd, { dryRun = false, noOpen = false } = {}) {
  const state = readState();
  const found = detectAgents().filter(agent => agent.found && (!(state.removed ?? []).includes(agent.id) || agent.id === wanted));
  const agent = AGENTS.find(item => item.id === wanted)
    ?? found.find(item => item.id === state.lastAgent)
    ?? (found.length === 1 ? found[0] : null);

  if (!agent) {
    console.log(`Choose a target with --in AGENT (${(found.length ? found : AGENTS).map(item => item.id).join(', ')}). No files changed or agent opened.`);

    return 0;
  }

  console.log(`${dryRun ? 'Dry run. ' : ''}Target: ${agent.label}. Shared plugin: ${tilde(pluginHome())}.\nHost registration and hook trust are not checked in this preview.\nInstall or repair explicitly: ${self} add ${agent.id} --yes\nRemove: ${self} remove ${agent.id}`);

  if (!noOpen) {
    const prompt = promptFor(agent, task || startsFor()[0], cwd);
    const launch = agent.open(prompt, { preview: true });
    console.log(launch ? `Planned launch (after installation):\n  ${commandLine(launch)}` : `Paste this into ${agent.label}:\n  ${prompt}`);

    if (agent.id === 'claude-code' && process.env.CONQUISTADOR_PREFILL !== 'off') console.log('Claude preview assumes --prefill support; actual launch checks the installed version.');
  }

  console.log('No files changed, commands executed, or agent opened.');
  return 0;
}

// Hand the terminal to the agent and exit with its code. Node has no exec(), so the parent waits
// and ignores the terminal's Ctrl+C and Ctrl+\, which belong to the agent now (A11).
export function openAgent(launch) {
  return new Promise(done => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    const ignore = () => {};
    process.on('SIGINT', ignore);
    process.on('SIGQUIT', ignore);
    // No shell: on Windows it would split the task at spaces and run & or | in it as commands.
    const { file, args, options } = spawnCommand(launch.command, launch.args);
    const child = spawn(file, args, { stdio: 'inherit', ...options });
    process.on('SIGTERM', () => child.kill('SIGTERM'));
    child.on('error', error => { console.error(`Could not start ${launch.command}: ${error.message}`); done(1); });
    child.on('exit', (code, signal) => done(code ?? (signal ? 1 : 0)));
  });
}

async function copy(value) {
  const tool = process.platform === 'darwin' ? ['pbcopy', []] : process.platform === 'win32' ? ['clip', []] : ['xclip', ['-selection', 'clipboard']];

  try {
    const { file, args, options } = spawnCommand(tool[0], tool[1]);

    return spawnSync(file, args, { input: value, ...options }).status === 0;
  } catch { return false; }
}

// Validate before detecting hosts, opening a UI, or writing state. `--` quotes task words
// that begin with a dash; `task` supplies an unambiguous route for one-word tasks.
export function parseStart(args) {
  const options = { wanted: null, dryRun: false, noOpen: false, yes: false, task: '' };
  const words = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') { words.push(...args.slice(index + 1)); break; }

    if (arg === '--in' || arg.startsWith('--in=')) {
      if (options.wanted !== null) throw Error('Use --in only once.');
      const value = arg === '--in' ? args[++index] : arg.slice('--in='.length);

      if (!value || value.startsWith('-')) throw Error('--in requires an agent name. Example: --in codex');

      if (!AGENTS.some(agent => agent.id === value)) throw Error(`Unknown agent: ${value}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`);
      options.wanted = value;
    } else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-open') options.noOpen = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg.startsWith('-')) throw Error(`Unknown start option: ${arg}. Use conquistador help --all.`);
    else words.push(arg);
  }

  options.task = words.join(' ').trim();

  return options;
}

export async function runStart(args = [], { cwd = process.cwd(), tty = process.stdin.isTTY && process.stdout.isTTY, ui: suppliedUi } = {}) {
  let options;

  try {
    options = parseStart(args);
  } catch (error) {
    console.error(error.message);

    return 2;
  }

  const { wanted, task, dryRun, noOpen, yes } = options;

  if (dryRun || !tty) return printOnly(task, wanted, cwd, options);
  const ui = suppliedUi ?? await import('./vendor/clack.mjs');
  ui.intro(`Conquistador ${version}`);
  const state = readState();
  const found = detectAgents().filter(agent => agent.found && (!(state.removed ?? []).includes(agent.id) || agent.id === wanted));

  if (!found.length || wanted && !found.some(agent => agent.id === wanted)) {
    ui.note(wanted ? `${AGENTS.find(agent => agent.id === wanted).label} was not found. Install that agent first, then retry with --in ${wanted}.`
      : `Install an agent, then run ${self} again: Claude Code, Codex, Cursor, GitHub Copilot CLI, or Grok CLI.\nOther routes: https://github.com/forsvn-labs/conquistador/blob/private-alpha/INSTALL.md`, 'No selected agent found');
    ui.outro('Nothing installed.');
    return 1;
  }

  const agent = await pickAgent(ui, found, wanted);

  if (!agent) {
    ui.cancel('Nothing installed or opened.');

    return 130;
  }

  const installed = await ensureInstalled(ui, agent, { yes });

  if (!installed.ready) {
    if (installed.cancelled) {
      ui.cancel('Nothing installed or opened.');

      return 130;
    }

    ui.outro('Installation needs attention. No agent opened.');

    return 1;
  }

  ui.log.info(`Local files checked for ${agent.label}. Host loading, hook trust, and task quality still need a session check.`);

  if (noOpen) {
    ui.outro(`Installed for ${agent.label}. Start a new session and use /conquistador.`);

    return 0;
  }

  const chosen = task || await pickTask(ui, cwd);
  if (!chosen) { ui.cancel(`Nothing opened. Run ${self} to start a task.`); return 130; }

  writeState({ ...readState(), lastAgent: agent.id });
  const prompt = promptFor(agent, chosen, cwd);
  const [{ createBrief }, { SPECIALISTS }] = await Promise.all([import('./brief.mjs'), import('./tour.mjs')]);
  const brief = createBrief(chosen, { force: true });

  if (brief.action === 'brief' && brief.methods.length) ui.log.info(`${brief.methods.map(method => SPECIALISTS[method.name] ?? method.label).join(', ')}. Requests ${brief.must.length} playbooks first.`);
  if (agent.note) ui.log.warn(agent.note);
  const launch = agent.open(prompt);
  if (!launch) {
    const copied = await copy(prompt);
    ui.note(prompt, copied ? `Paste this into the ${agent.label} agent chat (copied)` : `Paste this into the ${agent.label} agent chat`);
    ui.outro('Install cursor-agent to open Cursor from here next time.');
    return 0;
  }
  ui.outro(launch.sends ? `Opening ${agent.label}. It starts right away.` : `Opening ${agent.label}. Press Enter to start.`);
  return openAgent(launch);
}
