import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24.');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', timeout: 600_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const [task, ...extra] = process.argv.slice(2);
if (extra.length) throw new Error('Use bootstrap, build, or test without extra arguments.');
if (task === 'bootstrap') {
  run(npm, ['install', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund']);
  for (const module of ['runtime', 'catalog', 'evals']) {
    run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], resolve(root, module));
  }
} else if (task === 'build') {
  run(npm, ['run', 'build'], resolve(root, 'runtime'));
  run(npm, ['run', 'typecheck:public'], resolve(root, 'runtime'));
  run(npm, ['run', 'typecheck'], resolve(root, 'catalog'));
} else if (task === 'test') {
  run(process.execPath, ['--test', 'tools/dev.test.mjs', 'tools/install.test.mjs', 'tools/proactive.test.mjs']);
  for (const module of ['runtime', 'catalog', 'evals']) run(npm, ['test'], resolve(root, module));
  run(npm, ['run', 'catalog:check'], resolve(root, 'catalog'));
  run(npm, ['run', 'example:local'], resolve(root, 'evals'));
} else {
  throw new Error('Usage: node tools/dev.mjs bootstrap|build|test');
}
