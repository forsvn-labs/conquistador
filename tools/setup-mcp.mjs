import { cpSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { isPackageCache } from './install-paths.mjs';
import { operatorFiles } from './operator-package.mjs';

export function runtimeSource(root) {
  const stable = realpathSync(root);
  if (isPackageCache(stable)) throw Error('Runtime MCP needs a stable installation, not an npm/Bun cache. Install the verified tarball into a dedicated prefix, then pass its package directory with --runtime-path ABS. See docs/INSTALL-REFERENCE.md#persistent-cli.');
  for (const file of ['package.json', 'runtime/bin/conquistador.js', 'runtime/lib/main.js']) {
    if (!lstatSync(join(stable, file)).isFile()) throw Error('Runtime distribution is incomplete.');
  }
  if (JSON.parse(readFileSync(join(stable, 'package.json'), 'utf8')).name !== '@forsvn/conquistador') throw Error('Choose a Conquistador runtime distribution.');
  try { createRequire(join(stable, 'package.json')).resolve('jose'); }
  catch { throw Error('Runtime dependency is missing. Install the verified tarball into a stable npm prefix, or bootstrap the separate runtime source.'); }
  return stable;
}

function copyRegular(source, destination) {
  const info = lstatSync(source);
  if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw Error('MCP bundle contains a link or special file.');
  if (info.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source)) copyRegular(join(source, name), join(destination, name));
  } else {
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { errorOnExist: true, force: false });
  }
}

export function stageMcp(temporary, destination, source, url) {
  let packageRoot = source;
  if (!url) {
    packageRoot = join(destination, 'bundle');
    const files = ['package.json', 'LICENSE', 'NOTICE.md', 'SKILL.md', 'skills', 'release/completeness.json',
      'runtime/bin/conquistador.js', 'tools/skills-mcp.mjs', ...operatorFiles];
    for (const file of files) copyRegular(join(source, file), join(temporary, 'bundle', file));
  }
  const connector = { command: process.execPath, args: [join(packageRoot, 'runtime/bin/conquistador.js'), 'mcp', ...(url ? ['--url', url] : [])] };
  writeFileSync(join(temporary, 'connector.json'), JSON.stringify(connector, null, 2) + '\n');
}
