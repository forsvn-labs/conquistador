// The agent-first start: `conquistador` ends inside the user's agent with the task typed in.
// A first run (or `conquistador add`, or an install flag) goes through the one installer in
// onboard.mjs; later runs pick an agent and a task, then open the agent.
import { spawn, spawnSync } from 'node:child_process';
import { spawnCommand } from './spawn.mjs';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { START_CONTEXT } from './brief.mjs';
import { AGENTS, OWNED, agentId, detectAgents, installTargets, payloadCurrent, pluginHome, projectFolders, projectRoot, readState, self, skillCurrent, version, writeState } from './agents.mjs';
import { installWithoutTerminal, parseOnboard, printPlan, runInstaller } from './onboard.mjs';
import { paint, plainUi, stepLabel } from './onboard-ui.mjs';

export { normalizeScope } from './agents.mjs';

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

// Repair the selected host when its install drifted. Returns false when the user declines or repair fails.
async function repair(ui, agent, root, { yes = false } = {}) {
  const state = readState();
  const folder = projectFolders(root, [agent])[0].path;
  const scope = state.agents?.[agent.id] ? 'global' : 'project';
  const stale = scope === 'global' ? needsInstall(agent, state) : !skillCurrent(folder);
  if (!stale) return true;
  ui.note(`${agent.label} needs a repair (${scope} install). Run ${self} doctor for details.`, 'Repair');
  if (!yes) {
    const consent = await ui.confirm({ message: `Repair Conquistador for ${agent.label}?`, initialValue: true });
    if (ui.isCancel(consent) || !consent) return false;
  }
  const { results } = installTargets([agent], { scope, root });
  if (!results[0].result.ok) { ui.log.error(`${agent.label}: ${results[0].result.error}\n  Retry: ${self} --providers=${agent.id} --scope=${scope} -y`); return false; }
  return true;
}

async function pickTask(ui, cwd, { prefix = '', finish = false } = {}) {
  const starts = startsFor(isProject(cwd));
  const choice = await ui.select({
    message: `${prefix}What should we work on?`,
    options: [...starts.map(task => ({ value: task, label: task })), { value: '#areas', label: 'Browse all areas…' }, { value: '#own', label: 'Something else…' },
      ...(finish ? [{ value: '#finish', label: 'Finish for now', hint: 'show the summary and exit' }] : [])],
  });
  if (ui.isCancel(choice)) return null;
  if (choice === '#finish') return choice;
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

// A project without GROWTH.md starts with `/conquistador init`.
export const needsInit = cwd => isProject(cwd) && !existsSync(join(projectRoot(cwd), 'GROWTH.md'));
export const initPrompt = agent => (agent.slash ? `${agent.slash}init` : 'Use Conquistador: run init to record PRODUCT.md and GROWTH.md for this project.');

// A5: non-TTY and explicit dry-run are read-only, even when a terminal is present.
// Do not probe host versions/registration or copy to the clipboard in a preview.
function launchPreview(options, cwd, agents) {
  const { task, wanted, noOpen = false } = options;
  const state = readState();
  const agent = AGENTS.find(item => item.id === wanted) ?? agents.find(item => item.id === state.lastAgent) ?? agents[0];
  if (!agent || noOpen) return [];
  const prompt = task ? promptFor(agent, task, cwd) : needsInit(cwd) ? initPrompt(agent) : promptFor(agent, startsFor()[0], cwd);
  const launch = agent.open(prompt, { preview: true });
  return [launch ? `Planned launch (after installation):\n  ${commandLine(launch)}` : `Paste this into ${agent.label}:\n  ${prompt}`,
    ...(agent.id === 'claude-code' && process.env.CONQUISTADOR_PREFILL !== 'off' ? ['Claude preview assumes --prefill support; actual launch checks the installed version.'] : [])];
}

// Installed already: show which agent would open with which prompt, and change nothing.
function printOnly(options, cwd, here) {
  console.log(`${options.dryRun ? 'Dry run. ' : ''}Conquistador ${version}\nInstalled for: ${here.agents.map(agent => agent.label).join(', ')}`);
  for (const line of launchPreview(options, cwd, here.agents)) console.log(line);
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
export const parseStart = parseOnboard;

// After the installer: project setup, first task, summary, then open the agent (steps 5 to 8).
async function afterInstall(ui, outcome, options, cwd) {
  const { ready, finish, code } = outcome;
  const p = paint(options.plain ? 'none' : undefined);
  const prefix = stepLabel(p, 5, 5);
  const stop = message => { finish(); ui.outro(message); return code; };
  const cancelled = () => { ui.cancel(`Cancelled. Conquistador is installed. Nothing opened. Start a task later: ${self}`); return 130; };
  if (!ready.length) return stop(code ? `Installed with problems. Fix them, then run ${self} doctor.` : 'Done.');
  if (options.noOpen) return stop(`Installed. Start a new agent session and type ${needsInit(cwd) ? '/conquistador init' : '/conquistador'}.`);
  let agent = null, prompt = null, chosenTask = options.task || null;
  if (options.task) {
    agent = await pickAgent(ui, ready, options.wanted);
    if (!agent) return cancelled();
    prompt = promptFor(agent, options.task, cwd);
  } else {
    if (needsInit(cwd)) {
      const single = ready.length === 1 ? ready[0] : null;
      const setup = options.yes ? 'now' : await ui.select({ message: `${prefix}Set up this project now?`, options: [
        { value: 'now', label: `Yes, open ${single ? single.label : 'my agent'} with /conquistador init`, hint: 'records PRODUCT.md and GROWTH.md' },
        { value: 'later', label: 'Later', hint: 'run /conquistador init in your agent' },
      ] });
      if (ui.isCancel(setup)) return cancelled();
      if (setup === 'now') {
        agent = await pickAgent(ui, ready, options.wanted);
        if (!agent) return cancelled();
        prompt = initPrompt(agent);
        ui.log.info('Init records your product and growth context first.');
      }
    }
    if (!prompt) {
      const chosen = await pickTask(ui, cwd, { prefix, finish: true });
      if (!chosen) return cancelled();
      if (chosen === '#finish') return stop(code ? `Installed with problems. See the summary.` : `Done. Start a task any time: ${self}`);
      agent = await pickAgent(ui, ready, options.wanted);
      if (!agent) return cancelled();
      prompt = promptFor(agent, chosen, cwd);
      chosenTask = chosen;
    }
  }
  writeState({ ...readState(), lastAgent: agent.id });
  finish();
  return launchInto(ui, agent, prompt, chosenTask);
}

// Show what the agent will read, then hand it the terminal (or the clipboard).
async function launchInto(ui, agent, prompt, task = null) {
  if (task) {
    const [{ createBrief }, { SPECIALISTS }] = await Promise.all([import('./brief.mjs'), import('./tour.mjs')]);
    const brief = createBrief(task, { force: true });
    if (brief.action === 'brief' && brief.methods.length) ui.log.info(`${brief.methods.map(method => SPECIALISTS[method.name] ?? method.label).join(', ')}. Requests ${brief.must.length} playbooks first.`);
  }
  if (agent.note && readState().agents?.[agent.id]) ui.log.warn(agent.note);
  const launch = agent.open(prompt);
  if (!launch) {
    const copied = await copy(prompt);
    ui.note(prompt, copied ? `Paste this into ${agent.label} (copied)` : `Paste this into ${agent.label}`);
    ui.outro(`Start ${agent.label}, then paste.`);
    ui.close?.();
    return 0;
  }
  ui.outro(launch.sends ? `Opening ${agent.label}. It starts right away.` : `Opening ${agent.label}. Press Enter to start.`);
  ui.close?.();
  return openAgent(launch);
}

export async function runStart(args = [], { cwd = process.cwd(), tty = process.stdin.isTTY && process.stdout.isTTY, ui: suppliedUi, installer = false } = {}) {
  let options;

  try {
    options = parseOnboard(args);
  } catch (error) {
    console.error(error.message);

    return 2;
  }

  if (options.notice) process.stderr.write(`Note: ${options.notice}\n`);
  const root = projectRoot(cwd);
  let here = installsHere(root);
  const { wanted, task, noOpen, yes } = options;
  // An agent named with --in that is not installed here is installed first.
  if (wanted && !here.agents.some(agent => agent.id === wanted) && !options.providers) {
    options = { ...options, providers: [wanted], surfaces: options.surfaces ?? ['agents'], surfacesFrom: options.surfacesFrom ?? 'implied' };
  }
  // Flags, `conquistador add`, a first run, or an agent that is not installed here open the installer.
  const install = installer || options.installer || Boolean(options.surfacesFrom) || Boolean(options.scope) || !options.hooks || !here.agents.length;

  if (options.json || options.dryRun || (!tty && !yes)) {
    if (!install && !options.json) return printOnly(options, cwd, here);
    const targets = AGENTS.filter(agent => (options.providers ?? detectAgents().filter(item => item.found).map(item => item.id)).includes(agent.id));
    return printPlan(options, { cwd, launchLine: launchPreview(options, cwd, targets) });
  }
  if (!tty) return installWithoutTerminal(options, { cwd });
  const plain = options.plain || process.env.TERM === 'dumb';
  const ui = suppliedUi ?? (plain ? plainUi() : await import('./vendor/clack.mjs'));

  if (install) {
    const outcome = await runInstaller({ ...options, plain }, { cwd, ui, updateCheck: !suppliedUi });
    if (!outcome.finish) { ui.close?.(); return outcome.code; }
    return afterInstall(ui, outcome, options, cwd);
  }

  ui.intro(`Conquistador ${version}`);
  const state = readState();
  const ready = detectAgents().filter(agent => agent.found && here.agents.some(item => item.id === agent.id) && (!(state.removed ?? []).includes(agent.id) || agent.id === wanted));

  if (noOpen) {
    const named = ready.find(agent => agent.id === wanted);
    if (named && !await repair(ui, named, root, { yes })) {
      ui.outro(`Installation needs attention. Run ${self} doctor.`);

      return 1;
    }
    ui.outro(`Installed. Start a new agent session and type ${needsInit(cwd) ? '/conquistador init' : '/conquistador'}.`);

    return 0;
  }

  if (!ready.length) {
    ui.outro(`Installed. Start your agent and type ${needsInit(cwd) ? '/conquistador init' : '/conquistador'}.`);

    return 0;
  }

  const agent = await pickAgent(ui, ready, wanted);

  if (!agent) {
    ui.cancel('Nothing opened.');

    return 130;
  }

  if (!await repair(ui, agent, root, { yes })) {
    ui.outro(`Installation needs attention. No agent opened. Run ${self} doctor.`);

    return 1;
  }

  const init = !task && needsInit(cwd);
  const chosen = task || (init ? 'init' : await pickTask(ui, cwd));
  if (!chosen) { ui.cancel(`Nothing opened. Run ${self} to start a task.`); return 130; }

  writeState({ ...readState(), lastAgent: agent.id });
  if (init) ui.log.info('No GROWTH.md here yet. Init records your product and growth context first.');
  return launchInto(ui, agent, init ? initPrompt(agent) : promptFor(agent, chosen, cwd), init ? null : chosen);
}
