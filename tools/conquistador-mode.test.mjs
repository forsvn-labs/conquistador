import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  assert.deepEqual(Object.keys(HOST_EVENTS).sort(), ['before-delivery', 'results-updated', 'session-start']);
  assert.equal(stored.hooks.SessionStart[0].hooks[0].command.includes('--handle'), true);
  assert.equal(stored.hooks.SessionStart[0].hooks[0].command.startsWith(`'${process.execPath}' `), true);
  assert.equal(stored.hooks.SessionStart[0].hooks[0].command.includes(`'${script}'`), true);
  assert.equal(stored.hooks.Stop[0].hooks[0].command.includes('before-delivery'), true);
  assert.equal(stored.hooks.TaskCompleted[0].hooks[0].command.includes('results-updated'), true);
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

test('handle ignores recursive stop hooks and returns additionalContext for Claude events', t => {
  const { config } = project(t);
  assert.deepEqual(handleHostEvent({ host: 'claude-code', event: 'before-delivery', config, input: { stop_hook_active: true } }).hookSpecificOutput.additionalContext, '');
  const live = handleHostEvent({ host: 'claude-code', event: 'session-start', config, input: {} });
  assert.equal(live.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(live.hookSpecificOutput.additionalContext, /\/conquistador/);
});

test('CLI status and handle emit JSON; unsupported hosts fail closed', t => {
  const { dir, config } = project(t);
  const status = invoke(['status', '--host', 'claude-code', '--project', dir]);
  assert.equal(status.status, 0);
  assert.equal(JSON.parse(status.stdout).state, 'disabled');
  const blocked = invoke(['enable', '--host', 'grok-bot', '--project', dir, '--config', config]);
  assert.equal(blocked.status, 2);
  assert.equal(blocked.stdout, '');
  assert.match(blocked.stderr, /Experimental import only/);
  const handled = invoke(['--handle', '--host', 'claude-code', '--event', 'results-updated', '--config', config], { input: '{}' });
  assert.equal(handled.status, 0);
  assert.equal(JSON.parse(handled.stdout).hookSpecificOutput.hookEventName, 'TaskCompleted');
  assert.equal(inspectMode({ host: 'cursor', project: dir }).state, 'unsupported');
});
