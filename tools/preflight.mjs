// Preflight for the first-run flow. It is silent unless there is a problem:
// - another `conquistador` on PATH runs instead of this copy, or has another version;
// - npm has a newer version (cached for a day, short timeout, never waits for the network).
// The Node version check stays in runtime/bin/conquistador.js and tools/node-preflight.mjs.
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, posix, win32 } from 'node:path';
import { newer } from './self-update.mjs';

export const PACKAGE = '@forsvn/conquistador';
const DAY = 24 * 60 * 60 * 1000;

const isFileDefault = path => { try { return statSync(path).isFile(); } catch { return false; } };
const realDefault = path => { try { return realpathSync(path); } catch { return path; } };
const tildePath = path => (path.startsWith(`${homedir()}/`) ? `~${path.slice(homedir().length)}` : path);

// Every `conquistador` command on PATH, in PATH order, one per folder.
export function pathCopies({ PATH = process.env.PATH ?? '', platform = process.platform, isFile = isFileDefault, resolve = realDefault } = {}) {
  const { join: joinPath } = platform === 'win32' ? win32 : posix;
  const names = platform === 'win32' ? ['conquistador.cmd', 'conquistador.exe'] : ['conquistador'];
  const copies = [];
  for (const folder of PATH.split(platform === 'win32' ? ';' : ':')) {
    if (!folder) continue;
    const path = names.map(name => joinPath(folder, name)).find(isFile);
    if (path && !copies.some(item => item.path === path)) copies.push({ path, real: resolve(path) });
  }
  return copies;
}

// The package folder and version behind one command. Nothing is executed.
export function copyInfo({ path, real }) {
  let root = null;
  if (/\.cmd$/i.test(path)) {
    // npm's Windows shim runs %dp0%\node_modules\@forsvn\conquistador\...
    const candidate = join(dirname(path), 'node_modules', '@forsvn', 'conquistador');
    if (existsSync(join(candidate, 'package.json'))) root = candidate;
  } else {
    for (let folder = dirname(real), depth = 0; depth < 5 && folder !== dirname(folder); folder = dirname(folder), depth += 1) {
      try { if (JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')).name === PACKAGE) { root = folder; break; } } catch { /* Keep looking. */ }
    }
  }
  let version = null;
  try { version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version; } catch { /* Unknown. */ }
  return { path, real, root: root ? realDefault(root) : null, version };
}

// The command that removes one copy: npm's own uninstall when the copy is an npm global install.
function removeCommand(copy) {
  const prefix = /^(.*)[\\/]lib[\\/]node_modules[\\/]@forsvn[\\/]conquistador$/.exec(copy.root ?? '')?.[1]
    ?? /^(.*)[\\/]node_modules[\\/]@forsvn[\\/]conquistador$/.exec(copy.root ?? '')?.[1];
  return prefix ? `npm uninstall -g --prefix ${tildePath(prefix)} ${PACKAGE}` : `rm ${tildePath(copy.path)}`;
}

// null, or the problem and the exact fix. `self` is this copy: { root, version }.
export function shadowCheck(copies, self) {
  if (!copies.length) return null;
  const [first] = copies;
  if (first.root && first.root === self.root) {
    const other = copies.slice(1).find(copy => copy.root !== self.root && copy.version && copy.version !== self.version);
    if (!other) return null;
    return { message: `Another conquistador on your PATH has version ${other.version}: ${tildePath(other.path)}. This copy is ${self.version}.`, fix: [`Remove the other copy: ${removeCommand(other)}`] };
  }
  if (first.version === self.version) return null;
  return {
    message: `The conquistador command on your PATH is ${first.version ? `version ${first.version}` : 'another copy'} (${tildePath(first.path)}). You are running ${self.version}. Later runs of conquistador use ${first.version ?? 'that copy'}.`,
    fix: [`Install this version for every shell: npm i -g ${PACKAGE}@latest`, `Or remove the old copy: ${removeCommand(first)}`],
  };
}

export function updateNotice(latest, current, channel) {
  if (!latest || !newer(latest, current)) return null;
  return channel === 'npx'
    ? `Conquistador ${latest} is out. You ran ${current}.\nNext time run: npx ${PACKAGE}@latest`
    : `Conquistador ${latest} is out. You have ${current}.\nUpdate: npm i -g ${PACKAGE}@latest`;
}

// Ask the configured registry for `latest`. Resolves to a version or null; never throws.
export async function latestVersion({ registry = process.env.npm_config_registry || 'https://registry.npmjs.org/', timeout = 1500 } = {}) {
  try {
    const url = `${registry.replace(/\/?$/, '/')}${PACKAGE.replace('/', '%2F')}/latest`;
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const { version } = await response.json();
    return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version) ? version : null;
  } catch { return null; }
}

// The update check: a fresh cache answers at once; otherwise the registry is asked in the
// background. `persist()` writes the cache; callers run it only once files may change.
export function startUpdateCheck({ file, now = Date.now(), env = process.env } = {}) {
  if (env.CONQUISTADOR_NO_UPDATE_CHECK === '1' || /^(?:1|true)$/i.test(env.npm_config_offline ?? '')) return { cached: null, latest: async () => null, persist() {} };
  let cache = null;
  try { cache = JSON.parse(readFileSync(file, 'utf8')); } catch { /* No cache. */ }
  if (cache && typeof cache.latest === 'string' && now - Date.parse(cache.checkedAt) < DAY) return { cached: cache.latest, latest: async () => cache.latest, persist() {} };
  let found;
  const pending = latestVersion().then(version => { found = version; return version; });
  return {
    cached: null,
    // Wait at most `wait` ms for the answer.
    latest: (wait = 0) => Promise.race([pending, new Promise(done => setTimeout(done, wait, found ?? null).unref())]),
    persist() {
      if (!found) return;
      try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, `${JSON.stringify({ latest: found, checkedAt: new Date(now).toISOString() })}\n`); } catch { /* A cache is optional. */ }
    },
  };
}

// True when the host answers at all within the timeout. Any HTTP status counts.
export async function reachable(url, timeout = 1500) {
  try { await fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeout) }); return true; } catch { return false; }
}

export function shadowProblem({ self, env = process.env, platform = process.platform } = {}) {
  return shadowCheck(pathCopies({ PATH: env.PATH ?? '', platform }).map(copyInfo), self);
}
