import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { advisory, validateConfig, MAX_CONFIG_BYTES } from './proactive.mjs';

const events = ['session-start', 'before-delivery', 'results-updated'];
const config = { schemaVersion: 1, enabled: true, events };
const script = fileURLToPath(new URL('./proactive.mjs', import.meta.url));
function invoke(args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 3000, ...options });
}
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'proactive test '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'config.json');
  writeFileSync(path, JSON.stringify(config));
  return { dir, path };
}

test('default is disabled; only explicit selected events enable static bounded advice', () => {
  for (const event of events) {
    assert.deepEqual(advisory(event), { schemaVersion: 1, event, enabled: false, instructions: [] });
    assert.equal(advisory(event, { ...config, enabled: false }).enabled, false);
    assert.equal(advisory(event, { ...config, events: [] }).enabled, false);
    const result = advisory(event, { ...config, events: [event] });
    assert.equal(result.enabled, true);
    assert.equal(result.instructions.length, 2);
    assert.match(result.instructions[0], /\/conquistador/);
    assert.match(result.instructions[1], /advisory only/);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) < 1024);
    assert.deepEqual(result, advisory(event, config));
    for (const other of events.filter(value => value !== event)) {
      assert.equal(advisory(other, { ...config, events: [event] }).enabled, false);
    }
  }
});

test('strict config version, fields, types, event allowlist, and duplicates', () => {
  for (const bad of [null, [], {}, true, { ...config, schemaVersion: 2 },
    { ...config, enabled: 'true' }, { ...config, events: 'session-start' },
    { ...config, events: ['session-start', 'session-start'] },
    { ...config, events: ['unknown'] }, { ...config, events: [null] },
    { ...config, command: 'echo untrusted' }, { ...config, enabled: undefined },
    JSON.parse('{"schemaVersion":1,"enabled":true,"events":[],"__proto__":{}}')]) {
    assert.throws(() => validateConfig(bad));
  }
  for (const event of ['__proto__', 'constructor', '', null, 'session-start; echo injected']) {
    assert.throws(() => advisory(event, config));
  }
});

test('CLI ignores stdin and ambient files; does not write config or artifacts', t => {
  const { dir, path } = fixture(t);
  const before = readFileSync(path);
  const disabled = invoke(['--event', 'session-start'], { cwd: dir, input: 'not an event payload' });
  assert.equal(disabled.status, 0);
  assert.equal(JSON.parse(disabled.stdout).enabled, false);
  const active = invoke(['--event', 'session-start', '--config', path], { cwd: dir });
  assert.equal(active.status, 0);
  assert.equal(active.stderr, '');
  assert.deepEqual(JSON.parse(active.stdout), advisory('session-start', config));
  assert.deepEqual(readFileSync(path), before);
  assert.deepEqual(readdirSync(dir), ['config.json']);
});

test('CLI fails closed without echoing input or emitting advice', t => {
  const { path } = fixture(t);
  for (const args of [[], ['--event', 'constructor'], ['--event', 'session-start', '--payload', 'secret'],
    ['--event', 'session-start', '--config', path, '--config', path],
    ['--config', path, '--event', 'session-start'], ['--event', 'session-start', '--config', `${path}.missing`]]) {
    const result = invoke(args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Invalid proactive input. See docs/PROACTIVE.md.\n');
  }
});

test('config reads reject oversized, malformed, non-UTF8, symlink and special files', t => {
  const { dir, path } = fixture(t);
  const run = candidate => invoke(['--event', 'session-start', '--config', candidate]);
  const valid = JSON.stringify(config);
  writeFileSync(path, valid.padEnd(MAX_CONFIG_BYTES, ' '));
  assert.equal(run(path).status, 0);
  for (const bytes of [valid.padEnd(MAX_CONFIG_BYTES + 1, ' '), '{secret', Buffer.from([0xff]), '{}']) {
    writeFileSync(path, bytes);
    const result = run(path);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.ok(!result.stderr.includes('secret'));
  }
  assert.equal(run(dir).status, 2);
  writeFileSync(path, valid);
  const alias = join(dir, 'alias');
  symlinkSync(path, alias);
  assert.equal(run(alias).status, 2);
  if (process.platform !== 'win32') {
    assert.equal(run('/dev/null').status, 2);
    const fifo = join(dir, 'fifo');
    assert.equal(spawnSync('mkfifo', [fifo]).status, 0);
    assert.equal(run(fifo).status, 2);
  }
});
