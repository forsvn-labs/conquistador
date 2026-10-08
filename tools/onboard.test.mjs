// Unit checks for onboarding v2 parts that do not need a terminal. The terminal flow is covered
// end to end by tools/e2e/installer.mjs. Windows cases run on every platform (F19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appConfigPath, mergeEntry, removeEntry, serverEntry } from './mcp-apps.mjs';
import { pathCopies, shadowCheck, updateNotice } from './preflight.mjs';
import { parseOnboard, planJson } from './onboard.mjs';
import { executorBinary, executorOutcome, slugFor } from './executor-source.mjs';

const server = { command: '/usr/local/bin/node', args: ['/home/hung/.conquistador/plugin/mcp/server.mjs'] };

test('MCP app config paths follow each platform (Windows uses %APPDATA% and the profile folder)', () => {
  const win = { platform: 'win32', home: 'C:\\Users\\hung', env: { APPDATA: 'C:\\Users\\hung\\AppData\\Roaming' } };
  assert.equal(appConfigPath('claude-desktop', win), 'C:\\Users\\hung\\AppData\\Roaming\\Claude\\claude_desktop_config.json');
  assert.equal(appConfigPath('vscode', win), 'C:\\Users\\hung\\AppData\\Roaming\\Code\\User\\mcp.json');
  assert.equal(appConfigPath('windsurf', win), 'C:\\Users\\hung\\.codeium\\windsurf\\mcp_config.json');
  assert.equal(appConfigPath('zed', win), 'C:\\Users\\hung\\AppData\\Roaming\\Zed\\settings.json');
  assert.equal(appConfigPath('cursor', win), 'C:\\Users\\hung\\.cursor\\mcp.json');
  // A missing APPDATA falls back to the documented default under the profile.
  assert.equal(appConfigPath('claude-desktop', { ...win, env: {} }), 'C:\\Users\\hung\\AppData\\Roaming\\Claude\\claude_desktop_config.json');

  const mac = { platform: 'darwin', home: '/Users/hung', env: {} };
  assert.equal(appConfigPath('claude-desktop', mac), '/Users/hung/Library/Application Support/Claude/claude_desktop_config.json');
  assert.equal(appConfigPath('vscode', mac), '/Users/hung/Library/Application Support/Code/User/mcp.json');
  assert.equal(appConfigPath('zed', mac), '/Users/hung/.config/zed/settings.json');

  const linux = { platform: 'linux', home: '/home/hung', env: { XDG_CONFIG_HOME: '/home/hung/.xdg' } };
  assert.equal(appConfigPath('claude-desktop', linux), '/home/hung/.xdg/Claude/claude_desktop_config.json');
  assert.equal(appConfigPath('vscode', linux), '/home/hung/.xdg/Code/User/mcp.json');
  assert.equal(appConfigPath('zed', linux), '/home/hung/.xdg/zed/settings.json');
});

test('each MCP app gets its own entry shape', () => {
  assert.deepEqual(serverEntry('claude-desktop', server), { command: server.command, args: server.args });
  assert.deepEqual(serverEntry('vscode', server), { type: 'stdio', command: server.command, args: server.args });
  assert.deepEqual(serverEntry('zed', server), { source: 'custom', command: server.command, args: server.args, env: {} });
});

test('merging keeps other servers, is idempotent, and refuses files that are not plain JSON (F20, F21)', () => {
  const before = JSON.stringify({ theme: 'dark', mcpServers: { other: { command: 'other' } } }, null, 2);
  const added = mergeEntry(before, 'claude-desktop', server);
  assert.equal(added.status, 'added');
  const parsed = JSON.parse(added.text);
  assert.deepEqual(parsed.mcpServers.other, { command: 'other' });
  assert.equal(parsed.theme, 'dark');
  assert.deepEqual(parsed.mcpServers.conquistador, { command: server.command, args: server.args });
  assert.equal(mergeEntry(added.text, 'claude-desktop', server).status, 'unchanged');
  assert.equal(mergeEntry(added.text, 'claude-desktop', { ...server, command: '/opt/node' }).status, 'updated');
  assert.equal(mergeEntry('', 'vscode', server).status, 'added');
  assert.ok(JSON.parse(mergeEntry('', 'vscode', server).text).servers.conquistador);
  assert.throws(() => mergeEntry('{\n  // my settings\n  "theme": "dark"\n}', 'zed', server), /not plain JSON/);
  assert.throws(() => mergeEntry('[1, 2]', 'cursor', server), /not plain JSON/);
  const removed = removeEntry(added.text, 'claude-desktop');
  assert.equal(removed.status, 'removed');
  assert.deepEqual(JSON.parse(removed.text).mcpServers, { other: { command: 'other' } });
  assert.equal(removeEntry(removed.text, 'claude-desktop').status, 'absent');
});

test('the PATH scan finds every conquistador in order, including Windows .cmd shims (F15, F19)', () => {
  const files = new Set(['C:\\npm\\conquistador.cmd', 'C:\\old\\conquistador.cmd', 'C:\\old\\conquistador']);
  const copies = pathCopies({ PATH: 'C:\\npm;C:\\empty;C:\\old', platform: 'win32', isFile: path => files.has(path), resolve: path => path });
  assert.deepEqual(copies.map(item => item.path), ['C:\\npm\\conquistador.cmd', 'C:\\old\\conquistador.cmd']);

  const unix = new Set(['/home/hung/.local/bin/conquistador', '/usr/local/bin/conquistador']);
  const found = pathCopies({ PATH: '/home/hung/.local/bin:/usr/local/bin', platform: 'linux', isFile: path => unix.has(path), resolve: path => path });
  assert.deepEqual(found.map(item => item.path), ['/home/hung/.local/bin/conquistador', '/usr/local/bin/conquistador']);
});

test('the shadow check names both copies, both versions, and the exact fix (F15)', () => {
  const self = { root: '/home/hung/node_modules/@forsvn/conquistador', version: '0.3.0' };
  const stale = [{ path: '/home/hung/.local/bin/conquistador', root: '/home/hung/.local/lib/node_modules/@forsvn/conquistador', version: '0.0.14' }];
  const problem = shadowCheck(stale, self);
  assert.ok(problem);
  assert.match(problem.message, /0\.0\.14/);
  assert.match(problem.message, /0\.3\.0/);
  assert.match(problem.fix.join('\n'), /npm i -g @forsvn\/conquistador@latest/);
  assert.match(problem.fix.join('\n'), /npm uninstall -g --prefix ~\/\.local @forsvn\/conquistador|\/home\/hung\/\.local/);
  // The first copy on PATH is this one: no problem.
  assert.equal(shadowCheck([{ path: '/x/conquistador', root: self.root, version: '0.3.0' }], self), null);
  // Not on PATH at all (npx): no problem.
  assert.equal(shadowCheck([], self), null);
  // This copy is first, but a later copy has another version: say so.
  const later = shadowCheck([{ path: '/a/conquistador', root: self.root, version: '0.3.0' }, { path: '/b/conquistador', root: '/b/lib', version: '0.0.14' }], self);
  assert.match(later.message, /0\.0\.14/);
});

test('the update notice compares versions and names the right command', () => {
  assert.equal(updateNotice('0.3.0', '0.3.0', 'global'), null);
  assert.equal(updateNotice('0.2.9', '0.3.0', 'global'), null);
  assert.match(updateNotice('0.4.0', '0.3.0', 'global'), /npm i -g @forsvn\/conquistador@latest/);
  assert.match(updateNotice('0.4.0', '0.3.0', 'npx'), /npx @forsvn\/conquistador@latest/);
});

test('flags: --surface, --apps, --json, and old aliases (F18)', () => {
  assert.deepEqual(parseOnboard(['--surface=agents,bot']).surfaces, ['agents', 'bot']);
  assert.deepEqual(parseOnboard(['--surface', 'mcp-apps']).surfaces, ['mcp-apps']);
  assert.deepEqual(parseOnboard(['--apps=claude-desktop,vscode']).apps, ['claude-desktop', 'vscode']);
  assert.equal(parseOnboard(['--json']).json, true);
  assert.equal(parseOnboard(['--plain']).plain, true);
  assert.equal(parseOnboard(['--executor-name', 'growth']).executorName, 'growth');
  assert.throws(() => parseOnboard(['--surface=everything']), /Unknown surface/);
  assert.throws(() => parseOnboard(['--apps=notepad']), /Unknown app/);
  const mcp = parseOnboard(['--mcp']);
  assert.deepEqual(mcp.surfaces, ['mcp-apps']);
  assert.match(mcp.notice, /--surface=mcp-apps/);
  assert.deepEqual(parseOnboard(['--plugin']).surfaces, ['agents']);
  assert.equal(parseOnboard(['--plugin']).scope, 'global');
  assert.equal(parseOnboard(['--skills']).scope, 'project');
  assert.deepEqual(parseOnboard(['--bot']).surfaces, ['bot']);
  assert.equal(parseOnboard(['--advanced']).surfaces, null);
  assert.equal(parseOnboard(['--advanced']).installer, true);
});

test('the JSON plan is stable: sorted keys, no timestamps, home shown as ~ (F12)', () => {
  const plan = { version: '0.3.0', surfaces: [{ id: 'bot', steps: [{ action: 'write', target: '/home/hung/p/conquistador-bot' }] }], unchanged: ['x'], undo: 'conquistador remove' };
  const first = planJson(plan, { home: '/home/hung' });
  assert.equal(first, planJson(structuredClone(plan), { home: '/home/hung' }));
  const parsed = JSON.parse(first);
  assert.equal(parsed.schema, 'conquistador.onboarding-plan/v1');
  assert.equal(parsed.surfaces[0].steps[0].target, '~/p/conquistador-bot');
  assert.deepEqual(Object.keys(parsed), [...Object.keys(parsed)].sort());
  assert.doesNotMatch(first, /\d{4}-\d\d-\d\dT/);
});

test('Executor answers map to outcomes; names become safe slugs (F22)', () => {
  assert.equal(slugFor('Conquistador Growth!'), 'conquistador-growth');
  assert.equal(slugFor('  '), 'conquistador');
  assert.deepEqual(executorOutcome('{"ok": true, "data": {"slug": "conquistador"}}'), { ok: true, data: { slug: 'conquistador' } });
  assert.deepEqual(executorOutcome('Execution paused: Add an MCP server\n\nexecutionId: exec_12-ab\n'), { paused: 'exec_12-ab' });
  assert.equal(executorOutcome('{"ok": false, "error": {"code": "tool_not_found"}}').error.code, 'tool_not_found');
  assert.equal(executorOutcome('garbage').error.code, 'unreadable');
});

test('Executor is found as a CLI on PATH or as the macOS app with its bundled CLI', () => {
  const app = '/Applications/Executor.app/Contents/Resources/executor/executor';
  const userApp = '/Users/hung/Applications/Executor.app/Contents/Resources/executor/executor';
  assert.equal(executorBinary({ onPath: () => '/opt/homebrew/bin/executor', platform: 'darwin', home: '/Users/hung', exists: () => true }), '/opt/homebrew/bin/executor');
  assert.equal(executorBinary({ onPath: () => null, platform: 'darwin', home: '/Users/hung', exists: path => path === app }), app);
  assert.equal(executorBinary({ onPath: () => null, platform: 'darwin', home: '/Users/hung', exists: path => path === userApp }), userApp);
  assert.equal(executorBinary({ onPath: () => null, platform: 'linux', home: '/home/hung', exists: () => true }), null);
  assert.equal(executorBinary({ onPath: () => null, platform: 'darwin', home: '/Users/hung', exists: () => false }), null);
  assert.equal(executorBinary({ onPath: () => null, platform: 'darwin', home: '/Users/hung', exists: () => true, env: { CONQUISTADOR_EXECUTOR_APP: 'off' } }), null);
});
