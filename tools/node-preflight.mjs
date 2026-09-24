import { existsSync, lstatSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { constants, homedir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { cancellableUi } from './onboarding-ui.mjs';
import { shellCommand } from './install-paths.mjs';

const supported = () => Number(process.versions.node.split('.')[0]) === 24;
const home = homedir();

function candidates() {
  const nvm = join(home, '.nvm/versions/node');
  // HOME can be overridden by a caller. Only the account's actual home is a
  // trusted manager root for automatic execution; custom HOME gets guidance.
  let versions = [];
  try {
    if (home === userInfo().homedir && existsSync(nvm)) {
      versions = readdirSync(nvm).filter(name => /^v24\.\d+\.\d+$/.test(name)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    }
  } catch { /* Unreadable manager directory: print guidance instead. */ }
  const pathFolders = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':');
  return [
    ...versions.map(name => ({ path: join(nvm, name, 'bin/node'), manager: 'nvm' })),
    ...(pathFolders.includes('/opt/homebrew/bin') ? [{ path: '/opt/homebrew/opt/node@24/bin/node', manager: 'Homebrew' }] : []),
    ...(pathFolders.includes('/usr/local/bin') ? [{ path: '/usr/local/opt/node@24/bin/node', manager: 'Homebrew' }] : []),
  ];
}

function verified(candidate) {
  try {
    const real = realpathSync(candidate.path);
    const info = statSync(real);
    if (!info.isFile() || ![0, process.getuid?.()].includes(info.uid) || (info.mode & 0o022)) return false;
    // Only known manager layouts. Do not search PATH or execute a path supplied by the caller.
    if (candidate.manager === 'nvm') {
      if (real !== candidate.path || !real.startsWith(join(home, '.nvm/versions/node/v24.'))) return false;
      for (let path = dirname(real); path !== home; path = dirname(path)) {
        const dir = lstatSync(path);
        if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o022)) return false;
      }
    } else if (!real.startsWith('/opt/homebrew/Cellar/node@24/') && !real.startsWith('/usr/local/Cellar/node@24/')) return false;
    const result = spawnSync(real, ['--version'], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
    return result.status === 0 && /^v24\.\d+\.\d+\s*$/.test(result.stdout);
  } catch { return false; }
}

function guidance() {
  const nvm = existsSync(join(home, '.nvm/nvm.sh'));
  const brew = existsSync('/opt/homebrew/bin/brew') || existsSync('/usr/local/bin/brew');
  const manager = nvm ? '. "$HOME/.nvm/nvm.sh"\nnvm install 24\nnvm use 24' : brew
    ? 'brew install node@24\n# Then select it in this terminal:\nexport PATH="$(brew --prefix node@24)/bin:$PATH"'
    : 'Install Node 24 from https://nodejs.org/en/download, then open a new terminal.';
  return `Conquistador needs Node 24 (current: ${process.version}). No project files were changed.\n${manager}\nCheck: node --version  # must print v24.x\nThen rerun: ${shellCommand(['conquistador', ...process.argv.slice(2)])}\nThis command cannot switch your parent shell.`;
}

// null means the original command may continue. A number is this invocation's exit status.
export async function nodePreflight() {
  if (supported()) return null;
  const message = guidance();
  if (process.env.CONQUISTADOR_NODE_PREFLIGHT === '1') {
    console.error(`[conquistador] The selected executable did not start Node 24.\n${message}`);
    return 1;
  }
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive) { console.error(`[conquistador] ${message}`); return 1; }
  const found = candidates().find(verified);
  const ui = cancellableUi(await import('./vendor/clack.mjs'));
  ui.intro('Conquistador requires Node 24');
  let choice;
  try {
    choice = await ui.select({
      message: found ? `Current Node: ${process.version}. How do you want to continue?` : `Current Node: ${process.version}. How do you want to proceed?`,
      options: [
        ...(found ? [{ value: 'continue', label: `Continue this command with verified ${found.manager} Node 24`, hint: found.path }] : []),
        { value: 'instructions', label: 'Show Node 24 selection instructions' },
        { value: 'cancel', label: 'Cancel' },
      ],
    });
  } catch (error) {
    if (!error.cancelled) throw error;
    ui.cancel('Cancelled. No project files changed.');
    return error.exitCode ?? 0;
  }
  if (ui.isCancel(choice) || choice === 'cancel') { ui.cancel('Cancelled. No project files changed.'); return 130; }
  if (choice !== 'continue' || !found) { ui.note(message, 'Node 24 setup'); return 1; }
  // A second check narrows the interval between selection and execution. The marker
  // prevents a broken candidate from re-opening this prompt in the child.
  if (!verified(found)) {
    console.error(`[conquistador] Node 24 could not be verified.\n${message}`);
    return 1;
  }
  ui.outro(`Continuing with ${found.path}. Your shell's Node selection is unchanged.`);
  return new Promise(resolve => {
    const child = spawn(found.path, [process.argv[1], ...process.argv.slice(2)], {
      cwd: process.cwd(), env: { ...process.env, CONQUISTADOR_NODE_PREFLIGHT: '1' }, stdio: 'inherit',
    });
    let forwarded;
    let spawnError;
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    const forward = Object.fromEntries(signals.map(signal => [signal, () => {
      forwarded ??= signal;
      child.kill(signal);
    }]));
    for (const signal of signals) process.on(signal, forward[signal]);
    child.on('error', error => { spawnError = error; });
    child.on('close', (code, signal) => {
      for (const name of signals) process.off(name, forward[name]);
      if (spawnError) console.error(`[conquistador] ${spawnError.message}\n${message}`);
      resolve(spawnError ? 1 : (signal || forwarded) ? 128 + (constants.signals[signal || forwarded] ?? 1) : code ?? 1);
    });
  });
}
