import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) { throw new Error(message); }
function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index], value = argv[index + 1];
    if (!['--spec', '--version', '--root'].includes(flag) || !value) fail('Usage: --spec GIT_SPEC --version VERSION [--root EMPTY_PATH]');
    options[flag.slice(2)] = value;
  }
  if (!options.spec || !options.version) fail('Usage: --spec GIT_SPEC --version VERSION [--root EMPTY_PATH]');
  return options;
}
function filesBelow(root) {
  const files = [];
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) visit(path);
      else files.push(relative(root, path));
    }
  }
  visit(root);
  return files.sort();
}

export function verifyPrivateGitInstall({ spec, version, root }) {
  if (Number(process.versions.node.split('.')[0]) !== 24) fail('Use Node 24.');
  const workspace = root ? resolve(root) : realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-private-git-')));
  if (root) {
    if (existsSync(workspace)) fail('--root must not exist.');
    mkdirSync(workspace, { recursive: true });
  }
  const prefix = join(workspace, 'prefix'), cache = join(workspace, 'npm-cache'), project = join(workspace, 'project');
  mkdirSync(prefix); mkdirSync(cache); mkdirSync(project);
  writeFileSync(join(project, 'sentinel.txt'), 'preserve me\n');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const run = (file, args, cwd = project) => execFileSync(file, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 });
  run(npm, ['install', '--global', '--ignore-scripts', '--install-links', '--prefix', prefix, '--cache', cache, spec]);
  const cli = process.platform === 'win32' ? join(prefix, 'conquistador.cmd') : join(prefix, 'bin', 'conquistador');
  if (!existsSync(cli)) fail('npm reported success without installing the Conquistador executable.');
  const resolvedCli = realpathSync(cli);
  const resolvedPrefix = realpathSync(prefix);
  if (resolvedCli !== resolvedPrefix && !resolvedCli.startsWith(`${resolvedPrefix}${sep}`)) fail('The executable resolves outside the durable npm prefix.');
  rmSync(cache, { recursive: true, force: true });
  if (!existsSync(cli)) fail('The executable depended on the deleted acquisition cache.');
  if (run(cli, ['version']).trim() !== version) fail('The installed CLI reported an unexpected version.');
  run(cli, ['setup', 'install', '--target', 'operator', '--project', project, '--host', 'codex']);
  const report = JSON.parse(run(cli, ['operator', 'doctor', '--project', project, '--json']));
  if (report.status !== 'local-files-verified' || report.library?.available !== 38) fail('Installed operator did not pass doctor.');
  if (!existsSync(join(project, '.conquistador', 'SKILL.md')) || !existsSync(join(project, '.agents', 'skills', 'conquistador', 'SKILL.md'))) fail('Expected project skill files are missing.');
  run(cli, ['start', '--project', project]);
  run(cli, ['operator', 'update', '--project', project]);
  run(cli, ['operator', 'uninstall', '--project', project]);
  const remaining = filesBelow(project);
  if (remaining.length !== 1 || remaining[0] !== 'sentinel.txt' || readFileSync(join(project, 'sentinel.txt'), 'utf8') !== 'preserve me\n') fail('Removal did not preserve the receiving project exactly.');
  return { status: 'passed', spec, version, workspace, cli: resolvedCli, cacheRemovedBeforeLifecycle: true, methods: 38, remaining };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(verifyPrivateGitInstall(parse(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
