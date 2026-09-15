import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HOST_EVENTS, applyMode, handleHostEvent, hostSupport, inspectMode } from './conquistador-mode.mjs';

const script = fileURLToPath(new URL('./conquistador-mode.mjs', import.meta.url));
function invoke(args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    timeout: 3000,
    input: '',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
}
function project(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mode project '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = join(dir, 'proactive.json');
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, enabled: true, events: ['session-start', 'before-delivery', 'results-updated'] }));
  return { dir, config, settings: join(dir, '.claude/settings.local.json') };
}

test('only Claude Code is offered; Grok Bot and Eve stay experimental', () => {
  assert.equal(hostSupport('claude-code').supported, true);
  assert.equal(hostSupport('grok-bot').supported, false);
  assert.equal(hostSupport('eve').supported, false);
  assert.match(hostSupport('cursor').explanation, /Claude Code/);
});

test('enable maps host events, preserves unrelated settings, and disable leaves registration', t => {
  const { dir, config, settings } = project(t);
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(settings, JSON.stringify({ permissions: { allow: ['Read'] }, hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'echo keep' }] }] } }));
  const enabled = applyMode('enable', { host: 'claude-code', project: dir, config });
  assert.equal(enabled.state, 'enabled');
  const stored = JSON.parse(readFileSync(settings, 'utf8'));
  assert.deepEqual(Object.keys(HOST_EVENTS).sort(), ['before-delivery', 'session-start']);
  assert.equal(stored.hooks.SessionStart[0].hooks[0].command.includes('--handle'), true);
  assert.equal(stored.hooks.SessionStart[0].hooks[0].command.startsWith(`'${process.execPath}' `), true);
  assert.equal(stored.hooks.SessionStart[0].hooks[0].command.includes(`'${script}'`), true);
  assert.equal(stored.hooks.Stop[0].hooks[0].command.includes('before-delivery'), true);
  assert.equal(stored.hooks.TaskCompleted, undefined);
  assert.deepEqual(stored.hooks.PreToolUse, [{ hooks: [{ type: 'command', command: 'echo keep' }] }]);
  assert.deepEqual(stored.permissions, { allow: ['Read'] });
  const disabled = applyMode('disable', { host: 'claude-code', project: dir, config });
  assert.equal(disabled.state, 'registered-disabled');
  assert.equal(JSON.parse(readFileSync(config, 'utf8')).enabled, false);
  const removed = applyMode('remove', { host: 'claude-code', project: dir, config });
  assert.equal(removed.state, 'disabled');
  const leftover = JSON.parse(readFileSync(settings, 'utf8'));
  assert.equal(leftover.hooks.SessionStart, undefined);
  assert.deepEqual(leftover.hooks.PreToolUse, [{ hooks: [{ type: 'command', command: 'echo keep' }] }]);
});

test('remove keeps another absolute script with the same basename', t => {
  const { dir, config, settings } = project(t);
  const other = join(dir, 'other-install', 'conquistador-mode.mjs');
  mkdirSync(join(dir, '.claude'), { recursive: true });
  mkdirSync(join(dir, 'other-install'));
  writeFileSync(other, '// different installation\n');
  const foreign = [process.execPath, other, '--handle', '--host', 'claude-code', '--event', 'before-delivery', '--config', config].join(' ');
  writeFileSync(settings, JSON.stringify({
    hooks: {
      Stop: [{ hooks: [
        { type: 'command', command: foreign },
        { type: 'command', command: "echo 'mention conquistador-mode.mjs --handle in prose'" },
      ] }],
    },
  }));
  applyMode('enable', { host: 'claude-code', project: dir, config, events: 'before-delivery' });
  applyMode('remove', { host: 'claude-code', project: dir, config });
  const leftover = JSON.parse(readFileSync(settings, 'utf8'));
  assert.deepEqual(leftover.hooks.Stop[0].hooks.map(item => item.command), [
    foreign,
    "echo 'mention conquistador-mode.mjs --handle in prose'",
  ]);
});

test('status and disable bind to the registered config and reject a mismatch', t => {
  const { dir, config, settings } = project(t);
  const other = join(dir, 'other.json');
  writeFileSync(other, JSON.stringify({ schemaVersion: 1, enabled: false, events: ['session-start'] }));
  applyMode('enable', { host: 'claude-code', project: dir, config });
  const command = JSON.parse(readFileSync(settings, 'utf8')).hooks.SessionStart[0].hooks[0].command;
  assert.equal(inspectMode({ host: 'claude-code', project: dir }).state, 'unknown');
  assert.equal(inspectMode({ host: 'claude-code', project: dir, config }).state, 'enabled');
  assert.throws(() => inspectMode({ host: 'claude-code', project: dir, config: other }), /does not match the registered host hooks/);
  assert.throws(() => applyMode('disable', { host: 'claude-code', project: dir, config: other }), /does not match the registered host hooks/);
  assert.equal(JSON.parse(readFileSync(config, 'utf8')).enabled, true);
  assert.equal(JSON.parse(readFileSync(other, 'utf8')).enabled, false);
  assert.equal(JSON.parse(readFileSync(settings, 'utf8')).hooks.SessionStart[0].hooks[0].command, command);
  const disabled = applyMode('disable', { host: 'claude-code', project: dir, config });
  assert.equal(disabled.state, 'registered-disabled');
  assert.equal(JSON.parse(readFileSync(config, 'utf8')).enabled, false);
});

test('enable switches from registered A to requested B', t => {
  const { dir, config, settings } = project(t);
  const next = join(dir, 'other.json');
  writeFileSync(next, JSON.stringify({ schemaVersion: 1, enabled: true, events: ['session-start'] }));
  applyMode('enable', { host: 'claude-code', project: dir, config });
  const switched = applyMode('enable', { host: 'claude-code', project: dir, config: next, events: 'session-start' });
  assert.equal(switched.state, 'enabled');
  assert.equal(switched.config, next);
  const command = JSON.parse(readFileSync(settings, 'utf8')).hooks.SessionStart[0].hooks[0].command;
  assert.equal(command.includes(next), true);
  assert.equal(inspectMode({ host: 'claude-code', project: dir, config: next }).state, 'enabled');
  assert.throws(() => inspectMode({ host: 'claude-code', project: dir, config }), /does not match the registered host hooks/);
});

test('quoted apostrophes in the config path stay owned across enable and remove', t => {
  const dir = mkdtempSync(join(tmpdir(), "mode's "));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = join(dir, "proactive's.json");
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, enabled: true, events: ['before-delivery'] }));
  const settings = join(dir, '.claude/settings.local.json');
  applyMode('enable', { host: 'claude-code', project: dir, config, events: 'before-delivery' });
  applyMode('enable', { host: 'claude-code', project: dir, config, events: 'before-delivery' });
  const stored = JSON.parse(readFileSync(settings, 'utf8'));
  assert.equal(stored.hooks.Stop.length, 1);
  assert.equal(stored.hooks.Stop[0].hooks.length, 1);
  assert.match(stored.hooks.Stop[0].hooks[0].command, /'\\''/);
  assert.equal(inspectMode({ host: 'claude-code', project: dir, config }).state, 'enabled');
  const removed = applyMode('remove', { host: 'claude-code', project: dir });
  assert.equal(removed.state, 'disabled');
  assert.equal(existsSync(settings), false);
});

test('handle ignores recursive stop hooks and returns additionalContext for Claude events', t => {
  const { config } = project(t);
  assert.deepEqual(handleHostEvent({ host: 'claude-code', event: 'before-delivery', config, input: { hook_event_name: 'Stop', stop_hook_active: true } }), {});
  const live = handleHostEvent({ host: 'claude-code', event: 'session-start', config, input: { hook_event_name: 'SessionStart' } });
  assert.equal(live.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(live.hookSpecificOutput.additionalContext, /\/conquistador/);
  const stop = handleHostEvent({ host: 'claude-code', event: 'before-delivery', config, input: { hook_event_name: 'Stop', stop_hook_active: false } });
  assert.equal(stop.hookSpecificOutput.hookEventName, 'Stop');
  assert.match(stop.hookSpecificOutput.additionalContext, /review the current deliverable/);
});

test('CLI status and handle emit JSON; unsupported hosts fail closed', t => {
  const { dir, config } = project(t);
  const status = invoke(['status', '--host', 'claude-code', '--project', dir]);
  assert.equal(status.status, 0);
  assert.equal(JSON.parse(status.stdout).state, 'disabled');
  const blocked = invoke(['enable', '--host', 'grok-bot', '--project', dir, '--config', config]);
  assert.equal(blocked.status, 2);
  assert.equal(blocked.stdout, '');
  assert.match(blocked.stderr, /Invalid Conquistador mode input/);
  const handled = invoke(['--handle', '--host', 'claude-code', '--event', 'session-start', '--config', config], { input: '{"hook_event_name":"SessionStart"}' });
  assert.equal(handled.status, 0);
  assert.equal(JSON.parse(handled.stdout).hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(inspectMode({ host: 'cursor', project: dir }).state, 'unsupported');
});

test('results-updated cannot register advisory hooks and owned legacy hooks can be removed', t => {
  const { dir, config, settings } = project(t);
  assert.throws(() => applyMode('enable', { host: 'claude-code', project: dir, config, events: 'results-updated' }), /no Claude context-advice adapter/);
  assert.equal(existsSync(settings), false);
  applyMode('enable', { host: 'claude-code', project: dir, config });
  const stored = JSON.parse(readFileSync(settings, 'utf8'));
  const legacy = structuredClone(stored.hooks.SessionStart[0]);
  legacy.hooks[0].command = legacy.hooks[0].command.replace('--event session-start', '--event results-updated');
  stored.hooks.TaskCompleted = [legacy, { hooks: [{ type: 'command', command: 'echo keep' }] }];
  writeFileSync(settings, JSON.stringify(stored));
  applyMode('enable', { host: 'claude-code', project: dir, config });
  assert.deepEqual(JSON.parse(readFileSync(settings, 'utf8')).hooks.TaskCompleted, [{ hooks: [{ type: 'command', command: 'echo keep' }] }]);
  const removedEvent = invoke(['--handle', '--host', 'claude-code', '--event', 'results-updated', '--config', config]);
  assert.equal(removedEvent.status, 1);
  assert.equal(removedEvent.stdout, '');
});

test('invalid, missing, oversized and recursive event payloads never inject advice', t => {
  const { config } = project(t);
  const args = ['--handle', '--host', 'claude-code', '--event', 'before-delivery', '--config', config];
  for (const input of ['', '{', 'null', '[]', '{}', '{"hook_event_name":"SessionStart"}',
    '{"hook_event_name":"Stop"}', '{"hook_event_name":"Stop","stop_hook_active":"false"}',
    '{"hook_event_name":"Stop","stop_hook_active":true}',
    JSON.stringify({ hook_event_name: 'Stop', last_assistant_message: 'x'.repeat(9000), stop_hook_active: true })]) {
    const result = invoke(args, { input });
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), {});
    assert.equal(result.stderr, '');
  }
  const disabled = handleHostEvent({ host: 'claude-code', event: 'session-start', input: { hook_event_name: 'SessionStart' } });
  assert.deepEqual(disabled, {});
});

test('hook failures do not block Claude or expose operator configuration', t => {
  const { config } = project(t);
  const marker = 'synthetic-private-mode-value';
  writeFileSync(config, marker);
  const result = invoke(['--handle', '--host', 'claude-code', '--event', 'session-start', '--config', config], { input: '{"hook_event_name":"SessionStart"}' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.includes(marker), false);
  assert.equal(result.stderr.includes(config), false);
});

test('status requires an enabled event that is actually registered', t => {
  const { dir, config } = project(t);
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, enabled: true, events: ['results-updated'] }));
  assert.equal(applyMode('enable', { host: 'claude-code', project: dir, config }).state, 'registered-disabled');
});
