// The agent-first start: `conquistador` ends inside the user's agent with the task typed in.
// Detect agents, keep or customize them, choose a scope, install, then start one task.
import { spawn, spawnSync } from 'node:child_process';
import { spawnCommand } from './spawn.mjs';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { START_CONTEXT } from './brief.mjs';
import { AGENTS, OWNED, agentId, applyAgent, copyPayload, detectAgents, home, payloadCurrent, pluginHome, projectFolders, projectRoot, readState, self, skillCurrent, tilde, version, writeState } from './agents.mjs';

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

const SCOPES = { project: 'project', local: 'project', repo: 'project', global: 'global', user: 'global', home: 'global' };
export const normalizeScope = value => SCOPES[String(value ?? '').trim().toLowerCase()] ?? null;

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

// The steps a plan runs, for the confirmation and the dry run.
function describePlan(targets, scope, root) {
  if (scope === 'project') {
    return projectFolders(root, targets).map(folder => `${folder.agents.map(agent => agent.label).join(', ')}: copy the conquistador skill → ${tilde(folder.path)}`);
  }
  return targets.map(agent => (agent.how === 'skill'
    ? `${agent.label}: copy the conquistador skill → ${tilde(join(agent.global(), 'conquistador'))}`
    : `${agent.label}: ${agent.install(tilde(pluginHome())).map(item => (item.copy ? `copy plugin → ${tilde(item.copy())}` : `${item.command} ${item.args.join(' ')}`)).join('; ')}`));
}

function missingHosts(targets, scope) {
  // A plugin host needs its own CLI for a global install. Skill folders need nothing.
  const found = new Set(detectAgents().filter(agent => agent.found).map(agent => agent.id));
  return scope === 'global' ? targets.filter(agent => agent.how !== 'skill' && agent.id !== 'cursor' && !found.has(agent.id)) : [];
}

export function setHooks(on) {
  const file = join(home(), 'config.json');
  let config = {};
  try { config = JSON.parse(readFileSync(file, 'utf8')); } catch { /* New config. */ }
  if (on && config.hooks !== false) return;
  config.hooks = on;
  mkdirSync(home(), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

// Install the chosen hosts in one scope. Returns the hosts that succeeded.
export function installTargets(targets, { scope, root, hooks = true, log = () => {} }) {
  const results = [];
  if (scope === 'global' && targets.some(agent => agent.how !== 'skill')) {
    try { copyPayload(pluginHome()); } catch (error) { return { results: targets.map(agent => ({ agent, result: { ok: false, error: error.message } })), staged: false }; }
  }
  if (!hooks) setHooks(false);
  const done = new Set();
  for (const agent of targets) {
    const state = readState();
    const action = scope === 'global' && state.agents?.[agent.id] && agent.installed() ? 'update' : 'install';
    results.push({ agent, result: applyAgent(agent, action, { source: pluginHome(), scope, root, done, log }) });
  }
  const updated = readState();
  writeState({ ...updated, removed: (updated.removed ?? []).filter(id => !results.some(item => item.result.ok && item.agent.id === id)) });
  return { results, staged: true };
}

async function chooseTargets(ui, options) {
  if (options.providers) return AGENTS.filter(agent => options.providers.includes(agent.id));
  const state = readState();
  const found = detectAgents().filter(agent => agent.found && !(state.removed ?? []).includes(agent.id));
  if (options.yes) return found;
  ui.note(found.length ? found.map(agent => `${agent.label.padEnd(20)} ${tilde(agent.foundAt)}`).join('\n') : 'No supported agent found on PATH or in your home folder.', 'Detected agents');
  if (found.length) {
    const mode = await ui.select({ message: 'Install for', options: [{ value: 'keep', label: 'Keep these', hint: found.map(agent => agent.id).join(', ') }, { value: 'customize', label: 'Customize…' }] });
    if (ui.isCancel(mode)) return null;
    if (mode === 'keep') return found;
  }
  const ids = await ui.multiselect({ message: 'Select agents (space to toggle)', options: AGENTS.map(agent => ({ value: agent.id, label: agent.label, hint: agent.how === 'skill' ? 'skill' : 'plugin' })), initialValues: found.map(agent => agent.id), required: true });
  if (ui.isCancel(ids)) return null;
  return AGENTS.filter(agent => ids.includes(agent.id));
}

// Detect, keep or customize, choose a scope, confirm, then install. Returns null when cancelled.
async function setup(ui, options, root) {
  const targets = await chooseTargets(ui, options);
  if (targets === null) return null;
  if (!targets.length) {
    ui.note(`Install an agent, then run ${self} again. Or name one: ${self} --providers=claude`, 'No agent selected');
    return { agents: [] };
  }
  let scope = options.scope ?? (options.yes ? defaultScope(root) : null);
  if (!scope) {
    scope = await ui.select({ message: 'Install location', initialValue: defaultScope(root), options: [
      { value: 'global', label: 'Global', hint: `${tilde(homedir())}; adds hooks and the MCP server where the agent supports them` },
      { value: 'project', label: 'Project', hint: `${tilde(root)}; one skill folder you can commit` },
    ] });
    if (ui.isCancel(scope)) return null;
  }
  const missing = missingHosts(targets, scope);
  if (missing.length) {
    ui.note(`Not found on PATH: ${missing.map(agent => agent.command).join(', ')}. Install that agent first, or use --scope=project.`, 'Agent not found');
    return { agents: [] };
  }
  const plan = describePlan(targets, scope, root);
  ui.note([...plan, '', options.hooks ? 'Hooks: on for plugin installs (turn off with --no-hooks).' : 'Hooks: off.', `Remove later: ${self} remove`,
    ...(targets.some(agent => agent.id === 'grok') && scope === 'global' ? ['Grok installation trusts the bundled plugin scripts (--trust).'] : [])].join('\n'), `Install Conquistador ${version} (${scope})`);
  if (!options.yes) {
    const consent = await ui.confirm({ message: 'Install now?', initialValue: true });
    if (ui.isCancel(consent) || !consent) return null;
  }
  const spin = ui.spinner();
  spin.start('Installing');
  const { results } = installTargets(targets, { scope, root, hooks: options.hooks });
  const failed = results.filter(item => !item.result.ok);
  spin.stop(failed.length ? 'Installed with problems' : 'Installed', failed.length ? 2 : 0);
  for (const { agent, result } of results) {
    if (result.ok) ui.log.info(`✓ ${agent.label}`);
    else ui.log.error(`${agent.label}: ${result.error}\n  Retry: ${self} --providers=${agent.id} --scope=${scope} -y`);
  }
  for (const agent of results.filter(item => item.result.ok).map(item => item.agent)) if (agent.note && scope === 'global') ui.log.warn(agent.note);
  return { agents: results.filter(item => item.result.ok).map(item => item.agent), scope, failed: failed.length };
}

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

// A project without GROWTH.md starts with `/conquistador init`.
export const needsInit = cwd => isProject(cwd) && !existsSync(join(projectRoot(cwd), 'GROWTH.md'));
export const initPrompt = agent => (agent.slash ? `${agent.slash}init` : 'Use Conquistador: run init to record PRODUCT.md and GROWTH.md for this project.');

// A5: non-TTY and explicit dry-run are read-only, even when a terminal is present.
// Do not probe host versions/registration or copy to the clipboard in a preview.
function printOnly(options, cwd) {
  const { task, wanted, dryRun = false, noOpen = false } = options;
  const root = projectRoot(cwd);
  const state = readState();
  const detected = detectAgents().filter(agent => agent.found);
  const found = detected.filter(agent => !(state.removed ?? []).includes(agent.id) || agent.id === wanted);
  const targets = options.providers ? AGENTS.filter(agent => options.providers.includes(agent.id)) : wanted ? AGENTS.filter(agent => agent.id === wanted) : found;
  const scope = options.scope ?? defaultScope(root);
  console.log(`${dryRun ? 'Dry run. ' : ''}Conquistador ${version}\nDetected: ${detected.length ? detected.map(agent => `${agent.label} (${tilde(agent.foundAt)})`).join(', ') : 'none'}`);
  if (!targets.length) {
    console.log(`Choose agents with --providers=NAME[,NAME] (${AGENTS.map(item => item.id).join(', ')}). No files changed or agent opened.`);
    return 0;
  }
  console.log(`Scope: ${scope}${options.scope ? '' : ' (default)'}\nPlan:\n${describePlan(targets, scope, root).map(line => `  ${line}`).join('\n')}\nHooks: ${options.hooks ? 'on' : 'off'}`);
  const agent = AGENTS.find(item => item.id === wanted) ?? targets.find(item => item.id === state.lastAgent) ?? targets[0];
  if (!noOpen) {
    const prompt = task ? promptFor(agent, task, cwd) : needsInit(cwd) ? initPrompt(agent) : promptFor(agent, startsFor()[0], cwd);
    const launch = agent.open(prompt, { preview: true });
    console.log(launch ? `Planned launch (after installation):\n  ${commandLine(launch)}` : `Paste this into ${agent.label}:\n  ${prompt}`);
    if (agent.id === 'claude-code' && process.env.CONQUISTADOR_PREFILL !== 'off') console.log('Claude preview assumes --prefill support; actual launch checks the installed version.');
  }
  console.log(dryRun || !options.yes ? `To install: ${self} --providers=${targets.map(item => item.id).join(',')} --scope=${scope} -y` : '');
  console.log('No files changed, commands executed, or agent opened.');
  return 0;
}

// Non-interactive install: -y without a terminal installs and stops before opening an agent.
function installOnly(options, cwd) {
  const root = projectRoot(cwd);
  const state = readState();
  const targets = options.providers ? AGENTS.filter(agent => options.providers.includes(agent.id))
    : detectAgents().filter(agent => agent.found && !(state.removed ?? []).includes(agent.id));
  if (!targets.length) { console.error(`No supported agent found. Name one: ${self} --providers=claude -y`); return 1; }
  const scope = options.scope ?? defaultScope(root);
  const missing = missingHosts(targets, scope);
  if (missing.length) { console.error(`Not found on PATH: ${missing.map(agent => agent.command).join(', ')}. Install that agent first, or use --scope=project.`); return 1; }
  console.log(`Installing Conquistador ${version} (${scope}) for ${targets.map(agent => agent.label).join(', ')}.`);
  const { results } = installTargets(targets, { scope, root, hooks: options.hooks, log: line => console.log(`  $ ${line}`) });
  for (const { agent, result } of results) console.log(result.ok ? `  ✓ ${agent.label}` : `  ✗ ${agent.label}: ${result.error}`);
  const ok = results.filter(item => item.result.ok).map(item => item.agent);
  const next = ok.find(agent => agent.slash) ?? ok[0];
  if (next) console.log(`\nNext: start ${next.label} and ${next.slash ? 'type' : 'say'}: ${needsInit(cwd) ? initPrompt(next) : next.slash ? next.slash.trim() : 'Use Conquistador.'}`);
  return results.some(item => !item.result.ok) ? 1 : 0;
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
  const options = { wanted: null, dryRun: false, noOpen: false, yes: false, task: '', providers: null, scope: null, hooks: true };
  const words = [];
  const value = (arg, name, index) => (arg === name ? args[index + 1] : arg.slice(name.length + 1));

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--') { words.push(...args.slice(index + 1)); break; }

    if (arg === '--in' || arg.startsWith('--in=')) {
      if (options.wanted !== null) throw Error('Use --in only once.');
      const name = value(arg, '--in', index);
      if (arg === '--in') index += 1;

      if (!name || name.startsWith('-')) throw Error('--in requires an agent name. Example: --in codex');

      if (!agentId(name)) throw Error(`Unknown agent: ${name}. Choose from: ${AGENTS.map(agent => agent.id).join(', ')}.`);
      options.wanted = agentId(name);
    } else if (arg === '--providers' || arg.startsWith('--providers=')) {
      if (options.providers !== null) throw Error('Use --providers only once.');
      options.providers = parseProviders(value(arg, '--providers', index));
      if (arg === '--providers') index += 1;
    } else if (arg === '--scope' || arg.startsWith('--scope=')) {
      const scope = value(arg, '--scope', index);
      if (arg === '--scope') index += 1;
      options.scope = normalizeScope(scope);
      if (!options.scope) throw Error(`Unknown scope: ${scope ?? ''}. Use --scope=project or --scope=global.`);
    } else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-open') options.noOpen = true;
    else if (arg === '--no-hooks') options.hooks = false;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
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

  if (dryRun || (!tty && !yes)) return printOnly(options, cwd);
  if (!tty) return installOnly(options, cwd);
  const ui = suppliedUi ?? await import('./vendor/clack.mjs');
  ui.intro(`Conquistador ${version}`);
  const root = projectRoot(cwd);
  let here = installsHere(root);
  // Flags, a first run, or an agent that is not installed here start the installer.
  const install = options.providers || options.scope || !options.hooks || !here.agents.length || (wanted && !here.agents.some(agent => agent.id === wanted));

  if (install) {
    const result = await setup(ui, wanted && !options.providers ? { ...options, providers: [wanted] } : options, root);

    if (result === null) {
      ui.cancel('Nothing installed or opened.');

      return 130;
    }

    if (!result.agents.length) {
      ui.outro('Nothing installed. No agent opened.');

      return 1;
    }
    here = installsHere(root);
  }

  const state = readState();
  const ready = detectAgents().filter(agent => agent.found && here.agents.some(item => item.id === agent.id) && (!(state.removed ?? []).includes(agent.id) || agent.id === wanted));

  if (noOpen) {
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

  if (!install && !await repair(ui, agent, root, { yes })) {
    ui.outro(`Installation needs attention. No agent opened. Run ${self} doctor.`);

    return 1;
  }

  const init = !task && needsInit(cwd);
  const chosen = task || (init ? 'init' : await pickTask(ui, cwd));
  if (!chosen) { ui.cancel(`Nothing opened. Run ${self} to start a task.`); return 130; }

  writeState({ ...readState(), lastAgent: agent.id });
  const prompt = init ? initPrompt(agent) : promptFor(agent, chosen, cwd);

  if (init) ui.log.info('No GROWTH.md here yet. Init records your product and growth context first.');
  else {
    const [{ createBrief }, { SPECIALISTS }] = await Promise.all([import('./brief.mjs'), import('./tour.mjs')]);
    const brief = createBrief(chosen, { force: true });
    if (brief.action === 'brief' && brief.methods.length) ui.log.info(`${brief.methods.map(method => SPECIALISTS[method.name] ?? method.label).join(', ')}. Requests ${brief.must.length} playbooks first.`);
  }
  const launch = agent.open(prompt);
  if (!launch) {
    const copied = await copy(prompt);
    ui.note(prompt, copied ? `Paste this into ${agent.label} (copied)` : `Paste this into ${agent.label}`);
    ui.outro(`Start ${agent.label}, then paste.`);
    return 0;
  }
  ui.outro(launch.sends ? `Opening ${agent.label}. It starts right away.` : `Opening ${agent.label}. Press Enter to start.`);
  return openAgent(launch);
}
