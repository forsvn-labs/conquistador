import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectExecutor, setupGuide, OFFICIAL_INSTALL, CONNECT_AGENT } from './setup.mjs';
import { run } from './cli.mjs';

const credential = 'super-secret-executor-bearer';
function missing() {
  const error = new Error('not found');
  error.code = 'ENOENT';
  throw error;
}
async function capture(args, extra = {}) {
  let output = '', errors = '';
  const io = {
    stdout: { write: s => { output += s; } },
    stderr: { write: s => { errors += s; } },
    env: extra.env ?? {},
    execFile: extra.execFile,
  };
  const code = await run(args, io);
  return { code, output, errors };
}

test('inspect reports a missing binary without reading secrets', async () => {
  const inspect = await inspectExecutor({ env: { CONQUISTADOR_EXECUTOR_ACCESS: credential }, execFile: missing });
  assert.equal(inspect.installed, false);
  assert.equal(inspect.version, null);
  assert.equal(inspect.authEnvPresent, true);
  assert.equal(inspect.connectionVerified, false);
  assert.equal(inspect.providerVerified, false);
  assert.equal(JSON.stringify(inspect).includes(credential), false);
});

test('inspect records a version from --version stdout', async () => {
  const inspect = await inspectExecutor({
    env: {},
    execFile: async () => ({ stdout: '1.6.8\n', stderr: '' }),
  });
  assert.equal(inspect.installed, true);
  assert.equal(inspect.version, '1.6.8');
  assert.equal(inspect.defaultEndpoint, 'http://127.0.0.1:4788/mcp');
});

test('setup guide for a missing install cites official npm and Cloud docs', () => {
  const guide = setupGuide({
    schema: 'conquistador.executor-status/v1', installed: false, version: null,
    defaultEndpoint: 'http://127.0.0.1:4788/mcp', defaultUiUrl: 'http://127.0.0.1:4788/',
    authEnvPresent: false, docs: { intro: 'https://executor.sh/docs', cli: 'https://executor.sh/docs/local/cli',
      cloud: 'https://executor.sh/docs/hosted/cloud' }, connectionVerified: false, providerVerified: false,
  });
  assert.equal(guide.status, 'install-required');
  assert.equal(guide.officialInstall.npm, OFFICIAL_INSTALL.npm);
  assert.match(guide.next[0], /npm install -g executor/);
  assert.match(guide.next[1], /executor\.sh\/docs\/hosted\/cloud/);
  assert.equal(guide.connectAgent, CONNECT_AGENT);
});

test('CLI setup and status take no flags and print JSON only', async () => {
  const setup = await capture(['setup'], { execFile: missing });
  assert.equal(setup.code, 0);
  const body = JSON.parse(setup.output);
  assert.equal(body.status, 'install-required');
  assert.equal(body.installed, false);
  assert.equal(setup.errors, '');
  const status = await capture(['status'], {
    env: { CONQUISTADOR_EXECUTOR_ACCESS: credential },
    execFile: async () => ({ stdout: '1.6.8\n', stderr: '' }),
  });
  assert.equal(status.code, 0);
  const reported = JSON.parse(status.output);
  assert.equal(reported.schema, 'conquistador.executor-status/v1');
  assert.equal(reported.installed, true);
  assert.equal(reported.version, '1.6.8');
  assert.equal(reported.authEnvPresent, true);
  assert.equal(status.output.includes(credential), false);
  assert.equal((await capture(['setup', '--endpoint', 'https://executor.example/mcp'])).code, 1);
});

test('help lists setup before prepare', async () => {
  const help = await capture(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.output, /setup/);
  assert.match(help.output, /prepare/);
  assert.ok(help.output.indexOf('setup') < help.output.indexOf('prepare'));
});
