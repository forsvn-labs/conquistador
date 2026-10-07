// Agent registry for the one-command installer.
// Each agent is installed with its own plugin manager, from one stable local copy of the plugin
// (~/.conquistador/plugin). Nothing here edits an agent's settings files directly, except the
// documented Cursor local-plugin folder, which is a plain copy.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invalidPayload, pluginManifestPath, readPluginManifest } from './plugin-payload.mjs';
import { spawnCommand } from './spawn.mjs';

export { pluginPayload } from './plugin-payload.mjs';

export const productRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const version = JSON.parse(readFileSync(join(productRoot, 'package.json'), 'utf8')).version;
export const home = () => process.env.CONQUISTADOR_HOME || join(homedir(), '.conquistador');
export const pluginHome = () => join(home(), 'plugin');
// Messages show paths under the home folder as ~/…
export const tilde = path => (path.startsWith(`${homedir()}/`) ? `~${path.slice(homedir().length)}` : path);
// The command that runs this copy again. `npx` leaves no `conquistador` command behind.
const npxSpec = process.env.npm_config_package;
export const self = /[\\/]_npx[\\/]/.test(productRoot)
  ? (npxSpec && !/^@forsvn\/conquistador(?:@|$)/.test(npxSpec) ? `npx -y --package=${/^[\w./:@#+=-]+$/.test(npxSpec) ? npxSpec : `'${npxSpec}'`} conquistador` : 'npx @forsvn/conquistador')
  : 'conquistador';
const MARKETPLACE = 'conquistador';
const PLUGIN = `conquistador@${MARKETPLACE}`;

export function onPath(command) {
  for (const folder of (process.env.PATH ?? '').split(delimiter)) {
    if (!folder) continue;
    for (const suffix of process.platform === 'win32' ? ['.exe', '.cmd', ''] : ['']) {
      // statSync follows links, so a link whose target is gone does not count.
      try { if (statSync(join(folder, command + suffix)).isFile()) return join(folder, command + suffix); } catch { /* Next. */ }
    }
  }
  return null;
}

const step = (command, args, { okIf, then } = {}) => ({ command, args, okIf, then });
const cursorPlugins = () => join(process.env.CURSOR_HOME || join(homedir(), '.cursor'), 'plugins', 'local', 'conquistador');

// The one host skill. Hosts that use the Agent Skills format get a copy of this folder.
export const SKILL = 'skills/conquistador';
const skillStep = folder => [{ skill: () => join(folder(), 'conquistador') }];
const unskillStep = folder => [{ unskill: () => join(folder(), 'conquistador') }];
// Hermes honors $HERMES_HOME only inside the home folder (as Impeccable does).
function hermesHome() {
  const value = process.env.HERMES_HOME ? resolve(process.env.HERMES_HOME) : '';
  return value && (value === homedir() || value.startsWith(`${homedir()}${sep}`)) ? value : join(homedir(), '.hermes');
}
const openCodeConfig = () => process.env.OPENCODE_CONFIG_DIR || join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode');

// A host that reads the Agent Skills format but has no plugin manager we use. Skill folders and launch
// flags come from each host's own documentation (checked 2026-10-03; see INSTALL.md). `open` is null
// when the launch flag is not verified: the prompt then goes to the clipboard.
function skillAgent({ id, label, command, detect = [], project, global, open = null, slash }) {
  return {
    id, label, command, detect, how: 'skill', project, global,
    install: () => skillStep(global), update: () => skillStep(global), remove: () => unskillStep(global),
    installed: () => existsSync(join(global(), 'conquistador', OWNED)),
    healthy: () => skillCurrent(join(global(), 'conquistador')),
    open: open ?? (() => null), slash,
  };
}

// `project` is the folder, relative to the project root, that holds project skills for the host.
// Global scope installs plugin hosts through their plugin manager (skill, hooks, and MCP server).
export const AGENTS = [
  {
    id: 'claude-code', label: 'Claude Code', command: 'claude', detect: ['.claude'], how: 'plugin', project: '.claude/skills',
    install: src => [step('claude', ['plugin', 'marketplace', 'add', src]), step('claude', ['plugin', 'install', PLUGIN])],
    update: () => [step('claude', ['plugin', 'marketplace', 'update', MARKETPLACE]), step('claude', ['plugin', 'update', PLUGIN], { okIf: /latest|up to date|already/i })],
    remove: () => [step('claude', ['plugin', 'uninstall', PLUGIN], { okIf: /not (?:installed|found)/i }), step('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE], { okIf: /not found|no marketplace/i })],
    installed: () => registration('claude', ['plugin', 'list', '--json'], text => text.includes(`"${PLUGIN}"`)),
    // Claude Code 2.1.283 puts --prefill text in the input box without sending it (verified 2026-09-28).
    // The flag is not in --help, so older versions and CONQUISTADOR_PREFILL=off send the prompt instead.
    open: (prompt, { preview = false } = {}) => ((preview ? process.env.CONQUISTADOR_PREFILL !== 'off' : prefill()) ? { command: 'claude', args: ['--prefill', prompt], sends: false } : { command: 'claude', args: [prompt], sends: true }),
    slash: '/conquistador ',
  },
  {
    id: 'codex', label: 'Codex', command: 'codex', detect: ['.codex'], how: 'plugin', project: '.agents/skills',
    // Codex refuses to run when its home folder does not exist yet (a fresh install).
    prepare: () => mkdirSync(process.env.CODEX_HOME || join(homedir(), '.codex'), { recursive: true }),
    install: src => [step('codex', ['plugin', 'marketplace', 'add', src], { okIf: /already added/i }), step('codex', ['plugin', 'add', PLUGIN])],
    update: src => [step('codex', ['plugin', 'marketplace', 'add', src], { okIf: /already added/i }), step('codex', ['plugin', 'add', PLUGIN])],
    remove: () => [step('codex', ['plugin', 'remove', PLUGIN], { okIf: /not installed|not found/i }), step('codex', ['plugin', 'marketplace', 'remove', MARKETPLACE], { okIf: /not found|no marketplace/i })],
    installed: () => registration('codex', ['plugin', 'list'], text => text.includes(PLUGIN)),
    open: prompt => ({ command: 'codex', args: [prompt], sends: true }),
    note: 'Codex asks once to trust the Conquistador hooks. Type /hooks to trust them.',
  },
  {
    id: 'cursor', label: 'Cursor', command: 'cursor-agent', alsoDetect: ['cursor'], detect: ['.cursor'], how: 'local plugin folder', project: '.agents/skills',
    install: () => [{ copy: cursorPlugins }],
    update: () => [{ copy: cursorPlugins }],
    remove: () => [{ remove: cursorPlugins }],
    installed: () => existsSync(join(cursorPlugins(), '.cursor-plugin', 'plugin.json')),
    // Cursor reads its own copy, so that copy must be current too.
    healthy: () => payloadCurrent(cursorPlugins()),
    // Cursor the editor has no terminal launch. Without cursor-agent, the prompt goes to the clipboard.
    open: prompt => (onPath('cursor-agent') ? { command: 'cursor-agent', args: [prompt], sends: true } : null),
  },
  {
    id: 'copilot', label: 'GitHub Copilot CLI', command: 'copilot', how: 'plugin', project: '.agents/skills',
    install: src => [step('copilot', ['plugin', 'marketplace', 'add', src], { okIf: /already/i }), step('copilot', ['plugin', 'install', PLUGIN], { okIf: /already/i })],
    update: () => [step('copilot', ['plugin', 'update', PLUGIN], { okIf: /latest|up to date|live/i })],
    remove: () => [step('copilot', ['plugin', 'uninstall', PLUGIN], { okIf: /not installed|not found/i }), step('copilot', ['plugin', 'marketplace', 'remove', MARKETPLACE], { okIf: /not found/i })],
    installed: () => registration('copilot', ['plugin', 'list'], text => text.includes(PLUGIN)),
    open: prompt => ({ command: 'copilot', args: ['-i', prompt], sends: true }),
  },
  {
    id: 'grok', label: 'Grok CLI', command: 'grok', how: 'plugin', project: '.grok/skills',
    // Grok's --trust is disclosed in the selected-host install confirmation/explicit add preview.
    install: src => [step('grok', ['plugin', 'install', src, '--trust'], { okIf: /already installed/i, then: step('grok', ['plugin', 'update']) })],
    update: () => [step('grok', ['plugin', 'update'])],
    remove: () => [step('grok', ['plugin', 'uninstall', 'conquistador'], { okIf: /not found/i })],
    installed: () => registration('grok', ['plugin', 'list'], text => /\bconquistador\b/.test(text)),
    open: prompt => ({ command: 'grok', args: [prompt], sends: true }),
  },
  skillAgent({ id: 'gemini', label: 'Gemini CLI', command: 'gemini', project: '.agents/skills', global: () => join(homedir(), '.gemini', 'skills'),
    open: prompt => ({ command: 'gemini', args: ['-i', prompt], sends: true }) }),
  skillAgent({ id: 'opencode', label: 'OpenCode', command: 'opencode', project: '.agents/skills', global: () => join(openCodeConfig(), 'skills'),
    open: prompt => ({ command: 'opencode', args: ['--prompt', prompt], sends: true }) }),
  skillAgent({ id: 'pi', label: 'Pi', command: 'pi', detect: ['.pi'], project: '.agents/skills', global: () => join(homedir(), '.agents', 'skills'),
    open: prompt => ({ command: 'pi', args: [prompt], sends: true }), slash: '/skill:conquistador ' }),
  skillAgent({ id: 'hermes', label: 'Hermes Agent', command: 'hermes', detect: ['.hermes'], project: '.hermes/skills', global: () => join(hermesHome(), 'skills'), slash: '/conquistador ' }),
  skillAgent({ id: 'antigravity', label: 'Antigravity CLI', command: 'agy', detect: ['.gemini/antigravity-cli'], project: '.agents/skills', global: () => join(homedir(), '.gemini', 'antigravity-cli', 'skills'),
    open: prompt => ({ command: 'agy', args: ['-i', prompt], sends: true }), slash: '/conquistador ' }),
  skillAgent({ id: 'kiro', label: 'Kiro CLI', command: 'kiro-cli', detect: ['.kiro'], project: '.kiro/skills', global: () => join(homedir(), '.kiro', 'skills') }),
  skillAgent({ id: 'vibe', label: 'Mistral Vibe', command: 'vibe', detect: ['.vibe'], project: '.agents/skills', global: () => join(homedir(), '.vibe', 'skills') }),
];

// Names people type for a host. `--providers=claude,codex` uses these.
const ALIASES = { claude: 'claude-code', 'gemini-cli': 'gemini', agy: 'antigravity', github: 'copilot', 'kiro-cli': 'kiro', 'mistral-vibe': 'vibe', 'grok-build': 'grok' };
export const agentId = name => {
  const key = String(name).trim().toLowerCase();
  return AGENTS.some(agent => agent.id === key) ? key : ALIASES[key] ?? null;
};

function registration(command, args, matches) {
  const result = run(command, args, { timeout: 5_000 });

  return result.status === 0 && matches(result.stdout);
}

// The first Claude Code version where --prefill was verified.
const PREFILL_SINCE = [2, 1, 283];
function prefill() {
  if (process.env.CONQUISTADOR_PREFILL === 'off') return false;
  const found = /(\d+)\.(\d+)\.(\d+)/.exec(run('claude', ['--version'], { timeout: 15_000 }).stdout);
  if (!found) return false;
  const parts = found.slice(1).map(Number);
  for (let index = 0; index < 3; index += 1) if (parts[index] !== PREFILL_SINCE[index]) return parts[index] > PREFILL_SINCE[index];
  return true;
}

export function run(command, args, { timeout = 120_000 } = {}) {
  const { file, args: fileArgs, options } = spawnCommand(command, args);
  const result = spawnSync(file, fileArgs, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], env: process.env, ...options });
  return { status: result.error ? 127 : result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
}

// A host counts as found when its command is on PATH or its home folder exists.
export function detectAgents() {
  return AGENTS.map(agent => {
    const command = [agent.command, ...(agent.alsoDetect ?? [])].find(onPath);
    const folder = (agent.detect ?? []).map(name => join(homedir(), name)).find(path => existsSync(path));
    return { ...agent, found: Boolean(command || folder), foundAt: command ? onPath(command) : folder ?? null };
  });
}

// Bootstrap paths retained for lightweight external smoke checks. Installation and reuse
// verify the complete generated plugin inventory, not only these sentinels (I2, I6).
export const requiredPayload = [
  '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json',
  'plugin.json', 'mcp.json', 'mcp/server.mjs', 'hooks/conquistador-hook.mjs', 'skills/conquistador/SKILL.md', 'tools/brief.mjs',
  pluginManifestPath,
];

export const missingPayload = folder => readPluginManifest(productRoot, version).map(item => item.path).filter(item => !existsSync(join(folder, item)));

function incompletePayload(source, problems) {
  const detail = problems.slice(0, 5).join(', ') + (problems.length > 5 ? `, and ${problems.length - 5} more` : '');

  return Error(`The Conquistador package at ${tilde(source)} is incomplete or damaged (${detail}). Reinstall it, then run ${self} again.`);
}

// Remove staging and backup folders that an earlier crashed run left next to the destination (I4).
function removeStale(destination) {
  const prefix = `${basename(destination)}.`;
  let names = [];
  try { names = readdirSync(dirname(destination)); } catch { return; }
  for (const name of names) {
    const pid = /^(?:tmp|old)-(\d+)$/.exec(name.startsWith(prefix) ? name.slice(prefix.length) : '')?.[1];
    if (pid && !alive(Number(pid))) rmSync(join(dirname(destination), name), { recursive: true, force: true });
  }
}

// Another run that is still working owns its folders.
function alive(pid) {
  if (pid === process.pid) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

export const OWNED = '.conquistador-owned.json';

// The expected files of the whole plugin, or of one folder in it with paths relative to that folder.
function expectedFiles(only) {
  let files;
  try { files = readPluginManifest(productRoot, version); }
  catch { throw incompletePayload(productRoot, [`missing or invalid ${pluginManifestPath}`]); }
  return only ? files.filter(item => item.path.startsWith(`${only}/`)).map(item => ({ ...item, path: item.path.slice(only.length + 1) })) : files;
}

// Copy the plugin payload (or only the skill folder, with `only: SKILL`) to a folder atomically.
// The folder is owned by Conquistador. The old copy stays in place until the new one is complete.
export function copyPayload(destination, { source = productRoot, only = null } = {}) {
  const marker = join(destination, OWNED);
  if (existsSync(destination) && !existsSync(marker)) throw Error(`${tilde(destination)} exists and was not created by Conquistador. Move or delete it, then run ${self} again.`);
  const expected = expectedFiles(only);
  if (only) source = join(source, only);

  // Cursor may copy from the stable installed plugin. Its manifest is still checked against
  // this package's expected bytes, so altering an installed hash list cannot hide damage.
  const sourceProblems = invalidPayload(source, expected);

  if (sourceProblems.length) throw incompletePayload(source, sourceProblems);
  mkdirSync(dirname(destination), { recursive: true });
  removeStale(destination);
  const staging = `${destination}.tmp-${process.pid}`;
  mkdirSync(staging, { recursive: true });
  try {
    // Only copy manifest-listed files; dependency folders, Git data and unlisted local files
    // cannot leak into the managed payload, including from an npm node_modules source (I1).
    for (const { path: item } of expected) {
      const from = join(source, item);
      mkdirSync(dirname(join(staging, item)), { recursive: true });
      cpSync(from, join(staging, item), { dereference: false });
    }

    const problems = invalidPayload(staging, expected);

    if (problems.length) throw incompletePayload(source, problems);
    writeFileSync(join(staging, OWNED), `${JSON.stringify({ version, source, copiedAt: new Date().toISOString() }, null, 2)}\n`);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  const previous = `${destination}.old-${process.pid}`;
  if (existsSync(destination)) renameSync(destination, previous);
  try { renameSync(staging, destination); } catch (error) { if (existsSync(previous)) renameSync(previous, destination); rmSync(staging, { recursive: true, force: true }); throw error; }
  rmSync(previous, { recursive: true, force: true });
  return destination;
}

// This is local content health only: it does not establish host activation or model use.
export function payloadCurrent(folder, only = null) {
  try {
    return JSON.parse(readFileSync(join(folder, OWNED), 'utf8')).version === version
      && invalidPayload(folder, expectedFiles(only)).length === 0;
  } catch { return false; }
}
export const skillCurrent = folder => payloadCurrent(folder, SKILL);
export const copySkill = destination => copyPayload(destination, { only: SKILL });

// The project skill folders of the selected hosts, one entry per folder.
export function projectFolders(root, agents = AGENTS) {
  const folders = new Map();
  for (const agent of agents) {
    const path = join(root, agent.project, 'conquistador');
    folders.set(path, [...(folders.get(path) ?? []), agent]);
  }
  return [...folders].map(([path, hosts]) => ({ path, agents: hosts }));
}

// The project root: the nearest folder with .git, else the current folder.
export function projectRoot(cwd = process.cwd()) {
  for (let dir = resolve(cwd); dir !== dirname(dir); dir = dirname(dir)) if (existsSync(join(dir, '.git'))) return dir;
  return resolve(cwd);
}

export function removePayload(destination) {
  if (!existsSync(destination)) return false;
  if (!existsSync(join(destination, OWNED))) throw Error(`${destination} was not created by Conquistador; left in place.`);
  rmSync(destination, { recursive: true, force: true });
  return true;
}

export function readState() {
  try { return JSON.parse(readFileSync(join(home(), 'installs.json'), 'utf8')); } catch { return { agents: {} }; }
}
export function writeState(state) {
  mkdirSync(home(), { recursive: true });
  writeFileSync(join(home(), 'installs.json'), `${JSON.stringify(state, null, 2)}\n`);
}

// Run one agent's steps. Every command is shown; nothing runs in dry-run mode.
// An error in one agent is returned, never thrown, so the other agents still install (I3).
export function applyAgent(agent, action, options = {}) {
  try { return applySteps(agent, action, options); } catch (error) { return { ok: false, error: error.message }; }
}

// Project scope copies the one skill into the host's project skill folder; nothing else changes.
function stepsFor(agent, action, { source, scope = 'global', root }) {
  if (scope !== 'project') return agent[action](source);
  const folder = () => join(root, agent.project);
  return action === 'remove' ? unskillStep(folder) : skillStep(folder);
}

function applySteps(agent, action, { source, dryRun = false, log = () => {}, scope = 'global', root = projectRoot(), done: shared = new Set() } = {}) {
  const steps = stepsFor(agent, action, { source, scope, root });
  if (!dryRun && action !== 'remove' && scope !== 'project') agent.prepare?.();
  const done = [];
  for (const item of steps) {
    if (item.skill || item.unskill) {
      const target = (item.skill ?? item.unskill)();
      // Hosts that read the same folder share one copy.
      if (shared.has(target)) continue;
      shared.add(target);
      log(`${item.skill ? 'copy skill' : 'remove'} → ${tilde(target)}`);
      if (!dryRun) { if (item.skill) copySkill(target); else removePayload(target); }
      continue;
    }
    if (item.copy) {
      const target = item.copy();
      log(`copy plugin → ${tilde(target)}`);
      if (!dryRun) copyPayload(target, { source });
      done.push(`copied to ${target}`);
      continue;
    }
    if (item.remove) {
      const target = item.remove();
      log(`remove ${target}`);
      if (!dryRun) removePayload(target);
      continue;
    }
    log(`${item.command} ${item.args.join(' ')}`);
    if (dryRun) continue;
    const result = run(item.command, item.args);
    const output = `${result.stdout}\n${result.stderr}`;
    const failed = result.status !== 0 || /\b(?:error|failed)\b/i.test(result.stderr) && !/success/i.test(output);
    if (item.okIf?.test(output)) {
      if (item.then) {
        log(`${item.then.command} ${item.then.args.join(' ')}`);
        const next = run(item.then.command, item.then.args);
        if (next.status !== 0) return { ok: false, error: (next.stderr || next.stdout).trim().split('\n').slice(-3).join(' ') };
      }
      continue;
    }
    if (failed) return { ok: false, error: (result.error?.message || result.stderr || result.stdout).trim().split('\n').slice(-3).join(' ') || `exit ${result.status}` };
  }
  if (!dryRun && scope !== 'project') {
    const state = readState();
    state.agents ??= {};
    if (action === 'remove') delete state.agents[agent.id];
    else state.agents[agent.id] = { version, how: agent.how, at: new Date().toISOString() };
    writeState(state);
  }
  return { ok: true };
}

const SCOPES = { project: 'project', local: 'project', repo: 'project', global: 'global', user: 'global', home: 'global' };
export const normalizeScope = value => SCOPES[String(value ?? '').trim().toLowerCase()] ?? null;

export function setHooks(on) {
  const file = join(home(), 'config.json');
  let config = {};
  try { config = JSON.parse(readFileSync(file, 'utf8')); } catch { /* New config. */ }
  if (on && config.hooks !== false) return;
  config.hooks = on;
  mkdirSync(home(), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

// Check the package, then copy the plugin payload when a global plugin install needs it.
// Returns null, or the error. A damaged package must reach no agent, not even as a skill copy (I2).
export function stageTargets(targets, { scope, plugin = false }) {
  try {
    const problems = invalidPayload(productRoot, expectedFiles());
    if (problems.length) throw incompletePayload(productRoot, problems);
    if (plugin || (scope === 'global' && targets.some(agent => agent.how !== 'skill'))) copyPayload(pluginHome());
    return null;
  } catch (error) { return error.message; }
}

// Install one host after stageTargets. Hosts that share a skill folder share `done`.
export function installOne(agent, { scope, root, done = new Set(), log = () => {} }) {
  const state = readState();
  const action = scope === 'global' && state.agents?.[agent.id] && agent.installed() ? 'update' : 'install';
  const result = applyAgent(agent, action, { source: pluginHome(), scope, root, done, log });
  const updated = readState();
  if (result.ok && (updated.removed ?? []).includes(agent.id)) writeState({ ...updated, removed: updated.removed.filter(id => id !== agent.id) });
  return result;
}

// Install the chosen hosts in one scope. Returns the hosts that succeeded.
export function installTargets(targets, { scope, root, hooks = true, log = () => {} }) {
  const error = stageTargets(targets, { scope });
  if (error) return { results: targets.map(agent => ({ agent, result: { ok: false, error } })), staged: false, error };
  if (!hooks) setHooks(false);
  const done = new Set();
  return { results: targets.map(agent => ({ agent, result: installOne(agent, { scope, root, done, log }) })), staged: true };
}
