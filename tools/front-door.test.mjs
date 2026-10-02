// Synthetic host CLIs only: these checks establish installer/control-flow behavior, not model output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStart, parseStart } from './launch.mjs';
import { runAdd, runRemove, runUpdate, runAgents } from './front-door.mjs';
import { pluginHome, readState, writeState } from './agents.mjs';
import { spawnCommand } from './spawn.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

const cli = join(root, 'runtime/bin/conquistador.js');

const cancel = Symbol('cancel');

function fixture(t, commands = ['claude', 'codex']) {
  const directory = mkdtempSync(join(tmpdir(), 'conquistador front door '));
  const bin = join(directory, 'bin'); mkdirSync(bin);
  const saved = { ...process.env };

  const env = { HOME: directory, USERPROFILE: directory, XDG_CONFIG_HOME: join(directory, '.config'),
    CONQUISTADOR_HOME: join(directory, '.conquistador'), CURSOR_HOME: join(directory, '.cursor'),
    CODEX_HOME: join(directory, '.codex'), CLAUDE_CONFIG_DIR: join(directory, '.claude'),
    CONQUISTADOR_PLAYBOOKS: '', CONQUISTADOR_UPDATED_FROM: 'synthetic-test', CONQUISTADOR_CACHE: join(directory, 'cache'),
    PATH: bin, TEST_HOST_LOG: join(directory, 'calls.jsonl'), TEST_HOST_HOME: directory };

  Object.assign(process.env, env);

  for (const command of commands) {
    const source = `#!${process.execPath}\nimport { appendFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), host = ${JSON.stringify(command)};
appendFileSync(process.env.TEST_HOST_LOG, JSON.stringify({host,args})+'\\n');
const marker = process.env.TEST_HOST_HOME+'/'+host+'.registered';
if (args[0]==='--version') console.log('2.1.283');
else if (args.includes('list')) { if (existsSync(marker)) console.log('"conquistador@conquistador"'); }
else if (args.includes('uninstall') || args[1]==='remove') rmSync(marker,{force:true});
else if (args[0]==='plugin' && args[1]!=='marketplace') {
  if(process.env.TEST_FAIL_HOST===host) {console.error('synthetic registration failure');process.exit(1);}
  writeFileSync(marker,'synthetic registration');
}\n`;

    writeFileSync(join(bin, `${command}.mjs`), source);

    if (process.platform === 'win32') writeFileSync(join(bin, `${command}.cmd`), `@echo off\n"%_prog%" "%dp0%\\${command}.mjs" %*\n`);
    else { writeFileSync(join(bin, command), source); chmodSync(join(bin, command), 0o755); }
  }

  t.after(() => { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); rmSync(directory, { recursive: true, force: true }); });

  return { directory, env: { ...process.env }, calls: () => existsSync(env.TEST_HOST_LOG) ? readFileSync(env.TEST_HOST_LOG, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [] };
}

function ui({ selected = 'codex', consent = true, task = 'Draft one welcome email' } = {}) {
  const messages = [], questions = [];

  return { messages, questions, intro() {}, outro: value => messages.push(value), cancel: value => messages.push(value),
    note: value => messages.push(value), isCancel: value => value === cancel,
    select: async options => {
      questions.push(options.message);

      return options.message === 'Open in' ? selected : task;
    },
    confirm: async options => {
      questions.push(options.message);

      return consent;
    },
    log: { info: value => messages.push(value), warn: value => messages.push(value), error: value => messages.push(value) },
    spinner: () => ({ start: value => messages.push(value), stop: value => messages.push(value) }) };
}

function invoke(f, args, options = {}) {
  const launch = spawnCommand(process.execPath, [cli, ...args], f.env);

  return spawnSync(launch.file, launch.args, { ...launch.options, cwd: f.directory, env: f.env, encoding: 'utf8', timeout: 30000, ...options });
}

test('start parser rejects missing/unknown values before effects and supports one-word tasks', () => {
  for (const args of [['--in'], ['--in='], ['--in', '--dry-run'], ['--in', 'typo'], ['--in', 'codex', '--in=codex'], ['task words', '--typo']]) assert.throws(() => parseStart(args));
  assert.equal(parseStart(['onboarding', '--in=codex', '--dry-run']).task, 'onboarding');
  assert.equal(parseStart(['--', '--literal task']).task, '--literal task');
});

test('TTY dry-run never installs, launches, probes versions, copies clipboard, or writes state', async t => {
  const f = fixture(t, ['claude', 'codex', 'cursor', 'xclip']);

  for (const agent of ['claude-code', 'codex', 'cursor']) {
    assert.equal(await runStart(['Write welcome emails', '--in', agent, '--dry-run'], { cwd: f.directory, tty: true, ui: ui() }), 0);
  }

  assert.deepEqual(f.calls(), []);
  assert.deepEqual(readdirSync(f.directory), ['bin']);
});

test('real pseudo-terminal task dry-run stays read-only', t => {
  if (process.platform === 'win32' || !existsSync('/usr/bin/script')) {
    t.skip('PTY harness unavailable; injected TTY path covered separately');

    return;
  }

  const f = fixture(t);
  const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
  const command = [process.execPath, cli, 'Write welcome emails', '--in', 'codex', '--dry-run'].map(quote).join(' ');
  const result = spawnSync('/usr/bin/script', ['-q', '-e', '-c', command, '/dev/null'], { cwd: f.directory, env: f.env, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Dry run/);
  assert.deepEqual(f.calls(), []);
  assert.deepEqual(readdirSync(f.directory), ['bin']);
});

test('CLI one-word task and invalid start options have no side effects', t => {
  const f = fixture(t);
  assert.equal(invoke(f, ['task', 'onboarding', '--in', 'codex', '--dry-run']).status, 0);

  for (const args of [['--in'], ['Write a welcome email', '--in='], ['Write a welcome email', '--unknown']]) assert.equal(invoke(f, args).status, 2);
  assert.deepEqual(f.calls(), []);
  assert.deepEqual(readdirSync(f.directory), ['bin']);
});

test('brief rejects unsupported options before creating a knowledge cache or home', t => {
  const f = fixture(t);

  for (const option of ['--dry-run', '--typo']) {
    const result = invoke(f, ['brief', 'Write one welcome email', option]);

    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stderr, /Unknown option/);
    assert.equal(existsSync(f.env.CONQUISTADOR_CACHE), false);
    assert.equal(existsSync(f.env.CONQUISTADOR_HOME), false);
  }

  assert.deepEqual(f.calls(), []);
  assert.deepEqual(readdirSync(f.directory), ['bin']);
});

test('choose the target before installing; cancellation at either choice leaves hosts unchanged', async t => {
  const f = fixture(t);

  for (const options of [{ selected: cancel }, { consent: false }, { consent: cancel }]) {
    assert.equal(await runStart([], { cwd: f.directory, tty: true, ui: ui(options) }), 130);
    assert.deepEqual(f.calls(), []);
    assert.deepEqual(readdirSync(f.directory), ['bin']);
  }
});

test('one selected host installs, healthy repeat skips writes, host-side uninstall is repaired', async t => {
  const f = fixture(t), firstUi = ui();
  assert.equal(await runStart(['--no-open'], { cwd: f.directory, tty: true, ui: firstUi }), 0);
  assert.deepEqual(Object.keys(readState().agents), ['codex']);
  assert.ok(f.calls().every(call => call.host === 'codex'));
  assert.deepEqual(firstUi.questions, ['Open in', 'Install Conquistador into Codex?']);
  const before = readFileSync(join(pluginHome(), '.conquistador-owned.json'), 'utf8');
  assert.equal(await runStart(['--in=codex', '--no-open'], { cwd: f.directory, tty: true, ui: ui() }), 0);
  assert.equal(readFileSync(join(pluginHome(), '.conquistador-owned.json'), 'utf8'), before);
  rmSync(join(f.directory, 'codex.registered'));
  assert.equal(await runStart(['--in=codex', '--no-open', '--yes'], { cwd: f.directory, tty: true, ui: ui() }), 0);
  assert.ok(existsSync(join(f.directory, 'codex.registered')));
  assert.equal(existsSync(join(f.directory, 'claude.registered')), false);
});

test('invalid/ambiguous add and remove do not mutate; --all is explicit', async t => {
  const f = fixture(t);

  for (const args of [['--yes'], ['--typo'], ['codex', '--all', '--yes']]) assert.equal(await runAdd(args), 2);
  assert.equal(runRemove(['coedx']), 2);
  assert.equal(runRemove(['--unknown']), 2);
  assert.deepEqual(f.calls(), []);
  assert.equal(await runAdd(['--all', '--dry-run']), 0);
  assert.deepEqual(f.calls(), []);
  assert.deepEqual(readdirSync(f.directory), ['bin']);
  assert.equal(await runAdd(['--all', '--yes']), 0);
  assert.deepEqual(Object.keys(readState().agents).sort(), ['claude-code', 'codex']);
});

test('failed selected host prints executable retry; successful retry preserves unrelated hosts', async t => {
  const f = fixture(t), screen = ui(); process.env.TEST_FAIL_HOST = 'codex';
  assert.equal(await runStart(['--in', 'codex', '--no-open', '--yes'], { cwd: f.directory, tty: true, ui: screen }), 1);
  assert.match(screen.messages.join('\n'), /Retry: conquistador add codex --yes/);
  delete process.env.TEST_FAIL_HOST;
  assert.equal(await runAdd(['codex', '--yes']), 0);
  assert.deepEqual(Object.keys(readState().agents), ['codex']);
  assert.ok(f.calls().every(call => call.host === 'codex'));
});

test('update and remove previews execute nothing and lifecycle preserves user artifacts', async t => {
  const f = fixture(t);
  assert.equal(await runAdd(['codex', '--yes']), 0);

  for (const [file, content] of [['config.json', '{"playbooks":[]}'], ['playbooks/mine.md', 'synthetic user-owned note'], ['bot-export/SYSTEM-PROMPT.md', 'synthetic export']]) {
    const path = join(process.env.CONQUISTADOR_HOME, file); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content);
  }

  const before = JSON.stringify(f.calls());
  delete process.env.CONQUISTADOR_UPDATED_FROM;
  assert.equal(runUpdate(['--dry-run']), 0);
  assert.equal(runRemove(['--dry-run']), 0);
  assert.equal(JSON.stringify(f.calls()), before);
  process.env.CONQUISTADOR_UPDATED_FROM = 'synthetic-test';
  assert.equal(runUpdate([]), 0);
  assert.equal(runRemove(['codex']), 0);
  assert.ok(readState().removed.includes('codex'));
  assert.equal(runRemove([]), 0);
  assert.equal(existsSync(pluginHome()), false);

  for (const file of ['config.json', 'playbooks/mine.md', 'bot-export/SYSTEM-PROMPT.md']) assert.ok(existsSync(join(process.env.CONQUISTADOR_HOME, file)));
});

test('status reconciles host registration instead of treating a receipt as readiness', t => {
  fixture(t);
  writeState({ agents: { codex: { version: '0.2.2' } } });
  let output = ''; const old = console.log; console.log = value => { output += value; };

  try { assert.equal(runAgents(['--json']), 0); } finally { console.log = old; }

  const state = JSON.parse(output), codex = state.agents.find(item => item.id === 'codex');
  assert.equal(codex.recordedInstalled, true); assert.equal(codex.registered, false);
  assert.equal(codex.installed, false); assert.equal(codex.payloadHealthy, false);
  assert.equal(codex.activation, 'unverified'); assert.equal(codex.hookTrust, 'unverified');
});
