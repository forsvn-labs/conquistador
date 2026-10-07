import { spawnSync } from 'node:child_process';
import { spawnCommand } from './spawn.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Use Node 24 or later.');
const npm = 'npm';
function run(command, args, cwd = root) {
  const { file, args: fileArgs, options } = spawnCommand(command, args);
  const result = spawnSync(file, fileArgs, { cwd, stdio: 'inherit', timeout: 600_000, ...options });
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
  // Every knowledge file must appear in its method's generated playbook map.
  run(process.execPath, ['tools/knowledge-map.mjs', '--check']);
  run(process.execPath, ['--test', 'tools/dev.test.mjs', 'tools/front-door.test.mjs', 'tools/bot-pack.test.mjs', 'tools/plugin-payload.test.mjs', 'tools/conquistador-hook.test.mjs', 'tools/project-installation.test.mjs', 'tools/install.test.mjs', 'tools/context-selection.test.mjs', 'tools/routing-contract.test.mjs', 'tools/proactive.test.mjs', 'tools/plugin-contracts.test.mjs', 'tools/setup.test.mjs', 'tools/setup-portability.test.mjs', 'tools/lazy-discovery.test.mjs', 'tools/setup-entry.test.mjs', 'tools/installation-doctor.test.mjs', 'tools/content-learning-contracts.test.mjs', 'tools/skills-mcp.test.mjs', 'tools/agent-tools.test.mjs', 'hosts/coding-agent/orchestrate.test.mjs', 'hosts/coding-agent/operator.test.mjs', 'hosts/coding-agent/operator-experience.test.mjs', 'tools/package-boundary.test.mjs', 'tools/domain-package.test.mjs', 'tools/conquistador-mode.test.mjs', 'tools/integration-releases.test.mjs', 'tools/onboarding.test.mjs', 'tools/growth-diagnosis.e2e.test.mjs']);
  for (const module of ['runtime', 'catalog', 'evals']) run(npm, ['test'], resolve(root, module));
  run(npm, ['run', 'catalog:check'], resolve(root, 'catalog'));
  run(npm, ['run', 'example:local'], resolve(root, 'evals'));
} else {
  throw new Error('Usage: node tools/dev.mjs bootstrap|build|test');
}
