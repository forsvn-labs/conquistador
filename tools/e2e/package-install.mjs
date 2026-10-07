#!/usr/bin/env node
// E2E: install the shipped package the way users do, then run it with every detected agent's real
// plugin manager inside isolated homes. Your own agent settings are never touched.
//   Route A: npm install -g from the Git commit (the documented install), then I1–I7, I11, remove.
//   Route B: npx from a packed tarball (the public route), then delete the npx cache (I9, I12).
//   Route A also covers project scope, skill-format hosts, --dry-run, --no-hooks, and doctor (D8).
//   Route C: every CLI command from the packed tarball, on this Node and on Node 22.18 when
//   CONQUISTADOR_E2E_NODE22 names that executable.
//   Then agent-first.exp runs against the Route A binary.
//   node tools/e2e/package-install.mjs [OUT_DIR]
//   CONQUISTADOR_E2E_REF=v0.0.16 node tools/e2e/package-install.mjs dist/e2e/package-install-v0.0.16
// Writes OUT_DIR/report.json. Exit 1 when any check fails. The case IDs are in
// docs/REVIEW-2026-09-SURFACES.md, Part 4.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { onPath, missingPayload } from '../agents.mjs';
import { spawnCommand } from '../spawn.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const out = resolve(process.argv[2] ?? join(root, 'dist/e2e/package-install'));
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
// CONQUISTADOR_E2E_REF tests another commit or tag, for example a negative control on a known-bad release.
const sha = spawnSync('git', ['-C', root, 'rev-parse', `${process.env.CONQUISTADOR_E2E_REF || 'HEAD'}^{commit}`], { encoding: 'utf8' }).stdout.trim();
const dirty = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim() !== '';
const work = realpathSync(mkdtempSync(join(tmpdir(), 'conquistador-e2e-package-')));
const windows = process.platform === 'win32';
const which = command => onPath(command) ?? '';
// System folders a test PATH keeps, so git, sh, and cmd still resolve. Git for Windows crashes
// (0xC0000005) when only its mingw64\\bin folder is on PATH, so keep all of its folders.
const gitDirs = windows ? (process.env.PATH ?? '').split(delimiter).filter(folder => /[\\/]Git[\\/]/i.test(folder)) : [];
const systemDirs = windows ? [join(process.env.SystemRoot ?? 'C:\\Windows', 'System32'), process.env.SystemRoot ?? 'C:\\Windows', ...gitDirs] : ['/usr/bin', '/bin'];
const toolDirs = [...new Set(['claude', 'codex', 'cursor-agent', 'copilot', 'grok', 'gemini', 'opencode', 'pi', 'hermes', 'agy', 'kiro-cli', 'vibe', 'git', 'npm', 'expect', 'script'].map(which).filter(Boolean).map(dirname))];

const checks = [];
const log = [];
function check(id, name, ok, detail = '') {
  checks.push({ id, name, ok: Boolean(ok), detail });
  console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail && !ok ? `  ${detail}` : ''}`);
}
// A check this platform cannot run. It is reported and never counts as passed.
function notRun(id, name, reason) {
  checks.push({ id, name, ok: null, notRun: reason });
  console.log(`- ${id} ${name}  (not run: ${reason})`);
}

function run(command, args, { env, cwd = work, timeout = 600_000 } = {}) {
  const started = Date.now();
  const { file, args: fileArgs, options } = spawnCommand(command, args, env ?? process.env);
  const result = spawnSync(file, fileArgs, { env, cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  log.push(`$ ${command} ${args.join(' ')}\n${output.trim()}\n[exit ${result.status}, ${Date.now() - started} ms]\n`);
  return { status: result.status, output, stdout: result.stdout ?? '', ms: Date.now() - started };
}
function isolated(name, prefixBin) {
  const home = join(work, name);
  mkdirSync(join(home, '.cursor'), { recursive: true });
  mkdirSync(join(home, 'acme'), { recursive: true });
  writeFileSync(join(home, 'acme', 'README.md'), '# Acme Invoices\n\nInvoicing for freelance designers.\n');
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config'), CLAUDE_CONFIG_DIR: join(home, '.claude'), CODEX_HOME: join(home, '.codex'), CONQUISTADOR_HOME: join(home, '.conquistador'), CURSOR_HOME: join(home, '.cursor'), TERM: 'xterm-256color', PATH: [prefixBin, ...toolDirs, dirname(process.execPath), ...systemDirs].filter(Boolean).join(delimiter) };
  // The empty test home has no global Git config, so Git's folder-ownership check cannot see
  // the runner's safe.directory entry for this checkout.
  Object.assign(env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: '*' });
  // Windows reads the home folder from USERPROFILE and app data from APPDATA and LOCALAPPDATA.
  if (windows) Object.assign(env, { USERPROFILE: home, APPDATA: join(home, 'AppData', 'Roaming'), LOCALAPPDATA: join(home, 'AppData', 'Local') });
  if (windows) for (const name of ['APPDATA', 'LOCALAPPDATA']) mkdirSync(env[name], { recursive: true });
  // PATH may be spelled Path on Windows; keep one entry.
  if (windows) for (const name of Object.keys(env)) if (name !== 'PATH' && name.toUpperCase() === 'PATH') delete env[name];
  for (const name of ['CONQUISTADOR_PLAYBOOKS', 'CONQUISTADOR_DEBUG', 'CLAUDECODE', 'CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_CODE_ENTRYPOINT', 'npm_config_prefix', 'OPENCODE_CONFIG_DIR', 'HERMES_HOME']) delete env[name];
  const plugin = join(home, '.conquistador', 'plugin');
  const cursor = join(home, '.cursor', 'plugins', 'local', 'conquistador');
  const listed = {
    'claude-code': () => run('claude', ['plugin', 'list', '--json'], { env }).stdout.includes('"conquistador@conquistador"'),
    codex: () => run('codex', ['plugin', 'list'], { env }).stdout.includes('conquistador@conquistador'),
    copilot: () => run('copilot', ['plugin', 'list'], { env }).stdout.includes('conquistador@conquistador'),
    grok: () => /\bconquistador\b/.test(run('grok', ['plugin', 'list'], { env }).stdout),
    cursor: () => existsSync(join(cursor, '.cursor-plugin', 'plugin.json')),
    // Skill-format hosts have no plugin manager: the owned skill copy is the registration.
    ...Object.fromEntries(Object.entries({ gemini: '.gemini/skills', opencode: '.config/opencode/skills', pi: '.agents/skills', hermes: '.hermes/skills',
      antigravity: '.gemini/antigravity-cli/skills', kiro: '.kiro/skills', vibe: '.vibe/skills' })
      .map(([id, folder]) => [id, () => existsSync(join(home, folder, 'conquistador', '.conquistador-owned.json'))])),
  };
  return { home, env, plugin, cursor, listed };
}

const missing = missingPayload;
const stackTrace = text => /\n\s+at .+:\d+:\d+/.test(text);
const observe = (box, agents) => Object.fromEntries(agents.map(id => [id, box.listed[id]()]));
const all = (observed, value) => Object.values(observed).length > 0 && Object.values(observed).every(item => item === value);
const deadPid = () => { for (let pid = 999_999; pid > 900_000; pid -= 1) { try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') return pid; } } return 999_999; };
const marker = folder => { try { return JSON.parse(readFileSync(join(folder, '.conquistador-owned.json'), 'utf8')); } catch { return null; } };
// A file an earlier failed step did not write reads as null, so its checks fail instead of the run.
const readText = path => { try { return readFileSync(path, 'utf8'); } catch { return null; } };
// Explicit target and approval keep the terminal install-only checks noninteractive.
// macOS has BSD script, Linux has util-linux script, and Windows has neither.
const tty = (cli, args, box) => (process.platform === 'darwin'
  ? run('script', ['-q', '/dev/null', cli, ...args], { env: box.env, cwd: join(box.home, 'acme') })
  : run('script', ['-q', '-e', '-c', [cli, ...args].map(value => `'${value.replace(/'/g, `'\\''`)}'`).join(' '), '/dev/null'], { env: box.env, cwd: join(box.home, 'acme') }));
const hasTty = !windows && Boolean(which('script'));

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
// npm puts global commands in PREFIX/bin and packages in PREFIX/lib/node_modules, except on
// Windows: PREFIX\\conquistador.cmd and PREFIX\\node_modules.
const prefixBin = windows ? prefix : join(prefix, 'bin');
const a = isolated('home-a', prefixBin);
const cli = windows ? join(prefix, 'conquistador.cmd') : join(prefix, 'bin', 'conquistador');
const install = run('npm', ['install', '--global', '--ignore-scripts', '--install-links', '--prefix', prefix, '--cache', join(work, 'npm-cache-a'), `git+${pathToFileURL(root).href}#${sha}`], { env: a.env });
// On failure, the npm debug log holds the underlying Git or file error.
const npmLog = /A complete log of this run can be found in: (\S+\.log)/.exec(install.output)?.[1];
const npmErrors = npmLog && existsSync(npmLog) ? readFileSync(npmLog, 'utf8').split('\n').slice(-30).join(' | ') : '';
// npm hides Git's own message, so run the same Git command again and keep its output.
const gitProbe = install.status === 0 ? '' : run('git', ['--no-replace-objects', 'ls-remote', pathToFileURL(root).href], { env: a.env }).output.trim().slice(-600);
check('A0', `npm install -g from Git (${Math.round(install.ms / 1000)} s)`, install.status === 0 && existsSync(cli), `${install.output.trim().split('\n').slice(-3).join(' ')} ${npmErrors} git: ${gitProbe}`);
const packageDir = join(prefix, ...(windows ? [] : ['lib']), 'node_modules', '@forsvn', 'conquistador');
check('A0', 'the installed package lives under node_modules', /[\\/]node_modules[\\/]/.test(packageDir) && existsSync(join(packageDir, 'package.json')));
check('A0', `the installed CLI reports ${version}`, run(cli, ['--version'], { env: a.env }).output.trim() === version);
const agents = JSON.parse(run(cli, ['agents', '--json'], { env: a.env }).stdout || '{"agents":[]}').agents.filter(agent => agent.found).map(agent => agent.id);
check('A0', `agents found: ${agents.join(', ') || 'none'}`, agents.length > 0);

let result = run(cli, ['add', '--all', '--yes'], { env: a.env });
let seen = observe(a, agents);

check('I1', 'add --all --yes from the npm package installs every agent', result.status === 0 && all(seen, true), JSON.stringify(seen));
check('I1', 'the stable plugin copy is complete', missing(a.plugin).length === 0, missing(a.plugin).join(', '));
check('I1', 'the Cursor copy is complete', missing(a.cursor).length === 0, missing(a.cursor).join(', '));

result = run(cli, ['add', '--all', '--yes'], { env: a.env });
seen = observe(a, agents);

check('A1', 'add --all --yes again is idempotent', result.status === 0 && all(seen, true), JSON.stringify(seen));

const pid = deadPid();
const stale = [`${a.cursor}.tmp-${pid}`, `${a.plugin}.old-${pid}`];
for (const folder of stale) { mkdirSync(folder, { recursive: true }); writeFileSync(join(folder, 'partial.txt'), 'left by a crash\n'); }
result = run(cli, ['update'], { env: a.env });
check('I4', 'update removes folders a crashed run left behind', result.status === 0 && stale.every(folder => !existsSync(folder)), stale.filter(existsSync).join(', '));

rmSync(join(a.plugin, 'mcp', 'server.mjs'), { force: true });
if (hasTty) {
  result = tty(cli, ['--in', 'cursor', '--no-open', '--yes'], a);
  check('I6', 'bare conquistador repairs a broken plugin copy', result.status === 0 && missing(a.plugin).length === 0 && /Installed\./.test(result.output), result.output.trim().split('\n').slice(-4).join(' | '));
} else {
  notRun('I6', 'bare conquistador repairs a broken plugin copy', 'no pseudo-terminal on this platform');
  run(cli, ['add', '--all', '--yes'], { env: a.env });
}

rmSync(a.cursor, { recursive: true, force: true });
mkdirSync(a.cursor, { recursive: true });
writeFileSync(join(a.cursor, 'notes.txt'), 'mine\n');

result = run(cli, ['add', '--all', '--yes'], { env: a.env });
seen = observe(a, agents.filter(id => id !== 'cursor'));
check('I5', 'a folder Conquistador did not create is left in place', readFileSync(join(a.cursor, 'notes.txt'), 'utf8') === 'mine\n' && readdirSync(a.cursor).length === 1);
check('I3', 'Cursor fails with a reason; the other agents still install', result.status === 1 && /✗ Cursor: .*not created by Conquistador/.test(result.output) && all(seen, true) && !stackTrace(result.output), result.output.trim().split('\n').slice(-3).join(' | '));

result = hasTty ? tty(cli, ['--in', 'cursor', '--no-open', '--yes'], a) : null;
if (!result) notRun('I3', 'the start flow reports Cursor, offers a retry, and still finishes', 'no pseudo-terminal on this platform');
else check('I3', 'the selected-host start reports Cursor failure and offers a retry', result.status === 1 && /Cursor: .*not created by Conquistador/.test(result.output) && /conquistador --providers=cursor --scope=global -y/.test(result.output) && /needs attention/.test(result.output) && !stackTrace(result.output), result.output.trim().split('\n').slice(-5).join(' | '));
rmSync(a.cursor, { recursive: true, force: true });
result = run(cli, ['add', 'cursor', '--yes'], { env: a.env });
check('I3', 'add cursor --yes succeeds after the folder moves', result.status === 0 && missing(a.cursor).length === 0);

const broken = join(work, 'broken', 'node_modules', '@forsvn', 'conquistador');
if (existsSync(packageDir)) cpSync(packageDir, broken, { recursive: true });
rmSync(join(broken, '.codex-plugin', 'plugin.json'), { force: true });
const before = marker(a.plugin);

result = run(process.execPath, [join(broken, 'runtime', 'bin', 'conquistador.js'), 'add', '--all', '--yes'], { env: a.env });
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

// Project scope, skill-format hosts, dry run, hooks, and doctor (D8). Without a terminal, -y installs
// and opens no agent.
const acme = join(a.home, 'acme');
const files = folder => { const found = []; const walk = dir => { let entries = []; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; } for (const entry of entries) { const path = join(dir, entry.name); if (entry.isDirectory()) walk(path); else found.push(path); } }; walk(folder); return found.sort(); };
const skillFiles = folder => files(folder).filter(path => path.endsWith(`${'/'}SKILL.md`) || path.endsWith('\\SKILL.md'));
let snapshot = files(a.home).join('\n');
result = run(cli, ['--dry-run', '--providers=claude,codex,pi,hermes', '--scope=project'], { env: a.env, cwd: acme });
check('D1', '--dry-run prints the plan and the launch, and writes nothing', result.status === 0 && /Plan:/.test(result.output) && /\/conquistador init/.test(result.output) && files(a.home).join('\n') === snapshot, result.output.trim().split('\n').slice(-3).join(' | '));
snapshot = files(a.home).join('\n');
result = run(cli, ['--providers=claude,codex,pi,hermes', '--scope=project'], { env: a.env, cwd: acme });
check('D1', 'without a terminal and without -y, the installer prints the plan, exits 2, and changes nothing', result.status === 2 && /Plan:/.test(result.output) && files(a.home).join('\n') === snapshot);
result = run(cli, ['--providers=claude,codex,pi,hermes', '--scope=project', '-y'], { env: a.env, cwd: acme });
const projectCopies = ['.claude/skills/conquistador', '.agents/skills/conquistador', '.hermes/skills/conquistador'].map(folder => join(acme, folder));
check('P1', 'project scope copies the skill into each host folder, one copy per shared folder', result.status === 0 && projectCopies.every(folder => existsSync(join(folder, 'SKILL.md')) && marker(folder)?.version === version), result.output.trim().split('\n').slice(-4).join(' | '));
check('P1', 'a project copy holds exactly one SKILL.md, so hosts register one skill', projectCopies.every(folder => skillFiles(folder).length === 1), projectCopies.map(folder => skillFiles(folder).length).join(','));
seen = observe(a, agents.filter(id => ['claude-code', 'codex'].includes(id)));
check('P1', 'project scope runs no plugin manager and writes no plugin copy', all(seen, false) && !existsSync(a.plugin), JSON.stringify(seen));
check('P1', 'the next step names /conquistador init for a project without GROWTH.md', /\/conquistador init/.test(result.output), result.output.trim().split('\n').slice(-1)[0]);
let doctor = run(cli, ['doctor', '--json'], { env: a.env, cwd: acme });
let report = (() => { try { return JSON.parse(doctor.stdout); } catch { return { checks: [] }; } })();
check('H1', 'doctor finds no install or hook problem after a project install', doctor.status === 0 && report.checks.filter(item => item.area !== 'project').every(item => item.status === 'ok') && report.checks.some(item => /GROWTH\.md is missing/.test(item.detail)), doctor.stdout.slice(0, 300));
const projectSkill = readText(join(projectCopies[1], 'SKILL.md'));
if (projectSkill !== null) writeFileSync(join(projectCopies[1], 'SKILL.md'), `${projectSkill}\nchanged by hand\n`);
doctor = run(cli, ['doctor'], { env: a.env, cwd: acme });
check('H1', 'doctor reports a changed project copy and names the repair', doctor.status === 1 && /\.agents[\\/]skills[\\/]conquistador is damaged/.test(doctor.output) && /doctor --fix/.test(doctor.output), doctor.output.trim().split('\n').slice(-3).join(' | '));
doctor = run(cli, ['doctor', '--fix'], { env: a.env, cwd: acme });
check('H1', 'doctor --fix repairs it', doctor.status === 0 && /Repaired/.test(doctor.output) && readText(join(projectCopies[1], 'SKILL.md'))?.includes('changed by hand') === false, doctor.output.trim().split('\n').slice(-3).join(' | '));
writeFileSync(join(acme, 'GROWTH.md'), '# Growth\n\n## Goals and metrics\n## Channels\n## Proof and assets\n## Voice\n## Budget and compliance\n## Connected stack\n');
writeFileSync(join(acme, 'PRODUCT.md'), '# Product\n');
mkdirSync(join(acme, '.conquistador'), { recursive: true });
doctor = run(cli, ['doctor', '--json'], { env: a.env, cwd: acme });
report = (() => { try { return JSON.parse(doctor.stdout); } catch { return { checks: [] }; } })();
check('H1', 'doctor reports a .conquistador/ folder that .gitignore does not cover', report.checks.some(item => /\.gitignore has no entry/.test(item.detail)), doctor.stdout.slice(0, 300));
writeFileSync(join(acme, '.gitignore'), '.conquistador/cache/\n');
doctor = run(cli, ['doctor', '--json'], { env: a.env, cwd: acme });
report = (() => { try { return JSON.parse(doctor.stdout); } catch { return { checks: [] }; } })();
check('H1', 'with PRODUCT.md, a complete GROWTH.md, and a .gitignore entry, doctor is clean', doctor.status === 0 && report.checks.every(item => item.status === 'ok'), JSON.stringify(report.checks.filter(item => item.status !== 'ok')));
result = run(cli, ['update', '--dry-run'], { env: a.env, cwd: acme });
check('P2', 'update --dry-run lists the project copies and changes nothing', result.status === 0 && /\.claude[\\/]skills[\\/]conquistador \(project\)/.test(result.output), result.output.trim().split('\n').slice(-3).join(' | '));
result = run(cli, ['remove', '--scope=project'], { env: a.env, cwd: acme });
check('P2', 'remove --scope=project deletes the copies and keeps PRODUCT.md and GROWTH.md', result.status === 0 && projectCopies.every(folder => !existsSync(folder)) && existsSync(join(acme, 'GROWTH.md')) && existsSync(join(acme, 'PRODUCT.md')), result.output.trim().split('\n').slice(-3).join(' | '));

const skillHosts = { gemini: '.gemini/skills', opencode: '.config/opencode/skills', pi: '.agents/skills', hermes: '.hermes/skills', antigravity: '.gemini/antigravity-cli/skills', kiro: '.kiro/skills', vibe: '.vibe/skills' };
result = run(cli, [`--providers=${Object.keys(skillHosts).join(',')}`, '--scope=global', '-y', '--no-hooks'], { env: a.env, cwd: acme });
const globalCopies = Object.values(skillHosts).map(folder => join(a.home, folder, 'conquistador'));
check('G1', 'global scope copies the skill into each skill-format host folder', result.status === 0 && globalCopies.every(folder => existsSync(join(folder, 'SKILL.md')) && skillFiles(folder).length === 1), globalCopies.filter(folder => !existsSync(folder)).join(', ') || result.output.trim().split('\n').slice(-3).join(' | '));
const listing = JSON.parse(run(cli, ['agents', '--json'], { env: a.env, cwd: acme }).stdout || '{"agents":[]}').agents;
check('G1', 'agents --json reports each skill-format host as installed and healthy', Object.keys(skillHosts).every(id => listing.find(item => item.id === id)?.installed && listing.find(item => item.id === id)?.payloadHealthy), JSON.stringify(listing.filter(item => skillHosts[item.id]).map(item => [item.id, item.installed, item.payloadHealthy])));
check('G1', '--no-hooks turns the hooks off in config.json, and doctor reports it', (() => { try { return JSON.parse(readFileSync(join(a.home, '.conquistador', 'config.json'), 'utf8')).hooks === false; } catch { return false; } })() && /Prompt hooks: off/.test(run(cli, ['doctor'], { env: a.env, cwd: acme }).output));
result = run(cli, ['remove'], { env: a.env, cwd: acme });
check('G1', 'remove deletes every global skill copy', result.status === 0 && globalCopies.every(folder => !existsSync(folder)), globalCopies.filter(existsSync).join(', '));

// Route B: npx from a tarball packed from a clean clone, the way npm publish would build it.
const clone = join(work, 'clone');
run('git', ['clone', '--quiet', root, clone]);
run('git', ['-C', clone, 'checkout', '--quiet', sha]);
const pack = run('npm', ['pack', '--json', '--pack-destination', work, '--cache', join(work, 'npm-cache-pack')], { cwd: clone, env: a.env });
let packed = {};
try { packed = JSON.parse(pack.stdout)[0] ?? {}; } catch { /* Checked below. */ }
const tarball = packed.filename ? join(work, packed.filename) : '';
check('B0', `npm pack: ${packed.entryCount ?? '?'} files, ${((packed.size ?? 0) / 1e6).toFixed(1)} MB packed, ${((packed.unpackedSize ?? 0) / 1e6).toFixed(1)} MB unpacked`, pack.status === 0 && existsSync(tarball));
check('B0', 'the tarball has no nested node_modules', (packed.files ?? []).length > 0 && !(packed.files ?? []).some(file => /node_modules[\\/]/.test(file.path)));
const b = isolated('home-b', null);
const npxCache = join(work, 'npx-cache');

result = run('npx', ['--yes', '--cache', npxCache, '--package', tarball, '--', 'conquistador', 'add', '--all', '--yes'], { env: b.env });
seen = observe(b, agents);
check('B1', `npx from the tarball installs every agent (${Math.round(result.ms / 1000)} s)`, result.status === 0 && all(seen, true) && missing(b.plugin).length === 0, JSON.stringify(seen));
check('B1', 'after npx, the next step is /conquistador in the agent, not a missing command', /type \/conquistador in your agent/.test(result.output) && !/Start a task: conquistador/.test(result.output), result.output.trim().split('\n').slice(-2).join(' | '));
check('I12', 'no agent setting points into the npx cache', textBelow(b.home, npxCache) === null, textBelow(b.home, npxCache) ?? '');
rmSync(npxCache, { recursive: true, force: true });
seen = observe(b, agents);
check('I12', 'after the npx cache is deleted, every agent still lists the plugin', all(seen, true), JSON.stringify(seen));
check('I9', 'the MCP server runs from the stable copy with no npm package present', mcpAnswers(b.plugin, b.env));
result = run('npx', ['--yes', '--cache', npxCache, '--package', tarball, '--', 'conquistador', 'remove'], { env: b.env });
seen = observe(b, agents);
check('B2', 'npx remove cleans up', result.status === 0 && all(seen, false), JSON.stringify(seen));

// Route C: every CLI command from the packed tarball, without the repository. Expected exit codes and
// output are what a user gets; a stack trace always fails.
const prefixC = join(work, 'prefix-c');
const c = isolated('home-c', join(prefixC, 'bin'));
const installC = run('npm', ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', prefixC, '--cache', join(work, 'npm-cache-c'), tarball], { env: c.env });
const packedRoot = join(prefixC, ...(windows ? [] : ['lib']), 'node_modules', '@forsvn', 'conquistador');
check('C0', 'npm install -g from the tarball', installC.status === 0 && existsSync(join(packedRoot, 'package.json')), installC.output.trim().split('\n').slice(-2).join(' | '));
const leftOut = ['evals', 'catalog', 'hosts/eve', 'Dockerfile', '.github', 'tools/e2e', 'docs/REVIEW-2026-09-SURFACES.md', 'CONTRIBUTING.md'].filter(path => existsSync(join(packedRoot, path)));
check('C0', 'the package leaves out evals, catalog, Eve, Docker, CI, E2E, and maintainer docs', leftOut.length === 0, leftOut.join(', '));
// Every relative link in the skill tree, and every docs/*.md file it names, must exist in the package.
const unresolved = [];
for (const file of files(join(packedRoot, 'skills')).filter(path => path.endsWith('.md'))) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) continue;
    const path = resolve(dirname(file), decodeURIComponent(target.split('#')[0]));
    if (!path.startsWith(packedRoot) || !existsSync(path)) unresolved.push(`${file.slice(packedRoot.length + 1)} → ${target}`);
  }
  // Conquistador's own docs have uppercase names; lowercase names are sample files in worked examples.
  for (const [, doc] of text.matchAll(/`(docs\/[A-Z][\w.-]*\.md)`/g)) if (!existsSync(join(packedRoot, doc))) unresolved.push(`${file.slice(packedRoot.length + 1)} names ${doc}`);
}
check('C0', 'every relative link and docs/ file named in the skill tree exists in the package', unresolved.length === 0, unresolved.slice(0, 10).join(' || '));
const bins = Object.values(JSON.parse(readFileSync(join(packedRoot, 'package.json'), 'utf8')).bin ?? {});
check('C0', 'every bin path exists in the package', bins.length > 0 && bins.every(path => existsSync(join(packedRoot, path))), bins.join(', '));
const MATRIX = [
  [['--version'], 0, /^\d+\.\d+\.\d+/], [['version'], 0, /^\d+\.\d+\.\d+/], [['help'], 0, /\/conquistador init/], [['help', '--all'], 0, /--providers/],
  [['agents', '--json'], 0, /"agents"/], [['doctor', '--json'], 0, /"checks"/], [['brief', 'write a launch email for our invoicing app'], 0, /conquistador-brief/],
  [['tour'], 0, /Conquistador covers/], [['playbooks', 'list'], 0, /playbook/i], [['bot', '--out', join(c.home, 'bot'), '--no-private'], 0, /SYSTEM-PROMPT|bot/i],
  [['--dry-run', '--providers=claude,pi', '--scope=project'], 0, /Plan:/], [['task', 'onboarding', '--dry-run'], 0, /Dry run/], [['remove', '--dry-run'], 0, /No tracked registrations/],
  [['setup', '--help'], 0, /Usage/], [['project', '--help'], 0, /Conquistador/], [['--skills', '--help'], 0, /Usage/], [['--plugin', '--help'], 0, /Usage/],
  [['--mcp', '--help'], 0, /Usage/], [['--bot', '--help'], 0, /Usage/], [['--advanced', '--help'], 0, /Usage/], [['install', '--help'], 0, /Usage/],
  [['operator', '--help'], 0, /Usage/], [['status', '--help'], 0, /Usage/], [['route', '--prompt', 'write a launch email'], 1, /routing contract/],
  [['hooks', '--help'], 1, /--project/], [['runtime', '--help'], 0, /Conquistador/], [['connections', '--help'], 0, /Executor/], [['integrations', '--help'], 0, /Usage/],
  [['jobs', '--help'], 2, /repository checkout/], [['--providers=nope'], 2, /Unknown agent/], [['--scope=team'], 2, /Unknown scope/],
];
const node22 = process.env.CONQUISTADOR_E2E_NODE22;
for (const [label, node] of [[`Node ${process.versions.node}`, process.execPath], ...(node22 ? [[`Node ${spawnSync(node22, ['--version'], { encoding: 'utf8' }).stdout.trim()}`, node22]] : [])]) {
  const failures = [];
  for (const [args, status, pattern] of MATRIX) {
    const step = run(node, [join(packedRoot, 'runtime', 'bin', 'conquistador.js'), ...args], { env: c.env, cwd: join(c.home, 'acme') });
    if (step.status !== status || !pattern.test(step.output) || stackTrace(step.output)) failures.push(`${args.join(' ')} → exit ${step.status}: ${step.output.trim().split('\n')[0]}`);
  }
  const mcp = spawnSync(node, [join(packedRoot, 'runtime', 'bin', 'conquistador.js'), 'mcp'], { env: c.env, encoding: 'utf8', timeout: 30_000, input: `${[{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } } }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }].map(item => JSON.stringify(item)).join('\n')}\n` });
  if (!(mcp.stdout ?? '').includes('conquistador_brief')) failures.push('mcp: tools/list has no conquistador_brief');
  check('C1', `${label}: all ${MATRIX.length + 1} CLI commands from the tarball behave as documented`, failures.length === 0, failures.join(' || '));
}
if (!node22) notRun('C1', 'Node 22.18: the CLI commands from the tarball', 'set CONQUISTADOR_E2E_NODE22 to a Node 22.18 executable');

// The interactive start flow, against the installed binary instead of the checkout.
if (windows) notRun('S1', 'agent-first.exp against the installed package', 'expect does not run on Windows');
else if (which('expect')) {
  result = run('expect', [join(root, 'tools/e2e/agent-first.exp')], { env: { ...process.env, CONQUISTADOR_E2E_CLI: cli, PATH: [prefixBin, ...toolDirs, dirname(process.execPath), ...systemDirs].join(delimiter) }, cwd: root });
  const passed = (result.output.match(/CHECK PASS/g) ?? []).length, failed = (result.output.match(/CHECK FAIL/g) ?? []).length;
  check('S1', `agent-first.exp against the installed package: ${passed} passed, ${failed} failed`, result.status === 0 && failed === 0 && passed > 0, result.output.trim().split('\n').slice(-3).join(' | '));
} else check('S1', 'agent-first.exp (expect is not installed)', false);

report = { schema: 'conquistador.e2e.package-install/v1', at: new Date().toISOString(), version, sha, dirty, node: process.version, platform: `${process.platform}-${process.arch}`, agents, work, package: { files: packed.entryCount, packedBytes: packed.size, unpackedBytes: packed.unpackedSize }, checks, ok: checks.every(item => item.ok !== false) && checks.some(item => item.ok) };
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'commands.log'), log.join('\n'));
const skipped = checks.filter(item => item.ok === null).length;
console.log(`\n${report.ok ? 'PASS' : 'FAIL'} ${checks.filter(item => item.ok).length}/${checks.length - skipped}${skipped ? ` (${skipped} not run)` : ''}: ${join(out, 'report.json')}`);
process.exit(report.ok ? 0 : 1);
