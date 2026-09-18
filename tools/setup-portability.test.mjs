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
  return { intro() {}, outro(value) { notes.push(value); }, cancel() {}, note(value) { notes.push(value); }, isCancel: value => typeof value === 'symbol',
    multiselect: async () => answers.shift(), select: async () => answers.shift(), text: async () => answers.shift(), confirm: async () => answers.shift(),
    log: { info() {}, error(value) { notes.push(value); } }, spinner: () => ({ start() {}, stop() {} }) };
}
test('the guide selects compatible routes and hosts then verifies and explains each next step', async () => {
  const answers = [['operator', 'skill', 'harness', 'mcp'], ['codex', 'bb', 'cursor'], 'harness', '/owned/mcp', true], notes = [], calls = [];
  const result = await runSetupGuide({ cwd: '/example-project', version: '0.0.9', ui: fakeUi(answers, notes), run: async args => { calls.push(args); return 'Connector next steps'; } });
  assert.equal(result, 0); assert.equal(answers.length, 0);
  assert.deepEqual(calls[0], ['install', '--target', 'operator', '--project', '/example-project', '--hosts', 'codex,bb,cursor', '--dry-run']);
  assert.deepEqual(calls[1], ['install', '--target', 'mcp', '--path', '/owned/mcp', '--dry-run']);
  assert.deepEqual(calls[2], calls[0].slice(0, -1));
  assert.ok(calls.some(args => args[0] === 'doctor' && args[2] === '/example-project/.conquistador'));
  assert.equal(calls.some(args => args.includes('harness')), false);
  assert.match(notes.join('\n'), /BB owns the provider/); assert.match(notes.join('\n'), /Codex: start a fresh/);
  assert.match(notes.join('\n'), /No second operator copy/); assert.match(notes.join('\n'), /Connector next steps/);
});
test('cancelling the guide performs only read-only preflight, never mutations', async () => {
  for (const answers of [[Symbol('cancel')], [['operator', 'skill'], ['codex'], false]]) {
    const calls = []; const result = await runSetupGuide({ cwd: '/example-project', version: '0.0.9', ui: fakeUi(answers), run: async args => { calls.push(args); } });
    assert.equal(result, 0); assert.ok(calls.every(args => args.includes('--dry-run')));
  }
});
test('the guide retains connectors, shared plugin sources, squads, specialist skills and experimental guidance', async () => {
  for (const [answers, expected] of [
    [[['plugin'], ['copilot-plugin', 'claude-plugin'], '/owned/plugin', true], ['install', '--target', 'copilot-plugin', '--path', '/owned/plugin']],
    [[['harness'], 'squad', '/owned/squad', true], ['install', '--target', 'squad', '--path', '/owned/squad']],
    [[['specialist'], 'write-copy', '/owned/copy', true], ['install', '--target', 'skill:write-copy', '--path', '/owned/copy']],
    [[['runtime-mcp'], 'https://runtime.example', '/stable', '/owned/mcp', true], ['install', '--target', 'mcp', '--path', '/owned/mcp', '--url', 'https://runtime.example', '--runtime-path', '/stable']],
  ]) {
    const calls = []; assert.equal(await runSetupGuide({ cwd: '/example-project', version: '0.0.9', ui: fakeUi(answers), run: async args => { calls.push(args); return ''; } }), 0);
    assert.deepEqual(calls[0], [...expected, '--dry-run']); assert.deepEqual(calls[1], expected); assert.equal(answers.length, 0);
    if (expected[2].startsWith('skill:') || expected[2] === 'squad') assert.equal(calls.some(args => args[0] === 'doctor'), false);
    if (expected[2] === 'copilot-plugin') assert.equal(calls.filter(args => args[0] === 'install' && !args.includes('--dry-run')).length, 1);
  }
  const calls = [], notes = [];
  assert.equal(await runSetupGuide({ cwd: '/example-project', version: '0.0.9', ui: fakeUi([['experimental'], ['eve', 'grok-bot']], notes), run: async args => { calls.push(args); return 'Guidance'; } }), 0);
  assert.equal(calls.length, 2); assert.match(notes.join('\n'), /Guidance only. No files installed/);
});
test('the guide rejects overlapping folders and duplicate native discovery before preflight or mutation', async () => {
  for (const answers of [
    [['operator', 'mcp'], ['bb'], '/example-project/.conquistador/connector'],
    [['operator', 'skill', 'plugin'], ['codex'], ['codex-plugin'], '/owned/plugin'],
  ]) {
    const calls = []; assert.equal(await runSetupGuide({ cwd: '/example-project', version: '0.0.9', ui: fakeUi(answers), run: async args => { calls.push(args); } }), 1);
    assert.deepEqual(calls, []);
  }
});
test('later failure reports completed owned copies and does not claim global rollback', async () => {
  const notes = [], calls = [];
  const result = await runSetupGuide({ cwd: '/example-project', version: '0.0.9', ui: fakeUi([['operator', 'mcp'], ['bb'], '/owned/mcp', true], notes), run: async args => {
    calls.push(args); if (args[0] === 'install' && args[2] === 'mcp' && !args.includes('--dry-run')) throw Error('Injected connector failure'); return '';
  } });
  assert.equal(result, 1); assert.match(notes.join('\n'), /partial installation/); assert.match(notes.join('\n'), /Completed copies remain owned/);
  assert.match(notes.join('\n'), /example-project\/\.conquistador/); assert.equal(calls.some(args => args[0] === 'uninstall'), false);
});

test('a real mixed guide plan preflights before confirmation and keeps independent removal owners', async t => {
  const { mkdtempSync, realpathSync, existsSync, readdirSync, rmSync, writeFileSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { execFileSync } = await import('node:child_process');
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador guide combinations ')));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  const root = fileURLToPath(new URL('../', import.meta.url)), setup = join(root, 'tools/setup.mjs');
  const plugin = join(project, '.conquistador-plugin'), mcp = join(project, '.conquistador-mcp'), runtime = join(project, '.conquistador-runtime-mcp');
  writeFileSync(join(project, 'sentinel.txt'), 'Keep user project');
  const answers = [['operator', 'skill', 'plugin', 'harness', 'mcp', 'runtime-mcp'], ['codex', 'bb', 'cursor'], ['claude-plugin', 'copilot-plugin'], plugin, 'harness', mcp, 'https://runtime.example', root, runtime, true];
  const notes = [], ui = fakeUi(answers, notes);
  ui.confirm = async () => { assert.deepEqual(readdirSync(project), ['sentinel.txt']); return answers.shift(); };
  const run = async args => execFileSync(process.execPath, [setup, ...args], { cwd: project, encoding: 'utf8' });
  assert.equal(await runSetupGuide({ cwd: project, version: 'test', run, ui }), 0, notes.join('\n'));
  assert.equal(answers.length, 0);
  for (const path of ['.conquistador/SKILL.md', '.agents/skills/conquistador/SKILL.md', '.cursor/skills/conquistador/SKILL.md', '.conquistador-plugin/.claude-plugin/plugin.json', '.conquistador-mcp/connector.json', '.conquistador-runtime-mcp/connector.json']) assert.ok(existsSync(join(project, path)), path);
  assert.equal(existsSync(join(project, '.conquistador-agent')), false);
  assert.match(notes.join('\n'), /'claude' 'plugin' 'marketplace' 'add'/);
  assert.match(notes.join('\n'), /'copilot' 'plugin' 'install'/);
  assert.match(notes.join('\n'), /Plugin managers share one staged source/);
  assert.match(notes.join('\n'), /client settings/);
  await run(['uninstall', '--target', 'operator', '--project', project]);
  assert.ok(existsSync(plugin)); assert.ok(existsSync(mcp)); assert.ok(existsSync(runtime));
  for (const path of [plugin, mcp, runtime]) await run(['uninstall', '--path', path]);
  assert.deepEqual(readdirSync(project), ['sentinel.txt']);
  assert.equal(readFileSync(join(project, 'sentinel.txt'), 'utf8'), 'Keep user project');
});

test('unknown methods and a local choice over a runtime connector fail before other copies install', async t => {
  const { mkdtempSync, realpathSync, existsSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { execFileSync } = await import('node:child_process');
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador preflight ')));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  const root = fileURLToPath(new URL('../', import.meta.url)), setup = join(root, 'tools/setup.mjs');
  const connector = join(project, 'runtime');
  const run = async args => execFileSync(process.execPath, [setup, ...args], { cwd: project, encoding: 'utf8', stdio: 'pipe' });
  await run(['install', '--target', 'mcp', '--path', connector, '--url', 'https://runtime.example']);
  const notes = [];
  assert.equal(await runSetupGuide({ cwd: project, version: 'test', run, ui: fakeUi([['operator', 'mcp'], ['bb'], connector], notes) }), 1);
  assert.equal(existsSync(join(project, '.conquistador')), false); assert.ok(existsSync(connector));
  assert.match(notes.join('\n'), /owns a runtime MCP/);
  assert.equal(await runSetupGuide({ cwd: project, version: 'test', run, ui: fakeUi([['operator', 'specialist'], ['bb'], 'missing-method', join(project, 'specialist')], notes) }), 1);
  assert.equal(existsSync(join(project, '.conquistador')), false); assert.equal(existsSync(join(project, 'specialist')), false);
  await run(['uninstall', '--path', connector]);
});
