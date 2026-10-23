#!/usr/bin/env node
// Process E2E. Failure modes: docs/INSTALLATION-ACCEPTANCE.md. Never uses the operator's home.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const work = mkdtempSync(join(tmpdir(), 'cq-install-methods-'));
const out = resolve((process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null) || join(root, 'dist/e2e/installation-methods'));
const steps = [];
const env = { ...process.env, CONQUISTADOR_EXECUTOR_APP: 'off', HOME: work, USERPROFILE: work, CONQUISTADOR_HOME: join(work, '.conquistador'), CODEX_HOME: join(work, '.codex'), NO_COLOR: '1', CI: '1' };
mkdirSync(out, { recursive: true });
writeFileSync(join(work, 'package.json'), '{"private":true}');
const cli = args => {
  const result = spawnSync(process.execPath, [join(root, 'runtime/bin/conquistador.js'), ...args], { cwd: work, env, encoding: 'utf8', timeout: 60_000 });
  if (result.error) throw result.error;
  return { status: result.status, text: result.stdout + result.stderr };
};
function check(name, run) {
  try { run(); steps.push({ name, passed: true }); }
  catch (error) { steps.push({ name, passed: false, error: error.message }); }
}
try {
  // Failure modes: CLI logs corrupt JSON-RPC, no tools are exposed, or server startup installs host configuration.
  check('standalone MCP serves real stdio tools without installing host configuration', () => {
    const messages = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'install-e2e', version: '1' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'conquistador_methods', arguments: {} } },
    ];
    const result = spawnSync(process.execPath, [join(root, 'runtime/bin/conquistador.js'), 'mcp'], {
      cwd: work, env, encoding: 'utf8', timeout: 30_000,
      input: messages.map(message => JSON.stringify(message)).join('\n') + '\n',
    });
    assert.equal(result.status, 0, result.stderr);
    const replies = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(replies.length, 3);
    assert.equal(replies.find(reply => reply.id === 2).result.tools.length, 8);
    const methods = JSON.parse(replies.find(reply => reply.id === 3).result.content[0].text);
    assert.ok(methods.methods.length > 0);
    for (const folder of ['.agents', '.claude', '.codex', '.conquistador']) assert.equal(existsSync(join(work, folder)), false, folder);
  });
  check('help exposes all four methods', () => {
    const result = cli(['--help']); assert.equal(result.status, 0);
    for (const command of ['skills', 'install', 'mcp', 'plugins']) assert.match(result.text, new RegExp(`conquistador ${command}`));
  });
  check('skills previews a project skill without hooks or MCP and writes nothing', () => {
    const result = cli(['skills', '--providers=codex', '--json']); assert.equal(result.status, 0);
    const plan = JSON.parse(result.text); assert.equal(plan.scope, 'project'); assert.deepEqual(plan.surfaces.map(s => s.id), ['agents']);
    assert.equal(plan.surfaces[0].hooks, null); assert.equal(existsSync(join(work, '.agents')), false);
  });
  check('skills installs one complete owned skill', () => {
    const result = cli(['skills', '--providers=codex', '--yes', '--plain']); assert.equal(result.status, 0, result.text);
    const skill = join(work, '.agents/skills/conquistador');
    assert.ok(existsSync(join(skill, 'SKILL.md'))); assert.ok(existsSync(join(skill, 'commands/social/COMMAND.md')));
    assert.equal(existsSync(join(skill, 'hooks')), false);
  });
  check('skills rejects a conflicting surface', () => {
    const result = cli(['skills', '--surface=cli', '--yes']); assert.equal(result.status, 2);
  });
  check('fixed methods reject ignored selections and legacy type overrides', () => {
    for (const args of [
      ['skills', '--apps=zed'], ['plugins', '--apps', 'zed'],
      ['mcp', 'install', '--providers=codex'], ['mcp', 'install', '--in', 'codex'],
      ['mcp', 'install', '--no-hooks'], ['plugins', '--skills'], ['skills', '--plugin'],
      ['plugins', '--package-manager=bun'], ['skills', '--executor-name=other'], ['mcp', 'install', '--bot-out=other'],
    ]) assert.equal(cli([...args, '--json']).status, 2, args.join(' '));
  });
  check('plugins rejects agents without a plugin contract', () => {
    const result = cli(['plugins', '--providers=hermes', '--dry-run']); assert.equal(result.status, 2);
  });
  check('plugin selection aliases cannot bypass the native-client boundary', () => {
    for (const args of [['--in=hermes'], ['--in', 'hermes']]) assert.equal(cli(['plugins', ...args, '--json']).status, 2);
    assert.equal(cli(['plugins', '--in=codex', '--json']).status, 0);
  });
  check('plugins previews the native global path', () => {
    const result = cli(['plugins', '--providers=codex', '--json']); assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.text).scope, 'global');
  });
  check('plugins does not auto-select a detected skill-only agent', () => {
    mkdirSync(join(work, '.hermes'), { recursive: true });
    const result = cli(['plugins', '--json']); assert.equal(result.status, 0);
    assert.ok(!JSON.parse(result.text).surfaces[0].steps.some(step => step.agent === 'hermes' || step.agents?.includes('hermes')));
  });
  check('skills cannot disable existing global plugin hooks', () => {
    const result = cli(['skills', '--providers=codex', '--no-hooks', '--yes']); assert.equal(result.status, 2);
    assert.equal(existsSync(join(work, '.conquistador/config.json')), false);
  });
  check('install opens the current installer, not the old operator', () => {
    const result = cli(['install', '--providers=codex', '--scope=project', '--json']); assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.text).surfaces[0].id, 'agents');
  });
  check('MCP help is readable without starting a server', () => {
    const result = cli(['mcp', '--help']); assert.equal(result.status, 0); assert.match(result.text, /stdio/); assert.match(result.text, /mcp install/);
  });
  // Failure modes: MCP setup hides coding-agent routes or bundles unrelated surfaces.
  check('MCP help exposes standalone coding-agent and remote-app paths', () => {
    const result = cli(['mcp', '--help']);
    for (const text of ['codex mcp add', 'claude mcp add', 'Executor', 'Composio', 'No skills or hooks']) assert.ok(result.text.includes(text), text);
  });
  check('Executor shortcut previews only the existing Executor surface', () => {
    const result = cli(['mcp', 'install', '--executor', '--json']);
    assert.equal(result.status, 0, result.text);
    assert.deepEqual(JSON.parse(result.text).surfaces.map(s => s.id), ['executor']);
  });
  check('Executor shortcut rejects ambiguous desktop and agent selections', () => {
    for (const flag of ['--apps=zed', '--providers=codex']) assert.equal(cli(['mcp', 'install', '--executor', flag, '--json']).status, 2);
  });
  check('MCP client setup previews only chosen clients', () => {
    const result = cli(['mcp', 'install', '--apps=zed', '--json']); assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.text).surfaces.map(s => s.id), ['mcp-apps']);
  });
} finally {
  const source = ['runtime/bin/conquistador.js', 'tools/installation-methods.mjs', 'tools/e2e/installation-methods.mjs'].map(path => ({ path, sha256: existsSync(join(root, path)) ? createHash('sha256').update(readFileSync(join(root, path))).digest('hex') : null }));
  const report = { mode: 'isolated CLI processes; no native host acceptance', source, passed: steps.filter(s => s.passed).length, steps };
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  rmSync(work, { recursive: true, force: true });
  console.log(`${report.passed}/${steps.length} passed. ${join(out, 'report.json')}`);
  for (const step of steps.filter(s => !s.passed)) console.error(step.name, step.error);
  if (report.passed !== steps.length) process.exitCode = 1;
}
