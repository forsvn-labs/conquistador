import path from 'node:path';

// path.relative returns an absolute path across Windows drives or UNC shares.
export function containsPath(parent, child, paths = path) {
  const part = paths.relative(parent, child);
  return !part || (!paths.isAbsolute(part) && part !== '..' && !part.startsWith(`..${paths.sep}`));
}

export function isRuntimeExecutable(file, paths = path) {
  return paths.basename(file) === 'conquistador.js' &&
    paths.basename(paths.dirname(file)) === 'bin' &&
    paths.basename(paths.dirname(paths.dirname(file))) === 'runtime';
}

export function isPackageCache(file) {
  const parts = file.replaceAll('\\', '/').split('/');
  return parts.some(part => ['_npx', '_cacache'].includes(part) || /^bunx-/.test(part)) ||
    /(?:^|\/)\.bun\/install\/cache(?:\/|$)/.test(parts.join('/'));
}

// Windows output is explicitly PowerShell, including its call operator.
export function shellCommand(args, platform = process.platform) {
  const quote = platform === 'win32'
    ? value => `'${value.replaceAll("'", "''")}'`
    : value => `'${value.replaceAll("'", "'\\''")}'`;
  if (args.some(value => /[\x00-\x1f\x7f]/.test(value))) throw Error('Command contains control characters.');
  return `${platform === 'win32' ? '& ' : ''}${args.map(quote).join(' ')}`;
}
