import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('package acquisition has no automatic install or publication hooks', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.private, true);
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly']) {
    assert.equal(manifest.scripts[hook], undefined, `${hook} would change acquisition behavior`);
  }
});

test('the advertised persistent private-Git command copies out of npm acquisition storage', () => {
  // The advertised command must pin the latest verified private release.
  const expected = 'npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.14';
  for (const file of ['README.md', 'INSTALL.md']) {
    const contents = readFileSync(join(root, file), 'utf8');
    assert.match(contents, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(contents, /npm install -g --ignore-scripts github:forsvn-labs\/conquistador/);
  }
});

test('the installed setup command works before runtime libraries or dependencies are present', () => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador setup entry ')));
  try {
    const source = join(temporary, 'distribution');
    for (const file of ['package.json', 'runtime/bin/conquistador.js', 'tools/setup.mjs', 'tools/operator-setup.mjs', 'tools/domain-package.mjs',
      'tools/install-paths.mjs', 'tools/setup-routes.mjs', 'tools/method-library.mjs', 'tools/stage-method-library.mjs', 'tools/setup-guide.mjs', 'tools/setup-mcp.mjs', 'tools/operator-package.mjs', 'tools/project-installation.mjs', 'tools/setup-surfaces.mjs', 'tools/operator-profile.mjs',
      'tools/conquistador-mode.mjs', 'tools/proactive.mjs', 'tools/context-selection.mjs', 'tools/routing-contract.mjs', 'tools/request-text.mjs', 'tools/plugin-contracts.mjs',
      'tools/onboarding-safety.mjs', 'tools/onboarding-ui.mjs', 'tools/onboarding.mjs', 'tools/onboarding-recovery.mjs', 'tools/onboarding-parse.mjs', 'tools/onboarding-hosts.mjs', 'tools/onboarding-routes.mjs', 'tools/vendor/clack.mjs']) {
      const target = join(source, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, file), target);
    }
    assert.equal(existsSync(join(source, 'runtime/lib')), false);
    assert.equal(existsSync(join(source, 'node_modules')), false);
    const run = (...args) => execFileSync(process.execPath, [join(source, 'runtime/bin/conquistador.js'), 'setup', ...args], { encoding: 'utf8' });
    assert.match(run('--help'), /status\|doctor\|update\|uninstall/);
    const cli = (...args) => execFileSync(process.execPath, [join(source, 'runtime/bin/conquistador.js'), ...args], { encoding: 'utf8' });
    assert.match(cli('--help'), /conquistador --bot/);
    assert.match(cli('--help'), /--advanced/);
    assert.doesNotMatch(cli('--help'), /What would you like to set up/);
    for (const flag of ['--bot', '--skills', '--plugin', '--mcp', '--advanced']) assert.match(cli(flag, '--help'), /Usage:/);
    assert.match(cli('install', '--help'), /conquistador install/);
    assert.match(cli('operator', '--help'), /operator install\|status\|doctor\|update\|uninstall/);
    const destination = join(temporary, 'missing skill');
    assert.match(run('status', '--path', destination), /Local state: absent/);
    assert.equal(existsSync(destination), false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('optional integration help stays usable before runtime and vendor packages are installed', () => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador integration entry ')));
  try {
    for (const file of ['package.json', 'runtime/bin/conquistador.js', 'hosts/executor/cli.mjs',
      'hosts/executor/config.mjs', 'hosts/executor/setup.mjs', 'hosts/eve/jobs.mjs', 'tools/integration-releases.mjs']) {
      const target = join(temporary, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, file), target);
    }
    const run = (...args) => execFileSync(process.execPath, [join(temporary, 'runtime/bin/conquistador.js'), ...args], { encoding: 'utf8' });
    for (const [command, expected] of [['connections', /setup[\s\S]*prepare/], ['jobs', /submit/], ['integrations', /check-updates/]]) {
      assert.match(run(command, '--help'), expected);
    }
    const config = JSON.parse(run('connections', 'prepare', '--endpoint', 'https://executor.example/mcp',
      '--ui-url', 'https://executor.example/', '--auth-env', 'CONQUISTADOR_EXECUTOR_ACCESS'));
    assert.equal(config.authEnv, 'CONQUISTADOR_EXECUTOR_ACCESS');
    assert.equal(existsSync(join(temporary, 'node_modules')), false);
    assert.equal(existsSync(join(temporary, 'runtime/lib')), false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('team refuses an existing result before reading the plan or calling BB', async () => {
  const { spawnSync } = await import('node:child_process');
  const { writeFileSync, readFileSync } = await import('node:fs');
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador team output ')));
  const output = join(temporary, 'existing.json');
  try {
    writeFileSync(output, 'Keep the original report.');
    const run = spawnSync(process.execPath, [join(root, 'hosts/coding-agent/team.mjs'),
      join(temporary, 'missing-plan.json'), 'proj_test', 'env_test', output],
    { encoding: 'utf8', env: { ...process.env, BB_CLI: '/nonexistent', BB_THREAD_ID: 'thr_parent' } });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /EEXIST/);
    assert.doesNotMatch(run.stderr, /missing-plan|BB command/);
    assert.equal(readFileSync(output, 'utf8'), 'Keep the original report.');
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
