#!/usr/bin/env node
// E2E: install the shipped package the way users do, then run it with every detected agent's real
// plugin manager inside isolated homes. Your own agent settings are never touched.
//   Route A: npm install -g from the Git commit (the documented install), then I1–I7, I11, remove.
//   Route B: npx from a packed tarball (the public route), then delete the npx cache (I9, I12).
//   Then agent-first.exp runs against the Route A binary.
//   node tools/e2e/package-install.mjs [OUT_DIR]
// Writes OUT_DIR/report.json. Exit 1 when any check fails. The case IDs are in
// docs/REVIEW-2026-09-SURFACES.md, Part 4.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requiredPayload } from '../agents.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const out = resolve(process.argv[2] ?? join(root, 'dist/e2e/package-install'));
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const sha = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const dirty = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim() !== '';
const work = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-e2e-package-')));
const which = command => spawnSync('/bin/sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).stdout.trim();
const toolDirs = [...new Set(['claude', 'codex', 'cursor-agent', 'copilot', 'grok', 'git', 'npm', 'expect', 'script'].map(which).filter(Boolean).map(dirname))];

const checks = [];
const log = [];
function check(id, name, ok, detail = '') {
  checks.push({ id, name, ok: Boolean(ok), detail });
  console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail && !ok ? `  ${detail}` : ''}`);
}
function run(command, args, { env, cwd = work, timeout = 600_000 } = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, { env, cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  log.push(`$ ${command} ${args.join(' ')}\n${output.trim()}\n[exit ${result.status}, ${Date.now() - started} ms]\n`);
  return { status: result.status, output, stdout: result.stdout ?? '', ms: Date.now() - started };
}
function isolated(name, prefixBin) {
  const home = join(work, name);
  mkdirSync(join(home, '.cursor'), { recursive: true });
  mkdirSync(join(home, 'acme'), { recursive: true });
  writeFileSync(join(home, 'acme', 'README.md'), '# Acme Invoices\n\nInvoicing for freelance designers.\n');
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config'), CLAUDE_CONFIG_DIR: join(home, '.claude'), CODEX_HOME: join(home, '.codex'), CONQUISTADOR_HOME: join(home, '.conquistador'), CURSOR_HOME: join(home, '.cursor'), TERM: 'xterm-256color', PATH: [prefixBin, ...toolDirs, dirname(process.execPath), '/usr/bin', '/bin'].filter(Boolean).join(':') };
  for (const name of ['CONQUISTADOR_PLAYBOOKS', 'CONQUISTADOR_DEBUG', 'CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_ENTRYPOINT', 'npm_config_prefix']) delete env[name];
  const plugin = join(home, '.conquistador', 'plugin');
  const cursor = join(home, '.cursor', 'plugins', 'local', 'conquistador');
  const listed = {
    'claude-code': () => run('claude', ['plugin', 'list', '--json'], { env }).stdout.includes('"conquistador@conquistador"'),
    codex: () => run('codex', ['plugin', 'list'], { env }).stdout.includes('conquistador@conquistador'),
    copilot: () => run('copilot', ['plugin', 'list'], { env }).stdout.includes('conquistador@conquistador'),
    grok: () => /\bconquistador\b/.test(run('grok', ['plugin', 'list'], { env }).stdout),
    cursor: () => existsSync(join(cursor, '.cursor-plugin', 'plugin.json')),
  };
  return { home, env, plugin, cursor, listed };
}
const missing = folder => requiredPayload.filter(item => !existsSync(join(folder, item)));
const stackTrace = text => /\n\s+at .+:\d+:\d+/.test(text);
const observe = (box, agents) => Object.fromEntries(agents.map(id => [id, box.listed[id]()]));
const all = (observed, value) => Object.values(observed).length > 0 && Object.values(observed).every(item => item === value);
const deadPid = () => { for (let pid = 999_999; pid > 900_000; pid -= 1) { try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') return pid; } } return 999_999; };
const marker = folder => { try { return JSON.parse(readFileSync(join(folder, '.conquistador-owned.json'), 'utf8')); } catch { return null; } };
// A pseudo-terminal, so the start flow runs its interactive path. `--no-open` asks no questions.
const tty = (cli, args, box) => run('script', ['-q', '/dev/null', cli, ...args], { env: box.env, cwd: join(box.home, 'acme') });

// Answers MCP initialize and tools/list from the stable plugin copy, with no npm package present.
function mcpAnswers(plugin, env) {
  const lines = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ].map(item => JSON.stringify(item)).join('\n');
  const result = spawnSync(process.execPath, [join(plugin, 'mcp', 'server.mjs')], { env, input: `${lines}\n`, encoding: 'utf8', timeout: 30_000 });
  return (result.stdout ?? '').includes('conquistador_brief');
}
function textBelow(folder, needle) {
  const stack = [folder];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) { if (!path.includes(`${join('.conquistador', 'plugin')}`) && entry.name !== 'node_modules') stack.push(path); continue; }
      if (entry.name === '.conquistador-owned.json') continue;
      try { if (statSync(path).size < 2_000_000 && readFileSync(path, 'utf8').includes(needle)) return path; } catch { /* Unreadable. */ }
    }
  }
  return null;
}

console.log(`Conquistador ${version} at ${sha.slice(0, 7)}${dirty ? ' (uncommitted changes are not tested)' : ''}\nWork folder: ${work}\n`);

// Route A: the documented Git install into a durable npm prefix.
const prefix = join(work, 'prefix');
const a = isolated('home-a', join(prefix, 'bin'));
const cli = join(prefix, 'bin', 'conquistador');
const install = run('npm', ['install', '--global', '--ignore-scripts', '--install-links', '--prefix', prefix, '--cache', join(work, 'npm-cache-a'), `git+file://${root}#${sha}`], { env: a.env });
check('A0', `npm install -g from Git (${Math.round(install.ms / 1000)} s)`, install.status === 0 && existsSync(cli), install.output.trim().split('\n').slice(-3).join(' '));
const packageDir = join(prefix, 'lib', 'node_modules', '@forsvn', 'conquistador');
check('A0', 'the installed package lives under node_modules', packageDir.includes('/node_modules/') && existsSync(join(packageDir, 'package.json')));
check('A0', `the installed CLI reports ${version}`, run(cli, ['--version'], { env: a.env }).output.trim() === version);
const agents = JSON.parse(run(cli, ['agents', '--json'], { env: a.env }).stdout || '{"agents":[]}').agents.filter(agent => agent.found).map(agent => agent.id);
check('A0', `agents found: ${agents.join(', ') || 'none'}`, agents.length > 0);

let result = run(cli, ['add', '--yes'], { env: a.env });
let seen = observe(a, agents);
check('I1', 'add --yes from the npm package installs every agent', result.status === 0 && all(seen, true), JSON.stringify(seen));
check('I1', 'the stable plugin copy is complete', missing(a.plugin).length === 0, missing(a.plugin).join(', '));
check('I1', 'the Cursor copy is complete', missing(a.cursor).length === 0, missing(a.cursor).join(', '));

result = run(cli, ['add', '--yes'], { env: a.env });
seen = observe(a, agents);
check('A1', 'add --yes again is idempotent', result.status === 0 && all(seen, true), JSON.stringify(seen));

const pid = deadPid();
const stale = [`${a.cursor}.tmp-${pid}`, `${a.plugin}.old-${pid}`];
for (const folder of stale) { mkdirSync(folder, { recursive: true }); writeFileSync(join(folder, 'partial.txt'), 'left by a crash\n'); }
result = run(cli, ['update'], { env: a.env });
check('I4', 'update removes folders a crashed run left behind', result.status === 0 && stale.every(folder => !existsSync(folder)), stale.filter(existsSync).join(', '));

rmSync(join(a.plugin, 'mcp', 'server.mjs'));
result = tty(cli, ['--no-open'], a);
check('I6', 'bare conquistador repairs a broken plugin copy', result.status === 0 && missing(a.plugin).length === 0 && /Installed into/.test(result.output), result.output.trim().split('\n').slice(-4).join(' | '));

rmSync(a.cursor, { recursive: true, force: true });
mkdirSync(a.cursor, { recursive: true });
writeFileSync(join(a.cursor, 'notes.txt'), 'mine\n');
result = run(cli, ['add', '--yes'], { env: a.env });
seen = observe(a, agents.filter(id => id !== 'cursor'));
check('I5', 'a folder Conquistador did not create is left in place', readFileSync(join(a.cursor, 'notes.txt'), 'utf8') === 'mine\n' && readdirSync(a.cursor).length === 1);
check('I3', 'Cursor fails with a reason; the other agents still install', result.status === 1 && /✗ Cursor: .*not created by Conquistador/.test(result.output) && all(seen, true) && !stackTrace(result.output), result.output.trim().split('\n').slice(-3).join(' | '));
result = tty(cli, ['--no-open'], a);
check('I3', 'the start flow reports Cursor, offers a retry, and still finishes', result.status === 0 && /Cursor: .*not created by Conquistador/.test(result.output) && /conquistador add cursor/.test(result.output) && /Ready/.test(result.output) && !stackTrace(result.output), result.output.trim().split('\n').slice(-5).join(' | '));
rmSync(a.cursor, { recursive: true, force: true });
result = run(cli, ['add', 'cursor', '--yes'], { env: a.env });
check('I3', 'add cursor --yes succeeds after the folder moves', result.status === 0 && missing(a.cursor).length === 0);

const broken = join(work, 'broken', 'node_modules', '@forsvn', 'conquistador');
cpSync(packageDir, broken, { recursive: true });
rmSync(join(broken, '.codex-plugin', 'plugin.json'));
const before = marker(a.plugin);
result = run(process.execPath, [join(broken, 'runtime', 'bin', 'conquistador.js'), 'add', '--yes'], { env: a.env });
const leftovers = readdirSync(dirname(a.plugin)).filter(name => /\.(?:tmp|old)-\d+$/.test(name));
check('I2', 'an incomplete package names the missing file and installs nothing', result.status === 1 && /missing \.codex-plugin\/plugin\.json/.test(result.output) && /agents are unchanged/.test(result.output) && !stackTrace(result.output), result.output.trim().split('\n').slice(-3).join(' | '));
check('I2', 'the last good plugin copy stays in place', missing(a.plugin).length === 0 && marker(a.plugin)?.copiedAt === before?.copiedAt && leftovers.length === 0, leftovers.join(', '));

const config = join(a.home, '.conquistador', 'config.json');
mkdirSync(config, { recursive: true });
result = run(cli, ['playbooks', 'add', a.home], { env: a.env });
const details = /Details: (.+\.log)/.exec(result.output)?.[1];
check('I11', 'an unexpected error prints one line, a log file, and where to report it', result.status === 1 && /Conquistador stopped: /.test(result.output) && /issues/.test(result.output) && !stackTrace(result.output), result.output.trim());
check('I11', 'the log file holds the stack trace', Boolean(details) && existsSync(details) && stackTrace(readFileSync(details, 'utf8')));
rmSync(config, { recursive: true, force: true });

result = run(cli, ['remove'], { env: a.env });
seen = observe(a, agents);
check('A2', 'remove uninstalls from every agent and deletes both copies', result.status === 0 && all(seen, false) && !existsSync(a.plugin) && !existsSync(a.cursor), JSON.stringify(seen));

// Route B: npx from a tarball packed from a clean clone, the way npm publish would build it.
const clone = join(work, 'clone');
run('git', ['clone', '--quiet', root, clone]);
run('git', ['-C', clone, 'checkout', '--quiet', sha]);
const pack = run('npm', ['pack', '--json', '--pack-destination', work, '--cache', join(work, 'npm-cache-pack')], { cwd: clone, env: a.env });
let packed = {};
try { packed = JSON.parse(pack.stdout)[0] ?? {}; } catch { /* Checked below. */ }
const tarball = packed.filename ? join(work, packed.filename) : '';
check('B0', `npm pack: ${packed.entryCount ?? '?'} files, ${((packed.size ?? 0) / 1e6).toFixed(1)} MB packed, ${((packed.unpackedSize ?? 0) / 1e6).toFixed(1)} MB unpacked`, pack.status === 0 && existsSync(tarball));
check('B0', 'the tarball has no nested node_modules', (packed.files ?? []).length > 0 && !(packed.files ?? []).some(file => file.path.includes('node_modules/')));
const b = isolated('home-b', null);
const npxCache = join(work, 'npx-cache');
result = run('npx', ['--yes', '--cache', npxCache, '--package', tarball, '--', 'conquistador', 'add', '--yes'], { env: b.env });
seen = observe(b, agents);
check('B1', `npx from the tarball installs every agent (${Math.round(result.ms / 1000)} s)`, result.status === 0 && all(seen, true) && missing(b.plugin).length === 0, JSON.stringify(seen));
check('I12', 'no agent setting points into the npx cache', textBelow(b.home, npxCache) === null, textBelow(b.home, npxCache) ?? '');
rmSync(npxCache, { recursive: true, force: true });
seen = observe(b, agents);
check('I12', 'after the npx cache is deleted, every agent still lists the plugin', all(seen, true), JSON.stringify(seen));
check('I9', 'the MCP server runs from the stable copy with no npm package present', mcpAnswers(b.plugin, b.env));
result = run('npx', ['--yes', '--cache', npxCache, '--package', tarball, '--', 'conquistador', 'remove'], { env: b.env });
seen = observe(b, agents);
check('B2', 'npx remove cleans up', result.status === 0 && all(seen, false), JSON.stringify(seen));

// The interactive start flow, against the installed binary instead of the checkout.
if (which('expect')) {
  result = run('expect', [join(root, 'tools/e2e/agent-first.exp')], { env: { ...process.env, CONQUISTADOR_E2E_CLI: cli, PATH: [join(prefix, 'bin'), ...toolDirs, dirname(process.execPath), '/usr/bin', '/bin'].join(':') }, cwd: root });
  const passed = (result.output.match(/CHECK PASS/g) ?? []).length, failed = (result.output.match(/CHECK FAIL/g) ?? []).length;
  check('S1', `agent-first.exp against the installed package: ${passed} passed, ${failed} failed`, result.status === 0 && failed === 0 && passed > 0, result.output.trim().split('\n').slice(-3).join(' | '));
} else check('S1', 'agent-first.exp (expect is not installed)', false);

const report = { schema: 'conquistador.e2e.package-install/v1', at: new Date().toISOString(), version, sha, dirty, node: process.version, platform: `${process.platform}-${process.arch}`, agents, work, package: { files: packed.entryCount, packedBytes: packed.size, unpackedBytes: packed.unpackedSize }, checks, ok: checks.every(item => item.ok) };
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'commands.log'), log.join('\n'));
console.log(`\n${report.ok ? 'PASS' : 'FAIL'} ${checks.filter(item => item.ok).length}/${checks.length}: ${join(out, 'report.json')}`);
process.exit(report.ok ? 0 : 1);
