import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { onPath, readState, version, writeState } from './agents.mjs';
import { PACKAGE } from './self-update.mjs';
import { runCommand } from './process-run.mjs';

export const CLI_MANAGERS = ['npm', 'bun'];

export const cliInstallArgs = (manager, target = version) => manager === 'bun'
  ? ['add', '--global', '--ignore-scripts', `${PACKAGE}@${target}`]
  : ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', `${PACKAGE}@${target}`];

export const cliInstallCommand = manager => `${manager} ${cliInstallArgs(manager).join(' ')}`;

export async function installCli(manager) {
  if (!CLI_MANAGERS.includes(manager)) return { ok: false, error: 'Choose npm or bun.' };
  const retry = cliInstallCommand(manager);
  const result = await runCommand(manager, cliInstallArgs(manager), { timeout: 600_000 });

  if (result.status !== 0) return { ok: false, error: result.error || result.stderr.trim().split('\n').slice(-4).join(' ') || `Package manager exited ${result.status}.`, retry };
  const location = await runCommand(manager, manager === 'bun' ? ['pm', 'bin', '--global'] : ['prefix', '--global'], { timeout: 15_000 });
  const base = location.status === 0 ? location.stdout.trim().split('\n').at(-1) : null;
  const bin = base ? manager === 'npm' && process.platform !== 'win32' ? join(base, 'bin') : base : null;
  const target = bin ? ['.cmd', '.exe', ''].map(suffix => join(bin, `conquistador${process.platform === 'win32' ? suffix : ''}`)).find(existsSync) : null;
  const chosen = onPath('conquistador');
  const path = target ?? chosen;
  const check = path ? await runCommand(path, ['--version'], { timeout: 10_000 }) : null;
  const verified = Boolean(check?.status === 0 && check.stdout.trim() === version && chosen === path);

  if (verified) writeState({ ...readState(), cli: { manager, version, path, verified, at: new Date().toISOString() } });

  if (!verified) {
    const error = chosen && path && chosen !== path
      ? `The CLI installed at ${path}, but PATH selects ${chosen}. Put ${bin} first on PATH and restart your terminal.`
      : `The package installed, but the conquistador command is not ready on PATH.${bin ? ` Add ${bin} to PATH and restart your terminal.` : ` Check ${manager === 'bun' ? 'bun pm bin --global' : 'npm prefix --global'}.`}`;

    return { ok: false, manual: true, error, retry, path, manager };
  }

  return { ok: true, manager, path, version };
}
