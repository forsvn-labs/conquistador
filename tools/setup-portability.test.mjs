import { test } from 'node:test';
import assert from 'node:assert/strict';
import { win32, posix } from 'node:path';
import { containsPath, isRuntimeExecutable, isPackageCache, shellCommand } from './install-paths.mjs';
import { collectSetupArgs } from './setup-guide.mjs';

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

test('guided default asks one route question and uses the current project', async () => {
  const questions = [], output = [];
  const cwd = process.cwd();
  const args = await collectSetupArgs(async text => { questions.push(text); return ''; }, text => output.push(text), cwd);
  assert.deepEqual(args, ['install', '--target', 'operator', '--project', cwd]);
  assert.equal(questions.length, 1);
  assert.match(output.join('\n'), /manual activation/);
  assert.match(output.join('\n'), /Experimental/);
});

test('guided forms select host and scope without applying changes', async () => {
  for (const [answers, target, tail] of [
    [['2', 'copilot-plugin', ''], 'copilot-plugin', '.conquistador-plugin'],
    [['3', 'cursor', ''], 'cursor', '.cursor/skills/conquistador'],
    [['4', 'squad', ''], 'squad', '.conquistador-squad'],
    [['5', ''], 'mcp', '.conquistador-mcp'],
    [['6', 'https://runtime.example', '', ''], 'mcp', '.conquistador-runtime-mcp'],
    [['7', 'eve', ''], 'eve', '.conquistador-import'],
  ]) {
    const args = await collectSetupArgs(async () => answers.shift(), () => {});
    assert.equal(args[2], target);
    assert.ok(args.at(-1).replaceAll('\\', '/').endsWith(tail));
    assert.equal(answers.length, 0);
  }
  const answers = ['6', ''];
  await assert.rejects(collectSetupArgs(async () => answers.shift(), () => {}), /existing service/);
});
