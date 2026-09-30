// `conquistador update` gets the newest registry version first, then that version registers itself
// with every agent. Case IDs (U1–U13) are in docs/REVIEW-2026-09-SURFACES.md, Part 5.
import { spawnSync } from 'node:child_process';
import { spawnCommand } from './spawn.mjs';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { productRoot, tilde, version } from './agents.mjs';

export const PACKAGE = '@forsvn/conquistador';
const windows = process.platform === 'win32';
const npm = 'npm';
const npx = 'npx';

// Semver order: 0.0.9 < 0.0.17 < 0.1.0-beta.1 < 0.1.0 (U5). Returns true when a is newer than b.
export function newer(a, b) {
  const parse = text => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(text).trim());
    return match ? { core: match.slice(1, 4).map(Number), pre: match[4] ? match[4].split('.') : [] } : null;
  };
  const left = parse(a), right = parse(b);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index];
  if (!left.pre.length || !right.pre.length) return !left.pre.length && right.pre.length > 0;
  for (let index = 0; index < Math.max(left.pre.length, right.pre.length); index += 1) {
    const x = left.pre[index], y = right.pre[index];
    if (x === undefined || y === undefined) return y === undefined;
    if (x === y) continue;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) > Number(y);
    if (nx !== ny) return ny;
    return x > y;
  }
  return false;
}

// How this copy was installed. A global package sits at PREFIX/lib/node_modules/@forsvn/conquistador
// (PREFIX/node_modules/… on Windows) and npm put a `conquistador` command next to it.
export function channel(root = productRoot) {
  if (/[\\/]_npx[\\/]/.test(root)) return { kind: 'npx' };
  const modules = dirname(dirname(root));
  if (basename(root) === 'conquistador' && basename(dirname(root)) === '@forsvn' && basename(modules) === 'node_modules') {
    const prefix = windows ? dirname(modules) : basename(dirname(modules)) === 'lib' ? dirname(dirname(modules)) : null;
    if (prefix && existsSync(windows ? join(prefix, 'conquistador.cmd') : join(prefix, 'bin', 'conquistador'))) return { kind: 'global', prefix };
  }
  return { kind: 'other' };
}

// Asks the registry the user configured (npm_config_registry, .npmrc) for `latest` (U13).
// spawnSync with exact arguments on every platform (npm is npm.cmd on Windows).
function exec(command, args, options) {
  const { file, args: fileArgs, options: extra } = spawnCommand(command, args, options.env ?? process.env);
  return spawnSync(file, fileArgs, { ...options, ...extra });
}

export function latest() {
  const result = exec(npm, ['view', `${PACKAGE}@latest`, 'version', '--json'], { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error?.code === 'ETIMEDOUT' || result.signal) return { error: 'the npm registry did not answer in 15 s' };
  if (result.error) return { error: `npm did not run (${result.error.code ?? result.error.message})` };
  const code = /npm (?:error|ERR!) code (\w+)/.exec(result.stderr ?? '')?.[1];
  if (code === 'E404') return { error: `${PACKAGE} is not on the npm registry yet` };
  if (result.status !== 0) return { error: `the npm registry did not answer (${code ?? `npm exit ${result.status}`})` };
  try {
    const found = JSON.parse(result.stdout);
    return typeof found === 'string' ? { version: found } : { error: 'the npm registry sent an unexpected answer' };
  } catch { return { error: 'the npm registry sent an unexpected answer' }; }
}

const shown = ([command, args]) => [basename(command) === basename(process.execPath) ? 'node' : command, ...args].map(item => (/^[\w./:@=+-]+$/.test(item) ? item : `'${item}'`)).join(' ');

// Returns null when the caller should register this copy again, or the exit code of the handoff.
export function selfUpdate(args, { dryRun = false, log = console.log } = {}) {
  // The new version was started by an older one. It must not ask the registry again (U7).
  if (process.env.CONQUISTADOR_UPDATED_FROM) return null;
  const found = latest();
  if (found.error) { console.log(`Could not check for a newer version: ${found.error}. Reinstalling ${version}.`); return null; }
  if (!newer(found.version, version)) { console.log(`${version} is the latest version.`); return null; }
  const how = channel();
  if (how.kind === 'other') {
    console.log(`${found.version} is available. This copy runs from ${tilde(productRoot)}, so update does not replace it.\nTo install the latest version: npm install -g ${PACKAGE}`);
    return null;
  }
  const forward = args.filter(arg => arg !== '--dry-run');
  const env = { ...process.env, CONQUISTADOR_UPDATED_FROM: version };
  // npm replaces this package in place, so the new version starts from the same path.
  const steps = how.kind === 'global'
    ? [[npm, ['install', '--global', '--prefix', how.prefix, '--ignore-scripts', '--no-audit', '--no-fund', `${PACKAGE}@${found.version}`]], [process.execPath, [join(productRoot, 'runtime', 'bin', 'conquistador.js'), 'update', ...forward]]]
    : [[npx, ['--yes', `${PACKAGE}@${found.version}`, 'update', ...forward]]];
  console.log(`Updating ${version} to ${found.version}${dryRun ? ' (dry run)' : ''}`);
  if (dryRun) { for (const item of steps) log(shown(item)); return 0; }
  if (how.kind === 'global') {
    const [command, commandArgs] = steps.shift();
    log(shown([command, commandArgs]));
    const result = exec(command, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600_000 });
    if (result.status !== 0) {
      const lines = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').filter(line => /error|EACCES|EPERM/i.test(line)).slice(-4);
      // The installed version and the agents stay as they were (U6).
      console.log(`${lines.length ? `${lines.join('\n')}\n` : ''}Could not install ${found.version}. ${version} and your agents are unchanged.\nTo retry: ${shown([command, commandArgs])}`);
      return 1;
    }
  }
  const [command, commandArgs] = steps[0];
  const result = exec(command, commandArgs, { env, stdio: 'inherit' });
  return result.status ?? 1;
}
