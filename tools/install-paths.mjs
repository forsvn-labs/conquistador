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

function quotedArguments(args, platform) {
  const quote = platform === 'win32'
    ? value => `'${value.replaceAll("'", "''")}'`
    : value => `'${value.replaceAll("'", "'\\''")}'`;
  if (args.some(value => /[\x00-\x1f\x7f]/.test(value))) throw Error('Command contains control characters.');
  return args.map(quote).join(' ');
}

// Windows output is explicitly PowerShell, including its call operator.
export function shellCommand(args, platform = process.platform) {
  return `${platform === 'win32' ? '& ' : ''}${quotedArguments(args, platform)}`;
}

export function shellDirectory(path, platform = process.platform) {
  // Cmdlet parameter names must remain syntax, unlike arguments to native CLIs.
  return platform === 'win32'
    ? `Set-Location -LiteralPath ${quotedArguments([path], platform)}`
    : shellCommand(['cd', path], platform);
}

export function serviceUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('Use an HTTP/HTTPS service origin.'); }
  if (!/^https?:\/\//.test(value) || /[\s\\?#]/.test(value) || url.username || url.password || url.pathname !== '/' ||
      !['http:', 'https:'].includes(url.protocol) ||
      (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw Error('Use an HTTPS origin or loopback HTTP origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}
