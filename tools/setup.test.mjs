import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'tools/setup.mjs');
function setup(...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, PATH: '/nonexistent' } });
  return { code: result.status, text: result.stdout + result.stderr };
}
function good(...args) { const result = setup(...args); assert.equal(result.code, 0, result.text); return result.text; }
function bad(...args) { const result = setup(...args); assert.notEqual(result.code, 0, result.text); return result.text; }
async function temporary(run) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador setup spaces ')));
  try { await run(join(parent, 'owned folder'), parent); } finally { rmSync(parent, { recursive: true, force: true }); }
}

test('compact lifecycle uses receipt mode without target and reports local truth', () => temporary(path => {
  assert.match(good('status', '--path', path), /absent/);
  assert.match(good('install', '--target', 'skill', '--path', path), /Prepared locally\. Host activation unverified/);
  assert.ok(existsSync(join(path, 'SKILL.md')));
  assert.match(good('status', '--path', path), /unchanged/);
  assert.match(good('update', '--path', path), /unchanged/);
  assert.match(good('uninstall', '--path', path), /absent/);
  assert.equal(existsSync(path), false);
}));

test('host project mappings install complete compact bundles', () => temporary((path, parent) => {
  const mappings = { codex: '.agents', 'claude-code': '.claude', copilot: '.github', cursor: '.cursor' };
  for (const [target, folder] of Object.entries(mappings)) {
    const project = join(parent, target);
    good('install', '--target', target, '--project', project);
    const installed = join(project, folder, 'skills/conquistador');
    assert.ok(existsSync(join(installed, 'library/conquistador/SKILL.md')));
    good('uninstall', '--path', installed);
  }
}));

test('modified and unowned folders and wrong modes refuse mutation', () => temporary(path => {
  good('install', '--target', 'skill', '--path', path);
  assert.match(good('status', '--target', 'harness', '--path', path), /wrong-target/);
  bad('uninstall', '--target', 'harness', '--path', path);
  writeFileSync(join(path, 'operator-notes.md'), 'preserve');
  assert.match(good('status', '--path', path), /modified/);
  for (const action of ['update', 'uninstall']) bad(action, '--path', path);
  assert.equal(readFileSync(join(path, 'operator-notes.md'), 'utf8'), 'preserve');
  rmSync(join(path, '.conquistador-install.json'));
  bad('uninstall', '--path', path);
  assert.match(good('status', '--path', path), /modified/);
}));

test('malformed input fails before creating paths', () => temporary((path, parent) => {
  for (const args of [
    ['install', '--target', 'unknown', '--path', path],
    ['install', '--target', 'skill', '--path', path, '--unknown', 'x'],
    ['install', '--target', 'skill', '--path', path, '--path', path],
    ['install', '--target', 'skill', '--path', path, '--url', 'https://example.com'],
    ['install', '--target', 'skill', '--path', 'relative'],
    ['install', '--target', 'skill', '--path', path, '--project', parent],
    ['install', '--target', 'skill', '--project', parent],
    ['install', '--target', 'skill', '--path', path, '--target'],
    ['status', '--path', path, '--url', 'https://example.com'],
  ]) bad(...args);
  assert.deepEqual(readdirSync(parent), []);
}));

test('MCP origin validation rejects credentials and malformed URLs without writes', () => temporary((path, parent) => {
  for (const url of ['garbage', 'https:example.com', 'file:///tmp/foo', 'http://example.com', 'https://user:secret@example.com', 'https://example.com?token=secret', 'https://example.com?', 'https://example.com/#fragment', 'https://example.com/path', 'https://example.com\\evil', ' https://example.com', 'https://example.com/\n']) {
    const output = bad('install', '--target', 'mcp', '--path', path, '--url', url);
    assert.doesNotMatch(output, /user:secret|token=secret/);
  }
  bad('install', '--target', 'mcp', '--path', path);
  assert.deepEqual(readdirSync(parent), []);
}));

test('MCP config lifecycle retains service/data and never connects or edits host configuration', () => temporary(async (path, parent) => {
  let requests = 0;
  const server = createServer((req, res) => { requests++; res.end('unexpected'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const sentinel = join(parent, 'host-config.json');
  writeFileSync(sentinel, '{"keep":"model and data settings"}');
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.match(good('install', '--target', 'mcp', '--path', path, '--url', url), /configured locally\. Connection unverified/);
    const config = JSON.parse(readFileSync(join(path, 'connector.json')));
    assert.deepEqual(config, { command: process.execPath, args: [join(root, 'runtime/bin/conquistador.js'), 'mcp', '--url', url] });
    assert.deepEqual(readdirSync(path).sort(), ['.conquistador-install.json', 'connector.json']);
    good('update', '--path', path);
    good('update', '--target', 'mcp', '--path', path, '--url', 'https://example.com');
    assert.equal(JSON.parse(readFileSync(join(path, 'connector.json'))).args.at(-1), 'https://example.com');
    good('uninstall', '--path', path);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 0);
    assert.equal(server.listening, true);
    assert.equal(readFileSync(sentinel, 'utf8'), '{"keep":"model and data settings"}');
    assert.deepEqual(readdirSync(parent), ['host-config.json']);
  } finally { await new Promise(resolve => server.close(resolve)); }
}));

test('MCP local edits prevent removal and update', () => temporary(path => {
  good('install', '--target', 'mcp', '--path', path, '--url', 'http://[::1]:4317');
  writeFileSync(join(path, 'connector.json'), '{"operator":"edit"}');
  assert.match(good('status', '--path', path), /modified/);
  bad('update', '--target', 'mcp', '--path', path, '--url', 'https://example.com');
  bad('uninstall', '--path', path);
  assert.equal(readFileSync(join(path, 'connector.json'), 'utf8'), '{"operator":"edit"}');
}));

test('plugin and harness staging use shared receipt modes; experiments are handoff only', () => temporary(path => {
  for (const target of ['claude-plugin', 'codex-plugin', 'copilot-plugin', 'agent-plugins', 'harness', 'squad']) {
    const output = good('install', '--target', target, '--path', path);
    assert.match(output, /Host activation unverified/);
    if (target.includes('plugin')) assert.match(output, /remain host-owned/);
    if (target === 'claude-plugin') {
      assert.match(output, /'claude' 'plugin' 'marketplace' 'add'/);
      assert.match(output, /'--scope' 'local'/);
    }
    if (target === 'codex-plugin') assert.match(output, /'codex' 'plugin' 'add'/);
    if (target === 'copilot-plugin') assert.match(output, /'copilot' 'plugin' 'install'/);
    good('update', '--path', path);
    good('uninstall', '--path', path);
  }
  for (const target of ['grok-bot', 'eve']) {
    assert.match(good('install', '--target', target, '--path', path), /Experimental handoff only\. No files installed/);
    assert.equal(existsSync(path), false);
  }
}));

test('symlink ancestors and payloads are refused', () => temporary((path, parent) => {
  symlinkSync(parent, path);
  bad('install', '--target', 'skill', '--path', join(path, 'install'));
  rmSync(path);
  good('install', '--target', 'mcp', '--path', path, '--url', 'https://example.com');
  symlinkSync(join(path, 'connector.json'), join(path, 'link'));
  assert.match(good('status', '--path', path), /modified/);
  bad('uninstall', '--path', path);
}));

test('module is import-safe and no-argument nonterminal input explains guided usage', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(script)}); if (typeof m.runSetup !== 'function') throw Error('missing API');`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(bad(), /Interactive setup requires a terminal/);
});


test('exported API returns numeric failure without terminating embedding process', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const { runSetup } = await import(${JSON.stringify(script)}); const code = await runSetup(['unknown']); if (code !== 1) throw Error('wrong return'); console.log('embedding continued');`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /embedding continued/);
});
