#!/usr/bin/env node
// E2E: install → reinstall → update → remove with every detected agent's real plugin manager,
// inside an isolated HOME so your own agent settings are never touched.
//   node tools/e2e/install-lifecycle.mjs [OUT_DIR]
// Writes OUT_DIR/report.json. Exit 1 when any step disagrees with the agent's own listing.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const out = resolve(process.argv[2] ?? join(root, 'dist/e2e/install-lifecycle'));
const home = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-e2e-home-')));
const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: join(home, '.claude'), CODEX_HOME: join(home, '.codex'), CONQUISTADOR_HOME: join(home, '.conquistador'), CURSOR_HOME: join(home, '.cursor') };
delete env.CONQUISTADOR_PLAYBOOKS;
const cli = args => spawnSync(process.execPath, [join(root, 'runtime/bin/conquistador.js'), ...args], { env, encoding: 'utf8', cwd: home, timeout: 600_000 });
const listed = {
  'claude-code': () => spawnSync('claude', ['plugin', 'list', '--json'], { env, encoding: 'utf8' }).stdout.includes('"conquistador@conquistador"'),
  codex: () => spawnSync('codex', ['plugin', 'list'], { env, encoding: 'utf8' }).stdout.includes('conquistador@conquistador'),
  copilot: () => spawnSync('copilot', ['plugin', 'list'], { env, encoding: 'utf8' }).stdout.includes('conquistador@conquistador'),
  grok: () => /\bconquistador\b/.test(spawnSync('grok', ['plugin', 'list'], { env, encoding: 'utf8' }).stdout),
  cursor: () => existsSync(join(home, '.cursor/plugins/local/conquistador/.cursor-plugin/plugin.json')),
};
const agents = JSON.parse(cli(['agents', '--json']).stdout).agents.filter(agent => agent.found).map(agent => agent.id);
const steps = [];
const record = (name, result, expectInstalled) => {
  const observed = Object.fromEntries(agents.map(id => [id, listed[id]()]));
  const ok = result.status === 0 && agents.every(id => observed[id] === expectInstalled);
  steps.push({ step: name, exit: result.status, expectInstalled, observed, ok, output: `${result.stdout}${result.stderr}`.trim().split('\n').slice(-12) });
  console.log(`${ok ? '✓' : '✗'} ${name}  ${JSON.stringify(observed)}`);
};
record('add --yes', cli(['add', '--yes']), true);
record('add --yes (again, idempotent)', cli(['add', '--yes']), true);
record('update', cli(['update']), true);
record('remove', cli(['remove']), false);
const report = { schema: 'conquistador.e2e.install-lifecycle/v1', at: new Date().toISOString(), node: process.version, agents, isolatedHome: home, steps, ok: steps.every(item => item.ok) };
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${report.ok ? 'PASS' : 'FAIL'}: ${join(out, 'report.json')}`);
process.exit(report.ok ? 0 : 1);
