#!/usr/bin/env node
// Install real package tarballs and the real Skills CLI in disposable projects.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const out = resolve(option('--out') ?? join(root, 'dist/e2e/installation-packages'));
const temp = mkdtempSync(join(tmpdir(), 'cq-package-methods-'));
const env = { ...process.env, HOME: temp, USERPROFILE: temp, CONQUISTADOR_HOME: join(temp, '.conquistador'), DISABLE_TELEMETRY: '1', NO_COLOR: '1', npm_config_cache: join(temp, 'npm-cache') };
mkdirSync(out, { recursive: true });
const steps = [], logs = [];
const run = (command, args, cwd = temp, input) => {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 180_000, input });
  logs.push(`$ ${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  assert.equal(result.status, 0, result.error?.message || result.stderr?.slice(-1000)); return result.stdout;
};
const check = (name, test) => { test(); steps.push({ name, passed: true }); console.log(`pass ${name}`); };
try {
  const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const alias = JSON.parse(readFileSync(join(root, 'packages/conquistador/package.json'), 'utf8'));
  check('alias pins the exact paired product version without lifecycle scripts', () => {
    assert.equal(alias.version, metadata.version); assert.equal(alias.dependencies[metadata.name], metadata.version); assert.equal(alias.scripts, undefined);
  });
  const mainPack = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', out], root))[0];
  const aliasPack = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', out], join(root, 'packages/conquistador')))[0];
  const app = join(temp, 'app'); mkdirSync(app); writeFileSync(join(app, 'package.json'), '{"private":true}');
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(out, mainPack.filename), join(out, aliasPack.filename)], app);
  const bin = join(app, 'node_modules/conquistador/bin/conquistador.js');
  check('installed short-name CLI exposes all four methods', () => {
    const text = run(process.execPath, [bin, '--help'], app); for (const name of ['skills', 'install', 'mcp', 'plugins']) assert.match(text, new RegExp(`conquistador ${name}`));
  });
  check('short-name CLI installs an owned project skill', () => {
    run(process.execPath, [bin, 'skills', '--providers=codex', '--yes', '--plain'], app);
    assert.ok(existsSync(join(app, '.agents/skills/conquistador/commands/social/COMMAND.md')));
  });
  check('short-name MCP serves only protocol messages over stdio', () => {
    const text = run(process.execPath, [bin, 'mcp'], app, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'package-e2e', version: '1' } } }) + '\n');
    const messages = text.trim().split('\n').map(line => JSON.parse(line)); assert.equal(messages.length, 1); assert.ok(messages[0].result.serverInfo);
  });
  for (const [name, source] of [['local canonical skill', join(root, 'skills/conquistador')], ['documented GitHub skill', 'https://github.com/forsvn-labs/conquistador/tree/main/skills/conquistador']]) {
    const project = join(temp, name.replaceAll(' ', '-')); mkdirSync(project); writeFileSync(join(project, 'package.json'), '{"private":true}');
    check(`Skills CLI 1.7.2 installs ${name} as a copy with all resources`, () => {
      run('npx', ['--yes', 'skills@1.7.2', 'add', source, '--skill', 'conquistador', '--agent', 'codex', '--copy', '--yes', '--json'], project);
      const folder = join(project, '.agents/skills/conquistador'); assert.ok(!lstatSync(folder).isSymbolicLink());
      assert.equal(readFileSync(join(folder, 'commands/social/COMMAND.md'), 'utf8'), readFileSync(join(root, 'skills/conquistador/commands/social/COMMAND.md'), 'utf8'));
      assert.ok(!existsSync(join(folder, 'node_modules'))); assert.ok(!existsSync(join(folder, '.git')));
    });
  }
} catch (error) { steps.push({ name: 'E2E completion', passed: false, error: error.message }); console.error(error.stack); }
finally {
  const packages = ['forsvn-conquistador-0.7.0.tgz', 'conquistador-0.7.0.tgz'].filter(file => existsSync(join(out, file))).map(file => ({ file, sha256: createHash('sha256').update(readFileSync(join(out, file))).digest('hex') }));
  writeFileSync(join(out, 'report.json'), JSON.stringify({ mode: 'real npm tarball installs and external Skills CLI; unpublished alias', packages, steps }, null, 2) + '\n');
  writeFileSync(join(out, 'transcript.log'), logs.join('\n').replaceAll(temp, '<temporary-home>').replaceAll(realpathSync(temp), '<temporary-home>'));
  rmSync(temp, { recursive: true, force: true });
  console.log(`${steps.filter(s => s.passed).length}/${steps.length} passed. ${join(out, 'report.json')}`);
  if (steps.some(s => !s.passed)) process.exitCode = 1;
}
