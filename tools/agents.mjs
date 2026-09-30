// Agent registry for the one-command installer.
// Each agent is installed with its own plugin manager, from one stable local copy of the plugin
// (~/.conquistador/plugin). Nothing here edits an agent's settings files directly, except the
// documented Cursor local-plugin folder, which is a plain copy.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { briefFiles } from './operator-package.mjs';
import { spawnCommand } from './spawn.mjs';

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

// Everything a plugin host needs. Core Node modules only; no dependency install.
export const pluginPayload = [
  '.claude-plugin', '.codex-plugin', '.cursor-plugin', '.agents', 'plugin.json', 'mcp.json', 'hooks', 'skills', 'assets',
  'agents/conquistador.md', 'package.json', 'LICENSE', 'NOTICE.md', 'README.md', 'SKILL.md',
  'mcp/server.mjs', 'tools/mcp-http.mjs', ...briefFiles,
];

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

export const AGENTS = [
  {
    id: 'claude-code', label: 'Claude Code', command: 'claude', how: 'plugin',
    install: src => [step('claude', ['plugin', 'marketplace', 'add', src]), step('claude', ['plugin', 'install', PLUGIN])],
    update: () => [step('claude', ['plugin', 'marketplace', 'update', MARKETPLACE]), step('claude', ['plugin', 'update', PLUGIN], { okIf: /latest|up to date|already/i })],
    remove: () => [step('claude', ['plugin', 'uninstall', PLUGIN], { okIf: /not (?:installed|found)/i }), step('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE], { okIf: /not found|no marketplace/i })],
    installed: () => run('claude', ['plugin', 'list', '--json']).stdout.includes(`"${PLUGIN}"`),
    // Claude Code 2.1.283 puts --prefill text in the input box without sending it (verified 2026-09-28).
    // The flag is not in --help, so older versions and CONQUISTADOR_PREFILL=off send the prompt instead.
    open: prompt => (prefill() ? { command: 'claude', args: ['--prefill', prompt], sends: false } : { command: 'claude', args: [prompt], sends: true }),
    slash: '/conquistador ',
  },
  {
    id: 'codex', label: 'Codex', command: 'codex', how: 'plugin',
    // Codex refuses to run when its home folder does not exist yet (a fresh install).
    prepare: () => mkdirSync(process.env.CODEX_HOME || join(homedir(), '.codex'), { recursive: true }),
    install: src => [step('codex', ['plugin', 'marketplace', 'add', src], { okIf: /already added/i }), step('codex', ['plugin', 'add', PLUGIN])],
    update: src => [step('codex', ['plugin', 'marketplace', 'add', src], { okIf: /already added/i }), step('codex', ['plugin', 'add', PLUGIN])],
    remove: () => [step('codex', ['plugin', 'remove', PLUGIN], { okIf: /not installed|not found/i }), step('codex', ['plugin', 'marketplace', 'remove', MARKETPLACE], { okIf: /not found|no marketplace/i })],
    installed: () => run('codex', ['plugin', 'list']).stdout.includes(PLUGIN),
    open: prompt => ({ command: 'codex', args: [prompt], sends: true }),
    note: 'Codex asks once to trust the Conquistador hooks. Type /hooks to trust them.',
  },
  {
    id: 'cursor', label: 'Cursor', command: 'cursor-agent', alsoDetect: ['cursor'], how: 'local plugin folder',
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
    id: 'copilot', label: 'GitHub Copilot CLI', command: 'copilot', how: 'plugin',
    install: src => [step('copilot', ['plugin', 'marketplace', 'add', src], { okIf: /already/i }), step('copilot', ['plugin', 'install', PLUGIN], { okIf: /already/i })],
    update: () => [step('copilot', ['plugin', 'update', PLUGIN], { okIf: /latest|up to date|live/i })],
    remove: () => [step('copilot', ['plugin', 'uninstall', PLUGIN], { okIf: /not installed|not found/i }), step('copilot', ['plugin', 'marketplace', 'remove', MARKETPLACE], { okIf: /not found/i })],
    installed: () => run('copilot', ['plugin', 'list']).stdout.includes(PLUGIN),
    open: prompt => ({ command: 'copilot', args: ['-i', prompt], sends: true }),
  },
  {
    id: 'grok', label: 'Grok CLI', command: 'grok', how: 'plugin',
    // Grok asks for explicit trust. Running `conquistador` or `conquistador add grok` is that consent.
    install: src => [step('grok', ['plugin', 'install', src, '--trust'], { okIf: /already installed/i, then: step('grok', ['plugin', 'update']) })],
    update: () => [step('grok', ['plugin', 'update'])],
    remove: () => [step('grok', ['plugin', 'uninstall', 'conquistador'], { okIf: /not found/i })],
    installed: () => /\bconquistador\b/.test(run('grok', ['plugin', 'list']).stdout),
    open: prompt => ({ command: 'grok', args: [prompt], sends: true }),
  },
];

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

export function detectAgents() {
  return AGENTS.map(agent => ({ ...agent, found: [agent.command, ...(agent.alsoDetect ?? [])].some(onPath) || (agent.id === 'cursor' && existsSync(join(homedir(), '.cursor'))) }));
}

// Files every agent's plugin manager needs. A copy without them is never registered (I2).
export const requiredPayload = [
  '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json',
  'plugin.json', 'mcp.json', 'mcp/server.mjs', 'hooks/conquistador-hook.mjs', 'skills/conquistador/SKILL.md', 'tools/brief.mjs',
];
export const missingPayload = folder => requiredPayload.filter(item => !existsSync(join(folder, item)));

// Skip dependency and Git folders inside the payload. Test the path relative to the payload item:
// the package itself lives under node_modules when npm or npx installs it (I1).
const skipped = /(?:^|[\\/])(?:node_modules|\.git)(?:[\\/]|$)/;

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

// Copy the plugin payload to a folder atomically. The folder is owned by Conquistador.
// The old copy stays in place until the new one is complete.
export function copyPayload(destination, { source = productRoot } = {}) {
  const marker = join(destination, '.conquistador-owned.json');
  if (existsSync(destination) && !existsSync(marker)) throw Error(`${tilde(destination)} exists and was not created by Conquistador. Move or delete it, then run ${self} again.`);
  mkdirSync(dirname(destination), { recursive: true });
  removeStale(destination);
  const staging = `${destination}.tmp-${process.pid}`;
  mkdirSync(staging, { recursive: true });
  try {
    for (const item of pluginPayload) {
      const from = join(source, item);
      if (!existsSync(from)) continue;
      mkdirSync(dirname(join(staging, item)), { recursive: true });
      cpSync(from, join(staging, item), { recursive: true, dereference: false, filter: path => !skipped.test(relative(from, path)) });
    }
    const missing = missingPayload(staging);
    if (missing.length) throw Error(`The Conquistador package at ${tilde(source)} is incomplete (missing ${missing.join(', ')}). Reinstall it, then run ${self} again.`);
    writeFileSync(join(staging, '.conquistador-owned.json'), `${JSON.stringify({ version, source, copiedAt: new Date().toISOString() }, null, 2)}\n`);
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

// A copy is current when it is complete and was made from this version (I6).
export function payloadCurrent(folder) {
  if (missingPayload(folder).length) return false;
  try { return JSON.parse(readFileSync(join(folder, '.conquistador-owned.json'), 'utf8')).version === version; } catch { return false; }
}

export function removePayload(destination) {
  if (!existsSync(destination)) return false;
  if (!existsSync(join(destination, '.conquistador-owned.json'))) throw Error(`${destination} was not created by Conquistador; left in place.`);
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

function applySteps(agent, action, { source, dryRun = false, log = () => {} } = {}) {
  const steps = agent[action](source);
  if (!dryRun && action !== 'remove') agent.prepare?.();
  const done = [];
  for (const item of steps) {
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
  if (!dryRun) {
    const state = readState();
    state.agents ??= {};
    if (action === 'remove') delete state.agents[agent.id];
    else state.agents[agent.id] = { version, how: agent.how, at: new Date().toISOString() };
    writeState(state);
  }
  return { ok: true };
}
