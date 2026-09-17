import { test } from 'node:test';
import assert from 'node:assert/strict';
import { win32, posix } from 'node:path';
import { containsPath, isRuntimeExecutable, isPackageCache, shellCommand } from './install-paths.mjs';
import { runSetupGuide } from './setup-guide.mjs';

test('containment distinguishes Windows drives and UNC shares from descendants', () => {
  for (const paths of [win32, posix]) {
    const base = paths === win32 ? 'C:\\source' : '/source';
    assert.equal(containsPath(base, paths.join(base, 'child'), paths), true);
    assert.equal(containsPath(base, base, paths), true);
    assert.equal(containsPath(base, `${base}-sibling`, paths), false);
    assert.equal(containsPath(base, paths.dirname(base), paths), false);
  }
  assert.equal(containsPath('C:\\source', 'D:\\project', win32), false);
  assert.equal(containsPath('\\\\server\\share-a\\source', '\\\\server\\share-b\\project', win32), false);
  assert.equal(containsPath('C:\\SOURCE', 'c:\\source\\child', win32), true);
});

test('MCP executable checks use native path components', () => {
  assert.equal(isRuntimeExecutable('C:\\Users\\Name\\runtime\\bin\\conquistador.js', win32), true);
  assert.equal(isRuntimeExecutable('/Users/Name/runtime/bin/conquistador.js', posix), true);
  for (const file of ['C:\\runtime\\other\\conquistador.js', 'C:\\not-runtime\\bin\\conquistador.js']) assert.equal(isRuntimeExecutable(file, win32), false);
  assert.equal(isPackageCache('C:\\Users\\Name\\npm-cache\\_npx\\hash\\node_modules\\package'), true);
  assert.equal(isPackageCache('/tmp/bunx-501-package'), true);
  assert.equal(isPackageCache('/home/user/.bun/install/cache/package'), true);
  assert.equal(isPackageCache('/home/user/apps/conquistador'), false);
});

test('generated PowerShell and POSIX commands preserve apostrophes and shell metacharacters', () => {
  const args = ['C:\\User Apps\\node.exe', "O'Brien $HOME; echo unsafe"];
  assert.equal(shellCommand(args, 'win32'), "& 'C:\\User Apps\\node.exe' 'O''Brien $HOME; echo unsafe'");
  assert.equal(shellCommand(['node', "O'Brien"], 'linux'), "'node' 'O'\\''Brien'");
  assert.throws(() => shellCommand(['node', 'bad\ncommand']), /control/);
});

function fakeUi(answers, notes = []) {
  return { intro() {}, outro() {}, cancel() {}, note(value) { notes.push(value); }, isCancel: value => typeof value === 'symbol',
    select: async () => answers.shift(), text: async () => answers.shift(), confirm: async () => answers.shift(),
    log: { info() {}, error(value) { notes.push(value); } }, spinner: () => ({ start() {}, stop() {} }) };
}
test('the guide confirms an operator and host then installs, verifies and explains the first task', async () => {
  const answers = ['operator', 'cursor', true], notes = [], calls = [];
  const result = await runSetupGuide({ cwd: '/example-project', version: '0.0.6', ui: fakeUi(answers, notes), run: async args => { calls.push(args); return ''; } });
  assert.equal(result, 0); assert.equal(answers.length, 0);
  assert.deepEqual(calls[0], ['install', '--target', 'operator', '--project', '/example-project', '--host', 'cursor']);
  assert.deepEqual(calls[1], ['doctor', '--path', '/example-project/.conquistador']);
  assert.match(notes.join('\n'), /fresh cursor session/); assert.match(notes.join('\n'), /conquistador start/);
});
test('cancelling the guide applies no changes', async () => {
  for (const answers of [[Symbol('cancel')], ['operator', 'codex', false]]) {
    const calls = []; const result = await runSetupGuide({ cwd: '/example-project', version: '0.0.6', ui: fakeUi(answers), run: async args => { calls.push(args); } });
    assert.equal(result, 0); assert.deepEqual(calls, []);
  }
});
test('the guide retains connectors, plugins, squads and standalone methods', async () => {
  for (const [answers, expected] of [
    [['plugin', 'copilot-plugin', '/owned/plugin', true], ['install', '--target', 'copilot-plugin', '--path', '/owned/plugin']],
    [['harness', 'squad', '/owned/squad', true], ['install', '--target', 'squad', '--path', '/owned/squad']],
    [['skill', 'specialist', 'write-copy', '/owned/copy', true], ['install', '--target', 'skill:write-copy', '--path', '/owned/copy']],
    [['runtime-mcp', 'https://runtime.example', '/stable', '/owned/mcp', true], ['install', '--target', 'mcp', '--url', 'https://runtime.example', '--runtime-path', '/stable', '--path', '/owned/mcp']],
  ]) {
    const calls = []; assert.equal(await runSetupGuide({ cwd: '/example-project', version: '0.0.6', ui: fakeUi(answers), run: async args => { calls.push(args); return ''; } }), 0);
    assert.deepEqual(calls[0], expected); assert.equal(answers.length, 0);
    if (expected[2].startsWith('skill:') || expected[2] === 'squad') assert.equal(calls.some(args => args[0] === 'doctor'), false);
  }
});
