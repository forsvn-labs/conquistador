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
const env = { ...process.env, HOME: work, USERPROFILE: work, CONQUISTADOR_HOME: join(work, '.conquistador'), CODEX_HOME: join(work, '.codex'), NO_COLOR: '1', CI: '1' };
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
  check('plugins rejects agents without a plugin contract', () => {
    const result = cli(['plugins', '--providers=hermes', '--dry-run']); assert.equal(result.status, 2);
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
  check('MCP client setup previews only chosen clients', () => {
    const result = cli(['mcp', 'install', '--apps=zed', '--json']); assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.text).surfaces.map(s => s.id), ['mcp-apps']);
  });
} finally {
  const source = ['runtime/bin/conquistador.js', 'tools/installation-methods.mjs'].map(path => ({ path, sha256: existsSync(join(root, path)) ? createHash('sha256').update(readFileSync(join(root, path))).digest('hex') : null }));
  const report = { mode: 'isolated CLI processes; no native host acceptance', source, passed: steps.filter(s => s.passed).length, steps };
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  rmSync(work, { recursive: true, force: true });
  console.log(`${report.passed}/${steps.length} passed. ${join(out, 'report.json')}`);
  for (const step of steps.filter(s => !s.passed)) console.error(step.name, step.error);
  if (report.passed !== steps.length) process.exitCode = 1;
}
