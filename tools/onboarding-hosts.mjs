import { existsSync, accessSync, constants, lstatSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { DEFAULT_HOSTS } from './onboarding-parse.mjs';
import { hostFolders, hostLabels, installedHosts } from './project-installation.mjs';

export const ONBOARDING_HOSTS = DEFAULT_HOSTS;

// Active-session evidence only. PATH and home config directories are availability.
export const ACTIVE_SIGNALS = {
  bb: ['BB_THREAD_ID', 'BB_PROJECT_ID', 'BB_ENVIRONMENT_ID'],
  'claude-code': ['CLAUDECODE', 'CLAUDE_CODE'],
  cursor: ['CURSOR_TRACE_ID', 'CURSOR_AGENT'],
  copilot: ['COPILOT_CLI', 'GITHUB_COPILOT'],
  codex: ['CODEX_THREAD_ID', 'CODEX_SANDBOX'],
};

export const PATH_COMMANDS = {
  'claude-code': 'claude',
  cursor: 'cursor',
  copilot: 'copilot',
  codex: 'codex',
  bb: 'bb',
  hermes: 'hermes',
};

export const HOME_CONFIG = {
  'claude-code': '.claude',
  cursor: '.cursor',
  copilot: '.copilot',
  codex: '.codex',
};

export function commandOnPath(name, env = process.env) {
  const extensions = process.platform === 'win32' ? ['.cmd', '.exe', ''] : [''];
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      try {
        accessSync(join(dir, name + ext), constants.X_OK);
        return true;
      } catch { /* keep scanning */ }
    }
  }
  return false;
}

export function availableHosts(env = process.env, home = homedir()) {
  const available = [];
  for (const host of ONBOARDING_HOSTS.filter(value => value !== 'none')) {
    const binary = PATH_COMMANDS[host];
    const config = HOME_CONFIG[host];
    if ((binary && commandOnPath(binary, env)) || (config && existsSync(join(home, config)))) available.push(host);
  }
  return available;
}

export function activeHosts(env = process.env) {
  const matched = [];
  for (const [host, names] of Object.entries(ACTIVE_SIGNALS)) {
    if (names.some(name => env[name])) matched.push(host);
  }
  if (matched.includes('bb')) return ['bb'];
  return matched;
}

export function gitRoot(cwd) {
  for (let cursor = resolve(cwd); ; cursor = dirname(cursor)) {
    // Empty/placeholder .git paths are not repositories. Also support Git worktree files
    // without requiring a Git executable on PATH during installation.
    const marker = join(cursor, '.git');

    try {
      const stat = lstatSync(marker);

      const target = stat.isDirectory() ? marker : stat.isFile()
        ? /^gitdir: (.+)\r?\n?$/.exec(readFileSync(marker, 'utf8'))?.[1] : null;

      if (target) {
        const head = readFileSync(join(resolve(cursor, target), 'HEAD'), 'utf8').trim();

        if (/^(?:ref: refs\/[^\s]+|[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) return cursor;
      }
    } catch { /* Unreadable or incomplete metadata is not a discovered repository. */ }
    if (cursor === dirname(cursor)) return null;
  }
}

export function hostChoices(env = process.env, home = homedir()) {
  const available = new Set(availableHosts(env, home));
  return ONBOARDING_HOSTS.map(value => ({
    value,
    label: hostLabels[value],
    hint: available.has(value) ? 'available on this machine' : value === 'none' ? 'read .conquistador/SKILL.md explicitly' : value === 'bb' ? 'complete operator; no native skill' : hostFolders[value],
  }));
}

export function duplicateDiscovery(project, host) {
  const extras = [];
  if (host === 'cursor') {
    for (const folder of [hostFolders.codex, hostFolders['claude-code']]) {
      if (existsSync(join(project, folder, 'SKILL.md'))) extras.push(folder);
    }
  }
  if (host === 'hermes' && existsSync(join(project, hostFolders.codex, 'SKILL.md'))) extras.push(hostFolders.codex);
  if (host === 'codex') {
    for (const other of ['cursor', 'hermes', 'copilot']) if (existsSync(join(project, hostFolders[other], 'SKILL.md'))) extras.push(hostFolders[other]);
  }
  if (host === 'claude-code' && existsSync(join(project, hostFolders.cursor, 'SKILL.md'))) extras.push(hostFolders.cursor);
  if (host === 'copilot' && existsSync(join(project, hostFolders.codex, 'SKILL.md'))) extras.push(hostFolders.codex);
  return extras;
}

export function resolveHost({ host, existingHosts, env = process.env }) {
  if (host) return { host, reason: 'explicit' };
  const recorded = (existingHosts ?? []).filter(value => ONBOARDING_HOSTS.includes(value));
  if (recorded.length === 1) return { host: recorded[0], reason: 'installed' };
  if (recorded.length > 1) return { host: null, reason: 'ambiguous-installed', candidates: recorded };
  const active = activeHosts(env);
  if (active.length === 1) return { host: active[0], reason: 'active' };
  if (active.length > 1) return { host: null, reason: 'ambiguous-active', candidates: active };
  return { host: null, reason: 'unresolved', candidates: [] };
}

export function destinationsFor(project, host) {
  const creates = ['.conquistador/'];
  if (hostFolders[host]) creates.push(`${hostFolders[host]}/`);
  return creates;
}

export { installedHosts, hostFolders, hostLabels };
