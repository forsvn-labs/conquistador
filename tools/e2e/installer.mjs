// The installer, end to end, in a real pseudo-terminal. Every scenario gets a new HOME, a project
// folder, and fake agent and Executor CLIs on PATH (tools/e2e/fake-agent.mjs, fake-executor.mjs).
// No real agent, no network beyond 127.0.0.1, no model.
//   node tools/e2e/installer.mjs [--only NAME[,NAME]] [--out DIR] [--keep]
// Writes one transcript per screen, screens.html (for screenshots), report.json, and report.md.
// Needs python3 (the PTY bridge). Sandboxes that block /dev/ptmx must run it outside the sandbox.
//
// Failure modes of the full-screen installer (T) and of onboarding v2 that still apply (F1-F30):
//   T1  A first run in a terminal opens the full-screen installer (alternate screen), not line prompts.
//   T2  Every exit (done, cancel, error) restores the normal screen and the cursor, and leaves the
//       summary in scrollback.
//   T3  A cancel before Install (Esc, q, Ctrl-C) changes no file, runs no host command, exits 130.
//   T4  Ctrl-C during the install does not stop a step half way; Ctrl-C after it keeps the installs.
//   T5  No agent found: the screen says so; an empty plan cannot install.
//   T7  No line is wider than the terminal at 60 or 100 columns; no screen is taller than 24 rows.
//   T8  NO_COLOR prints no color; TERM=dumb and --plain get line prompts with no escape codes.
//   T10 A run after the install opens a home screen (installs and actions), not the installer and
//       not a task picker.
//   T11 One failed agent shows a cross and a retry command; the others install; exit 1.
//   T12 A failed check shows the fix; exit 1.
//   T13 The terminal never opens an agent and never asks for a task. The last screen says what to
//       type in each agent (/conquistador init in a project without GROWTH.md).
//   T14 `conquistador "TASK"` prints the task context for an agent: no installer, no agent, no files.
//   T15 Old --in and --no-open flags still parse.
//   T16 Flags answer questions: with --providers, --scope, and --no-hooks the installer opens on Review;
//       with --yes it asks nothing, installs, and closes by itself.
//   T17 Hosted MCP is offered only online with sign-in present; the token shows in the summary.
//   T19 Preflight problems (a stale copy on PATH) show on the first screen.
//   H1-H6 Ctrl-C cancels hosted sign-in during config/device fetch, polling sleep, an in-flight
//       poll, a stalled response body, or token exchange. Completed installs and tokens stay.
//   H7 A stalled sign-in request is bounded even without Ctrl-C.
//   H8 Cancelled sign-in reaches Done, records skipped + retry, verifies prior installs, exits 1,
//       restores the normal screen and cursor, and closes the pending network request.
//   L1 --yes never asks a line-fallback question, including TERM=dumb and an omitted scope.
//   S1 Scroll reaches the final recovery line without exceeding its allocated row count.
//   T20 The complete catalog includes agents not found here. Search reaches an undetected skill
//       agent, preserves selection, and includes it in the review, within a 24-row terminal.
//   C1  All supported agents appear without opening a hidden list. Search keeps selection intact.
//   C2  The home screen has direct controls for skills, MCP, hooks, and a permanent CLI command.
//   C3  An MCP-only install opens the manager on the next run and preserves other servers.
//   C4  A slow plugin manager does not freeze the progress animation.
//   C5  Resizing keeps the selected agent and final review/undo text reachable.
//   C6  npm and Bun CLI installs are explicit, checked, and recover from missing PATH or permissions.
//   C7  Removing one MCP client keeps another app, the agent, and all other server entries.
//   M1  Agent multi-selection is explicit. Space, search, Back, resize, select-all, and clear
//       preserve independent choices; the final install contains exactly the selected agents.
//   M2  Toggling detected agents does not discard an undetected agent selected by the user.
//   M3  MCP clients also use checkboxes and install multiple selected apps without adding another.
//   M4  Wide layouts show selection details; compact layouts keep choices and keys reachable.
//   E2  Executor 2 gets an honest MCP setup handoff. Detection, registration, verification,
//       and removal never invoke removed v1 commands or claim an unverified connection.
//       A process that was not checked is not reported as stopped.
//   E3  Failed or unreadable version detection permits no legacy source operation. Successful
//       version detection reads stderr too; a confirmed v1 retains its supported source path.
//   C8  A copied CLI install command keeps the package manager. An unverified CLI installation
//       creates no install record or home-screen shortcut and preserves a previous record.
//   A1  The app dependency guide is reachable from the manager, fits compact terminals, preserves
//       installs on Back/quit, and prints local npm/Bun commands without adding a dependency itself.
import { spawnSync } from 'node:child_process';
import { runCommand } from '../process-run.mjs';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { session } from './term.mjs';
import { HTML_HEAD, Screen } from './vt.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const out = resolve(option('--out', join(root, 'dist/e2e/installer')));
const only = option('--only', '')?.split(',').filter(Boolean) ?? [];
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const keep = argv.includes('--keep');
const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const dirty = Boolean(spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout.trim());
const sourceHashes = Object.fromEntries(['runtime/bin/conquistador.js', 'tools/agents.mjs', 'tools/installer-tui.mjs', 'tools/onboard.mjs', 'tools/login.mjs',
  'tools/cli-install.mjs', 'tools/installer-operation.mjs', 'tools/process-run.mjs', 'tools/managed-installs.mjs', 'tools/launch.mjs',
  'tools/front-door.mjs', 'tools/doctor.mjs', 'tools/self-update.mjs', 'tools/mcp-apps.mjs', 'tools/executor-source.mjs', 'tools/e2e/fake-executor.mjs', 'tools/vendor/ink.mjs',
  'release/completeness.json', 'release/plugin-completeness.json', 'tools/e2e/installer.mjs']
  .map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));

// --- Local servers: a fake npm registry, a fake hosted MCP endpoint, a hanging server, a closed port.
const listen = handler => new Promise(done => { const server = createServer(handler); server.listen(0, '127.0.0.1', () => done({ server, url: `http://127.0.0.1:${server.address().port}` })); });
const registry = await listen((request, response) => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ name: '@forsvn/conquistador', version: '9.9.9' })); });
const hosted = await listen((request, response) => { response.writeHead(401, { 'content-type': 'application/json' }); response.end('{"error":"unauthorized"}'); });
const hanging = await listen(() => { /* Never answers: the update check must not wait for it. */ });
const closed = await new Promise(done => { const server = createTcpServer(); server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => done(`http://127.0.0.1:${port}`)); }); });

// A stand-in for tools/login.mjs, so the test never signs in to real GitHub. Same contract:
// runLogin({ ui }) resolves to { token, login } or null.
const FAKE_LOGIN = `export async function runLogin({ ui }) {
  if (process.env.FAKE_LOGIN === 'cancel') { ui.log.warn('Sign-in cancelled.'); return null; }
  ui.log.info('Fake GitHub sign-in as octocat.');
  return { token: 'cq_test_token_123', login: 'octocat' };
}
`;

const COMMANDS = { claude: 'claude', codex: 'codex', cursor: 'cursor-agent', copilot: 'copilot', grok: 'grok', gemini: 'gemini', opencode: 'opencode' };
const APP_FOLDERS = {
  'claude-desktop': home => join(home, process.platform === 'darwin' ? 'Library/Application Support/Claude' : '.config/Claude'),
  vscode: home => join(home, process.platform === 'darwin' ? 'Library/Application Support/Code/User' : '.config/Code/User'),
  windsurf: home => join(home, '.codeium/windsurf'),
  zed: home => join(home, '.config/zed'),
  cursor: home => join(home, '.cursor'),
};
const APP_FILES = { 'claude-desktop': 'claude_desktop_config.json', vscode: 'mcp.json', windsurf: 'mcp_config.json', zed: 'settings.json', cursor: 'mcp.json' };
export const appFile = (home, id) => join(APP_FOLDERS[id](home), APP_FILES[id]);

let packageCopy = null;
// The hosted cases need tools/login.mjs. Copy the package once and add the stand-in there.
function packageWithLogin(work) {
  if (packageCopy) return packageCopy;
  packageCopy = join(work, '..', `conquistador-with-login-${process.pid}`);
  cpSync(root, packageCopy, { recursive: true, filter: source => !/[\\/](?:\.git|dist|node_modules)(?:[\\/]|$)/.test(relative(root, source)) || source === root });
  writeFileSync(join(packageCopy, 'tools/login.mjs'), FAKE_LOGIN);
  return packageCopy;
}

function fixture(name, { agents = ['claude', 'codex'], apps = {}, executor = null, growth = false, env: extra = {}, login = false, stale = null, managers = false } = {}) {
  const work = mkdtempSync(join(tmpdir(), `cq-onboarding-${name}-`));
  const home = join(work, 'home'), bin = join(work, 'bin'), project = join(home, 'acme');
  for (const folder of [home, bin, project]) mkdirSync(folder, { recursive: true });
  const shim = (file, body) => { writeFileSync(join(bin, file), `#!/bin/sh\n${body}\n`); chmodSync(join(bin, file), 0o755); };
  shim('node', `exec "${process.execPath}" "$@"`);
  if (managers) for (const name of ['npm', 'bun']) shim(name, `exec "${process.execPath}" "${join(root, 'tools/e2e/fake-package-manager.mjs')}" ${name} "$@"`);
  for (const agent of agents) shim(COMMANDS[agent], `exec "${process.execPath}" "${join(root, 'tools/e2e/fake-agent.mjs')}" ${agent} "$@"`);
  if (executor) shim('executor', `exec "${process.execPath}" "${join(root, 'tools/e2e/fake-executor.mjs')}" "$@"`);
  for (const [id, content] of Object.entries(apps)) {
    mkdirSync(APP_FOLDERS[id](home), { recursive: true });
    if (content !== null) writeFileSync(appFile(home, id), typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  writeFileSync(join(project, 'README.md'), '# Acme Invoices\n\nInvoicing for freelance designers.\n');
  mkdirSync(join(project, '.git'));
  writeFileSync(join(project, '.git/HEAD'), 'ref: refs/heads/main\n');
  if (growth) for (const file of ['PRODUCT.md', 'GROWTH.md']) writeFileSync(join(project, file), `# ${file}\n`);
  let PATH = `${bin}:/usr/bin:/bin`;
  if (stale) {
    // An older global install earlier on PATH: PREFIX/bin/conquistador -> PREFIX/lib/node_modules/@forsvn/conquistador.
    const prefix = join(work, 'stale');
    const pkg = join(prefix, 'lib/node_modules/@forsvn/conquistador');
    mkdirSync(join(pkg, 'runtime/bin'), { recursive: true });
    mkdirSync(join(prefix, 'bin'), { recursive: true });
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@forsvn/conquistador', version: stale }));
    writeFileSync(join(pkg, 'runtime/bin/conquistador.js'), '#!/usr/bin/env node\nconsole.error("Conquistador requires Node 24");\nprocess.exit(1);\n');
    chmodSync(join(pkg, 'runtime/bin/conquistador.js'), 0o755);
    symlinkSync(join(pkg, 'runtime/bin/conquistador.js'), join(prefix, 'bin/conquistador'));
    PATH = `${join(prefix, 'bin')}:${PATH}`;
  }
  const logFile = join(work, 'calls.jsonl');
  const env = {
    // CI=true as on GitHub Actions: Ink turns itself off there unless the installer forces it on.
    PATH, HOME: home, USERPROFILE: home, TERM: 'xterm-256color', LANG: 'en_US.UTF-8', TMPDIR: process.env.TMPDIR ?? tmpdir(), CI: 'true',
    FAKE_AGENT_LOG: logFile, npm_config_registry: `${registry.url}/`, CONQUISTADOR_HOSTED_URL: `${hosted.url}/mcp`,
    ...(managers ? { FAKE_CLI_COMMAND: join(bin, 'conquistador'), FAKE_CLI_VERSION: version } : {}),
    // CONQUISTADOR_EXECUTOR_APP=off: never fall back to a real Executor.app on this machine.
    CONQUISTADOR_PREFILL: 'off', CONQUISTADOR_EXECUTOR_APP: 'off', ...(executor ? { FAKE_EXECUTOR: executor } : {}), ...extra,
  };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  const cli = join(login ? packageWithLogin(work) : root, 'runtime/bin/conquistador.js');
  const IGNORE = /(?:^|[\\/])\.fake-(?:agents|executor)\.json$/;
  return {
    work, home, project, bin, env, cli,
    calls: () => (existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []),
    // Every file under HOME (which holds the project) with a content hash. Fake CLI state is left out.
    tree: () => readdirSync(home, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile() || entry.isSymbolicLink())
      .map(entry => join(entry.parentPath, entry.name)).filter(path => !IGNORE.test(path)).sort()
      .map(path => `${relative(home, path)} ${createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 10)}`),
    term: (args, { columns = 80, rows = 50, env: more = {} } = {}) => session(process.execPath, [cli, ...args], { cwd: project, env: { ...env, ...more }, columns, rows }),
    run: (args, { env: more = {}, cwd = project } = {}) => {
      const result = spawnSync(process.execPath, [cli, ...args], { cwd, env: { ...env, ...more }, encoding: 'utf8', timeout: 60_000 });
      return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    },
    runAsync: (args, { env: more = {}, cwd = project } = {}) => runCommand(process.execPath, [cli, ...args], { cwd, env: { ...env, ...more }, timeout: 60_000 }),
    read: path => { try { return readFileSync(path, 'utf8'); } catch { return null; } },
    json: path => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } },
    cleanup: () => { if (!keep) rmSync(work, { recursive: true, force: true }); },
  };
}

// --- Scenario bookkeeping -------------------------------------------------------------------------
const scenarios = [];
const scenario = (name, covers, body) => scenarios.push({ name, covers, body });
const SGR_COLOR = /\x1b\[([\d;]*)m/g;
const hasColor = raw => [...raw.matchAll(SGR_COLOR)].some(match => match[1].split(';').some(code => /^(?:3\d|4\d|9[0-7]|10[0-7])$/.test(code)));
const has = (text, needle) => text.replace(/[\s│]+/g, '').includes(needle.replace(/\s+/g, ''));
// Lines as a terminal would show them if it never wrapped: render at a huge width.
const tooWide = (raw, width) => { const screen = new Screen(400, 2000); screen.write(raw); return screen.lines({ history: true }).filter(line => [...line].length > width); };
// A launch is any agent call that is not a plugin, version, or MCP list command (fake-agent.mjs).
const launches = f => f.calls().filter(call => !['executor', 'npm', 'bun'].includes(call.name) && !['plugin', '--version', 'mcp'].includes(call.args[0]));

function checker() {
  const problems = [];
  return { problems, expect: (condition, message) => { if (!condition) problems.push(message); } };
}

// --- Driving the full-screen installer --------------------------------------------------------------
// Card titles. Each screen has one; the step bar under the wordmark names all five steps.
const TITLE = { agents: 'Which agents?', options: 'Choose options', review: 'Review the changes', install: 'Installing', done: /Conquistador is ready|Installed with problems/, home: 'Conquistador is installed' };

// Move the cursor (›) to the row that holds the label. Rows depend on the package and the
// fixture, so positions are never fixed.
async function moveTo(s, label) {
  await s.settle(120);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = s.screen.text().split('\n').map(line => line.includes('│') ? line.split('│')[1] : line)
      .filter(line => /[›◆◇]/.test(line) || /\[[ ✓]\]/.test(line) || /‹.*›/.test(line));
    const cursor = rows.findIndex(line => /›\s/.test(line.replace(/‹[^›]*›/g, '')));
    const target = rows.findIndex(line => line.includes(label));
    if (target >= 0 && target === cursor) return;
    await s.press(target >= 0 && target < cursor ? 'up' : 'down');
    await s.settle(80);
  }
  throw Error(`row not found: ${label}\n${s.screen.text()}`);
}
async function toggleRow(s, label) { await moveTo(s, label); await s.press('space'); await s.settle(120); }
// Press Right on an option row until it shows the wanted value.
async function setOption(s, label, value) {
  await moveTo(s, label);
  for (let tries = 0; tries < 4; tries += 1) {
    const line = s.screen.text().split('\n').find(item => item.includes(label)) ?? '';
    if (new RegExp(`‹\\s*${value}\\s*›`).test(line)) return;
    await s.press('right'); await s.settle(120);
  }
  throw Error(`option ${label} never showed ${value}\n${s.screen.text()}`);
}

// The default path: keep the detected agents, set options, review.
async function toReview(s, { snap = true, options = {} } = {}) {
  await s.waitFor(TITLE.agents); if (snap) await s.snap('agents'); await s.press('enter');
  await s.waitFor(TITLE.options);
  for (const [label, value] of Object.entries(options)) await setOption(s, label, value);
  if (snap) await s.snap('options');
  await s.press('enter');

  if (s.screen.text().includes('Which MCP clients?')) { if (snap) await s.snap('mcp-apps'); await s.press('enter'); await s.waitFor(TITLE.options); await s.press('enter'); }
  await s.waitFor(TITLE.review); if (snap) await s.snap('review');
}

// After the install: q exits Done and leaves the summary on the normal screen.
async function finish(s, { snap = true } = {}) {
  await s.waitFor(TITLE.done, { timeout: 60_000 }); if (snap) await s.snap('done');
  await s.press('q');
  await s.waitFor('Summary'); if (snap) await s.snap('summary');
}

// --- T1, T2, T13, F21, F24, F26, F27, F29: the happy path ------------------------------------------
scenario('happy', ['T1', 'T2', 'T13', 'F21', 'F24', 'F26', 'F27', 'F29'], async ({ expect, keepSnaps }) => {
  const f = fixture('happy', { agents: ['claude', 'codex'], executor: 'running',
    apps: { 'claude-desktop': { mcpServers: { other: { command: 'other-server' } } }, vscode: null } });
  try {
    const s = f.term([]);
    await s.waitFor(TITLE.agents);
    await s.snap('welcome');
    const welcome = s.screen.text();
    // T1: the full-screen installer, not line prompts. The wordmark, the step bar, and both agents show.
    for (const text of ['Agents', 'Options', 'Review', 'Install', 'Done', 'Claude Code', 'Codex', 'Nothing changes until you confirm']) expect(has(welcome, text), `welcome screen lacks ${text}`);
    expect(s.raw.includes('\x1b[?1049h'), 'the installer did not open the alternate screen (T1)');
    await toReview(s, { options: { 'MCP clients': 'On', Executor: 'On' } });
    const options = s.snaps.find(item => item.name === 'options').text;

    for (const label of ['Install for', 'Prompt hooks', 'MCP clients', 'Executor', 'Chat bot files', 'Hosted MCP']) expect(has(options, label), `options screen lacks ${label}`);
    // F24: the package ships tools/login.mjs, so Hosted MCP is offered but never on by default.
    expect(/Hosted MCP.*‹\s*Off\s*›/.test(options), 'Hosted MCP is on by default (F24)');
    const review = s.snaps.at(-1).text;
    for (const text of ['Claude Code', 'Codex', 'Claude Desktop', 'VS Code', 'backup', 'Unchanged', 'conquistador remove']) expect(has(review, text), `review lacks ${text}`);
    await s.press('enter');
    await finish(s);
    const code = await s.exit();
    expect(code === 0, `first run exited ${code}`);
    const done = s.snaps.find(item => item.name === 'done').text;
    expect(has(done, 'checks passed') && !done.includes('✗'), 'verify pass missing or failed');
    // T13: the Done screen says what to type in each agent; this project has no GROWTH.md.
    expect(has(done, '/conquistador init'), 'Done screen does not say /conquistador init (T13)');
    // T2: the normal screen is back, the summary stays in scrollback, the cursor shows again.
    expect(s.raw.lastIndexOf('\x1b[?1049l') > s.raw.lastIndexOf('\x1b[?1049h'), 'the alternate screen was not closed (T2)');
    const after = s.screen.text({ history: true });
    expect(!has(after, TITLE.review) && has(after, 'Summary'), 'the installer screens stayed on the normal screen, or no summary (T2)');
    expect(/\x1b\[\?25h/.test(s.raw.slice(s.raw.lastIndexOf('\x1b[?1049l'))), 'the cursor is hidden after exit (T2)');
    const summary = s.snaps.at(-1).text;
    for (const text of ['/conquistador', 'conquistador doctor', 'conquistador update', 'conquistador remove']) expect(has(summary, text), `summary lacks ${text}`);
    // T13: no agent opened.
    expect(!launches(f).length && !has(after, 'OPENED WITH'), `an agent was opened: ${JSON.stringify(launches(f))} (T13)`);
    const calls = f.calls().map(call => `${call.name} ${call.args.join(' ')}`);
    expect(calls.some(call => call.startsWith('claude plugin install conquistador@conquistador')), 'Claude Code plugin not installed');
    expect(calls.some(call => call.startsWith('codex plugin add conquistador@conquistador')), 'Codex plugin not installed');
    expect(calls.some(call => call.startsWith('executor call executor mcp addServer')) && calls.some(call => /^executor resume .*--action accept/.test(call)), 'Executor source not added');
    const desktop = f.json(appFile(f.home, 'claude-desktop'));
    expect(desktop?.mcpServers?.other?.command === 'other-server', 'Claude Desktop lost its other server (F21)');
    expect(desktop?.mcpServers?.conquistador?.args?.[0]?.endsWith(join('plugin', 'mcp', 'server.mjs')), 'Claude Desktop entry missing');
    expect(readdirSync(dirname(appFile(f.home, 'claude-desktop'))).some(file => file.includes('conquistador-backup')), 'no backup of the Claude Desktop config (F21)');
    expect(f.json(appFile(f.home, 'vscode'))?.servers?.conquistador?.type === 'stdio', 'VS Code entry missing');

    // T10, F29: a second run opens the home screen, not the installer and not a task picker.
    const again = f.term([]);
    await again.waitFor(TITLE.home);
    await again.snap('home');
    const home = again.screen.text();
    expect(!has(home, TITLE.agents) && !has(home, 'What should we work on'), 'second run showed the installer or a task picker (T10, F29)');
    for (const text of ['Claude Code', 'Codex', 'Add or change agents', 'Update', 'Check and repair', 'Remove', 'Quit', '/conquistador']) expect(has(home, text), `home screen lacks ${text} (T10)`);
    await moveTo(again, 'Quit'); await again.press('enter');
    expect(await again.exit() === 0, 'Quit on the home screen did not exit 0 (T10)');
    expect(!launches(f).length, 'the home screen opened an agent (T10)');
    keepSnaps(again.snaps);

    const doctor = f.run(['doctor']);
    expect(doctor.status === 0 && has(doctor.stdout, 'Claude Desktop'), `doctor after install: exit ${doctor.status}\n${doctor.stdout}`);

    // F26: remove undoes the MCP entries and the Executor source; other servers stay.
    const removed = f.run(['remove']);
    expect(removed.status === 0, `remove exited ${removed.status}: ${removed.stdout}${removed.stderr}`);
    const gone = f.json(appFile(f.home, 'claude-desktop'));
    expect(gone?.mcpServers?.other && !gone.mcpServers.conquistador, 'remove left the Claude Desktop entry or dropped the other server (F26)');
    expect(!f.json(appFile(f.home, 'vscode'))?.servers?.conquistador, 'remove left the VS Code entry (F26)');
    expect(f.calls().some(call => call.name === 'executor' && call.args.join(' ').includes('integrations remove')), 'remove did not remove the Executor source (F26)');
    return [...s.snaps];
  } finally { f.cleanup(); }
});

// --- T14, T15: a task gives the agent context; nothing opens or installs -----------------------------
scenario('task-context', ['T14', 'T15'], async ({ expect, transcript }) => {
  const f = fixture('task-context', { agents: ['claude'] });
  try {
    const before = f.tree();
    const piped = f.run(['Write a welcome email for new trial users']);
    transcript('task-piped', `$ conquistador "Write a welcome email for new trial users"   (exit ${piped.status})\n${piped.stdout}${piped.stderr}`);
    expect(piped.status === 0, `a task without a terminal exited ${piped.status} (T14)`);
    expect(/\.md\b/.test(piped.stdout) && has(piped.stdout, 'playbook'), 'the task did not print a reading list (T14)');
    const s = f.term(['Write a welcome email for new trial users']);
    await s.waitFor('/conquistador Write a welcome email');
    await s.snap('task-tty');
    expect(await s.exit() === 0, 'a task in a terminal did not exit 0 (T14)');
    expect(!s.raw.includes('\x1b[?1049h'), 'a task opened the installer (T14)');
    const legacy = f.run(['--in', 'claude', '--no-open', 'task', 'launch']);
    transcript('task-legacy-flags', `$ conquistador --in claude --no-open task launch   (exit ${legacy.status})\n${legacy.stdout}${legacy.stderr}`);
    expect(legacy.status === 0, `--in and --no-open with a task exited ${legacy.status} (T15)`);
    expect(!f.calls().length, `a task ran an agent command: ${JSON.stringify(f.calls())} (T14)`);
    expect(JSON.stringify(f.tree()) === JSON.stringify(before), 'a task changed files (T14)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- T5, F1: no agent detected ------------------------------------------------------------------------
scenario('agent-catalog', ['C1', 'T20'], async ({ expect }) => {
  const f = fixture('agent-catalog', { agents: ['claude', 'codex'] });
  try {
    const s = f.term([], { rows: 24 });
    await s.waitFor(TITLE.agents);
    await s.snap('agents-catalog');
    const folded = s.screen.text();
    expect(has(folded, 'Claude Code') && has(folded, 'Codex'), 'the found agents are not listed (T20)');
    expect(has(folded, '16 supported agents'), 'the catalog does not state the full support count (C1)');
    expect(!has(folded, 'Add an agent not found'), 'supported agents are still hidden behind a folded row (C1)');
    expect(folded.split('\n').length <= 24, 'the folded agents screen is taller than 24 rows (T20)');
    await s.press('/'); await s.type('qoder'); await s.press('enter');
    await s.settle(200);
    await s.snap('agents-search');
    // The opened list scrolls in 24 rows: walk down until Qoder is on screen.
    expect(has(s.screen.text(), 'Qoder'), 'search did not reveal a supported agent (C1)');
    if (!has(s.screen.text(), 'Qoder')) { await s.press('ctrlC'); await s.exit(); return s.snaps; }
    await moveTo(s, 'Qoder');
    await s.press('space'); await s.settle(120);
    expect(/\[✓\]\s+Qoder/.test(s.screen.text()), 'Qoder could not be chosen after opening the list (T20)');
    await s.press('escape');
    await s.press('enter');
    await s.waitFor(TITLE.options); await s.press('enter');
    await s.waitFor(TITLE.review); await s.snap('review');
    for (let step = 0; step < 12 && !has(s.screen.text(), 'Qoder'); step += 1) { await s.press('down'); await s.settle(80); }
    expect(has(s.screen.text(), 'Qoder'), `the review does not include Qoder (T20)\n${s.screen.text()}`);
    await s.press('escape'); await s.settle(120);
    await s.press('escape'); await s.settle(120);
    await s.press('q');
    const code = await s.exit();
    expect(code === 130, `cancel exited ${code}`);
  } finally { f.cleanup(); }
});

const checked = (s, label) => s.screen.text().split('\n').some(line =>
  line.replace(/^[\s│]+/, '').match(/^(?:›\s+)?\[✓\]\s+(.+)/)?.[1].startsWith(label));

scenario('multi-agents', ['M1', 'M2', 'M4', 'T2'], async ({ expect, transcript }) => {
  const f = fixture('multi-agents', { agents: ['claude', 'codex', 'cursor'], env: { FORCE_COLOR: '3' } });
  const s = f.term([], { columns: 100, rows: 42 });

  try {
    await s.waitFor(TITLE.agents); await s.snap('multi-defaults');
    expect(has(s.screen.text(), 'Select one or more agents'), 'the picker does not disclose multi-selection');
    expect(checked(s, 'Claude Code') && checked(s, 'Codex') && checked(s, 'Cursor'), 'detected agents are not checked independently');
    await s.press('n'); await s.settle(100);
    expect(has(s.screen.text(), '0 selected'), 'clear does not clear every agent');
    await toggleRow(s, 'Claude Code'); await toggleRow(s, 'Codex');
    await s.press('/'); await s.type('qoder'); await s.press('enter'); await s.press('space'); await s.settle(100);
    expect(has(s.screen.text(), '3 selected') && checked(s, 'Qoder'), 'search replaced the previous choices');
    await s.resize(60, 24); await s.snap('multi-compact');
    expect(has(s.screen.text(), '3 selected') && checked(s, 'Qoder') && has(s.screen.text(), 'continue'), 'compact layout loses selections or keys');
    await s.press('escape'); await s.press('a'); await s.settle(100);
    expect(has(s.screen.text(), '4 selected'), 'selecting detected agents discarded the manual choice');
    await s.press('a'); await s.settle(100);
    expect(has(s.screen.text(), '1 selected'), 'clearing detected agents discarded the manual choice');
    await s.press('A'); await s.settle(100);
    expect(has(s.screen.text(), '16 selected'), 'select all does not select the complete catalog');
    await s.press('n'); await s.resize(100, 42);
    await toggleRow(s, 'Claude Code'); await toggleRow(s, 'Codex');
    await s.press('/'); await s.type('qoder'); await s.press('enter'); await s.press('space'); await s.press('escape');
    await s.press('enter'); await s.waitFor(TITLE.options); await setOption(s, 'Install for', 'This project');
    await s.press('escape'); await s.waitFor(TITLE.agents); await s.snap('multi-back');
    expect(has(s.screen.text(), '3 selected') && checked(s, 'Claude Code') && checked(s, 'Codex'), 'Back discarded the independent selections');
    await s.press('enter'); await s.waitFor(TITLE.options); await s.press('enter'); await s.waitFor(TITLE.review); await s.snap('multi-review');
    await s.press('enter'); await finish(s);
    expect(await s.exit() === 0, 'multiple selected agents did not install together');

    for (const folder of ['.claude', '.agents', '.qoder']) expect(existsSync(join(f.project, folder, 'skills/conquistador/SKILL.md')), `selected project skill ${folder} did not install`);
    expect(!has(s.snaps.find(snap => snap.name === 'multi-review').text, 'Cursor:'), 'the review included an unchecked agent');
    expect(!Object.keys(f.json(join(f.home, '.conquistador/installs.json'))?.agents ?? {}).length, 'project selection created a global agent registration');
    expect(has(s.screen.text({ history: true }), 'Qoder'), 'the install summary omitted the manual selection');

    return s.snaps;
  } finally { transcript('terminal-raw', s.raw); s.kill(); await s.exit({ timeout: 1000 }); f.cleanup(); }
});

scenario('multi-mcp-apps', ['M3', 'T2'], async ({ expect, transcript }) => {
  const f = fixture('multi-mcp-apps', { agents: [], apps: { 'claude-desktop': { mcpServers: { other: { command: 'keep-me' } } }, vscode: null }, env: { FORCE_COLOR: '3' } });
  const s = f.term(['--surface=mcp-apps'], { columns: 100, rows: 42 });

  try {
    await s.waitFor('Which MCP clients?'); await s.snap('mcp-defaults');
    expect(has(s.screen.text(), 'Select one or more apps'), 'the MCP picker does not disclose multi-selection');
    await s.press('n'); await s.settle(100);
    expect(has(s.screen.text(), '0 selected'), 'clear does not clear MCP clients');
    await toggleRow(s, 'Claude Desktop'); await toggleRow(s, 'Zed'); await s.snap('mcp-multi-selected');
    expect(has(s.screen.text(), '2 selected') && checked(s, 'Claude Desktop') && checked(s, 'Zed'), 'MCP choices are not independent checkboxes');
    await s.press('enter'); await s.waitFor(/Choose options|Review the changes/);

    if (has(s.screen.text(), TITLE.options)) await s.press('enter');
    await s.waitFor(TITLE.review); await s.snap('mcp-multi-review');
    await s.press('enter'); await finish(s);
    expect(await s.exit() === 0, 'multiple MCP clients did not install together');
    expect(f.json(appFile(f.home, 'claude-desktop'))?.mcpServers?.conquistador && f.json(appFile(f.home, 'zed'))?.context_servers?.conquistador, 'a selected MCP client was omitted');
    expect(f.json(appFile(f.home, 'claude-desktop'))?.mcpServers?.other?.command === 'keep-me', 'multi-selection changed another server');
    expect(!existsSync(appFile(f.home, 'vscode')), 'an unchecked MCP client installed');

    return s.snaps;
  } finally { transcript('terminal-raw', s.raw); s.kill(); await s.exit({ timeout: 1000 }); f.cleanup(); }
});

scenario('picker-layout', ['M4', 'T7', 'T8'], async ({ expect, transcript }) => {
  const f = fixture('picker-layout', { agents: ['claude', 'codex', 'cursor'], env: { FORCE_COLOR: '3' } });
  const s = f.term([], { columns: 120, rows: 44 });

  try {
    await s.waitFor(TITLE.agents); await s.snap('picker-wide');
    expect(has(s.screen.text(), 'Selected agents') && has(s.screen.text(), 'Trae CN'), 'wide picker hides the selection summary or the catalog');
    expect(hasColor(s.raw), 'the rich terminal lost its brand palette');

    for (const [columns, rows] of [[80, 30], [60, 24]]) {
      await s.resize(columns, rows); await s.snap(`picker-${columns}x${rows}`);
      const text = s.screen.text();
      expect(text.split('\n').length <= rows && text.split('\n').every(line => [...line].length <= columns), `picker exceeds ${columns}x${rows}`);
      expect(has(text, '3 selected') && has(text, 'continue'), `picker loses count or keys at ${columns}x${rows}`);
    }

    await s.press('q'); await s.exit();
    expect(f.run(['--providers=claude,codex,cursor', '--yes']).status === 0, 'manager fixture did not install');
    const manager = f.term([], { columns: 120, rows: 44 });

    try {
      await manager.waitFor(TITLE.home); await manager.snap('manager-wide');

      for (const label of ['Add or change agents', 'Installed items', 'Check and repair', 'Remove', 'Quit', '16 supported agents']) expect(has(manager.screen.text(), label), `wide manager hides ${label}`);
      await moveTo(manager, 'Keep the CLI installed'); await manager.snap('manager-cli-focus');
      await manager.resize(60, 24); await manager.snap('manager-compact');
      expect(has(manager.screen.text(), 'Keep the CLI installed') && has(manager.screen.text(), 'enter'), 'compact manager loses focus or keys');
      await manager.press('q'); await manager.exit();

      return [...s.snaps, ...manager.snaps];
    } finally { manager.kill(); await manager.exit({ timeout: 1000 }); }
  } finally { transcript('terminal-raw', s.raw); s.kill(); await s.exit({ timeout: 1000 }); f.cleanup(); }
});

scenario('control-center', ['C2', 'T10'], async ({ expect }) => {
  const f = fixture('control-center', { agents: ['claude'] });
  let s;
  try {
    expect(f.run(['--providers=claude', '--yes']).status === 0, 'fixture install failed');
    s = f.term([], { rows: 40 });
    await s.waitFor(TITLE.home); await s.snap('home');
    const text = s.screen.text();

    for (const label of ['16 supported agents', 'Claude Code', 'Codex', 'Cursor', 'Skills', 'MCP connections', 'Hooks', 'Keep the CLI installed']) expect(has(text, label), `home lacks ${label} (C2)`);
    await s.press('q'); expect(await s.exit() === 0, 'home did not quit');
    return s.snaps;
  } finally { if (s) s.kill(); f.cleanup(); }
});

scenario('app-dependency-guide', ['A1', 'T7'], async ({ expect, transcript }) => {
  const f = fixture('app-dependency-guide', { agents: ['claude'] });
  let s;
  try {
    expect(f.run(['--providers=claude', '--yes']).status === 0, 'fixture install failed');
    const before = JSON.stringify(f.tree());
    const guide = f.run(['app']);
    expect(guide.status === 0 && /npm i @forsvn\/conquistador/.test(guide.stdout) && /bun add @forsvn\/conquistador/.test(guide.stdout), 'CLI guide lacks local dependency commands');
    transcript('cli-guide', guide.stdout);
    s = f.term([], { columns: 60, rows: 24 });
    await s.waitFor(TITLE.home); await moveTo(s, 'Use in an app'); await s.snap('app-menu'); await s.press('enter');
    await s.waitFor('Use in an app'); await s.settle(100); await s.snap('app-guide');
    expect(/npm i @forsvn\/conquistador/.test(s.screen.text()), 'TUI guide lacks the project command');
    await s.press(...Array(24).fill('down')); await s.snap('app-guide-bottom');
    expect(has(s.screen.text(), 'docs/install/app'), 'the guide cannot reach its app documentation');
    expect(s.screen.text().split('\n').length <= 24, 'guide exceeds compact terminal height');
    await s.press('escape'); await s.waitFor(TITLE.home); await s.press('q');
    expect(await s.exit() === 0, 'guide did not quit cleanly');
    expect(JSON.stringify(f.tree()) === before, 'opening the guide changed an install or dependency');
    return s.snaps;
  } finally { if (s) s.kill(); f.cleanup(); }
});

scenario('mcp-only-home', ['C3'], async ({ expect }) => {
  const f = fixture('mcp-only-home', { agents: [], apps: { 'claude-desktop': { mcpServers: { existing: { command: 'keep-me' } } } } });
  let s;
  try {
    expect(f.run(['--surface=mcp-apps', '--apps=claude-desktop', '--yes']).status === 0, 'MCP fixture install failed');
    s = f.term([]); await s.settle(350);
    // Waiting for either title makes the old behavior fail quickly without a 20-second timeout.
    await s.waitFor(/Which agents\?|Conquistador is installed/); await s.snap('mcp-home');
    expect(has(s.screen.text(), TITLE.home), 'MCP-only install opened the first-run installer (C3)');
    expect(has(s.screen.text(), 'Claude Desktop'), 'home hides the installed MCP client (C3)');
    expect(f.json(appFile(f.home, 'claude-desktop'))?.mcpServers?.existing?.command === 'keep-me', 'existing MCP entry changed');
    await s.press('q'); await s.exit(); return s.snaps;
  } finally { if (s) s.kill(); f.cleanup(); }
});

scenario('in-app-management', ['C2', 'C3'], async ({ expect, transcript }) => {
  const f = fixture('in-app-management', { agents: ['claude'], apps: { 'claude-desktop': null } });
  let s;
  try {
    expect(f.run(['--providers=claude', '--yes']).status === 0, 'fixture agent failed to install');
    const config = join(f.home, '.conquistador/config.json');
    writeFileSync(config, '{"hooks":true,"keep":"existing"}\n');
    s = f.term([]); await s.waitFor(TITLE.home);
    await moveTo(s, 'Hooks'); await s.press('enter'); await s.waitFor('Hooks are on'); await s.press('space'); await s.waitFor('Hooks are off'); await s.snap('hooks-off');
    expect(f.json(config)?.hooks === false && f.json(config)?.keep === 'existing', 'hooks toggle lost another setting');
    await s.press('enter'); await moveTo(s, 'Check and repair'); await s.press('enter'); await s.waitFor('Complete. Review the result.'); await s.snap('doctor-report'); await s.press('enter');
    await s.settle(120); expect(has(s.screen.text(), TITLE.home), 'doctor left the TUI');
    await moveTo(s, 'MCP connections'); await s.press('enter'); await s.waitFor('Which MCP clients?');
    await moveTo(s, 'Zed'); await s.press('space'); await s.snap('mcp-app-choice'); await s.press('enter'); await s.waitFor(TITLE.options); await s.press('enter'); await s.waitFor(TITLE.review); await s.press('enter');
    await s.waitFor(TITLE.done); await s.snap('mcp-done'); await s.press('enter'); await s.waitFor(TITLE.home); await s.snap('home-after-mcp');
    expect(f.json(appFile(f.home, 'zed'))?.context_servers?.conquistador, 'an MCP client not detected could not be installed from the TUI');
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.['claude-code'], 'MCP management lost the agent');
    await s.press('q'); await s.exit(); return s.snaps;
  } finally { if (s) { transcript('terminal-raw', s.raw); s.kill(); await s.exit({ timeout: 1000 }); } f.cleanup(); }
});

scenario('resize', ['C5', 'T7'], async ({ expect, transcript }) => {
  const f = fixture('resize', { agents: ['claude'] });
  const s = f.term([], { columns: 100, rows: 42 });
  try {
    await s.waitFor(TITLE.agents); await s.press('/'); await s.type('qoder'); await s.press('enter'); await s.press('space');
    await s.resize(60, 24); await s.snap('agents-60x24');
    expect(/\[✓\]\s+Qoder/.test(s.screen.text()), 'resize lost the chosen agent');
    expect(has(s.screen.text(), 'continue'), 'resize hid the continue key');
    await s.press('escape'); await s.press('enter'); await s.waitFor(TITLE.options); await s.press('enter'); await s.waitFor(TITLE.review);
    for (let i = 0; i < 40; i += 1) await s.press('down'); await s.snap('review-bottom');
    expect(has(s.screen.text(), 'Undo:'), 'resize made the last review line unreachable');
    await s.resize(110, 42); await s.snap('review-110x42');
    expect(has(s.screen.text(), TITLE.review) && has(s.screen.text(), 'Undo:'), 'growing the terminal broke the review');
    await s.press('q'); expect(await s.exit() === 130, 'resize cancellation did not restore the terminal'); return s.snaps;
  } finally { transcript('terminal-raw', s.raw); s.kill(); await s.exit({ timeout: 1000 }); f.cleanup(); }
});

scenario('doctor-release', ['D1'], async ({ expect, transcript }) => {
  const f = fixture('doctor-release', { agents: [] });
  try {
    const result = await f.runAsync(['doctor', '--json']);
    transcript('doctor-release', `${result.stdout}${result.stderr}`);
    const report = JSON.parse(result.stdout);
    expect(report.checks.some(check => check.area === 'release' && check.status === 'warn' && check.detail.includes('9.9.9')), 'doctor does not warn about the newer registry release');
  } finally { f.cleanup(); }
});

scenario('targeted-removal', ['C7'], async ({ expect, transcript }) => {
  const f = fixture('targeted-removal', { agents: ['claude'], apps: { 'claude-desktop': { mcpServers: { existing: { command: 'keep-me' } } }, zed: null } });
  let s;
  try {
    expect(f.run(['--surface=agents,mcp-apps', '--providers=claude', '--apps=claude-desktop,zed', '--yes']).status === 0, 'fixture installation failed');
    s = f.term([]); await s.waitFor(TITLE.home); await moveTo(s, 'Installed items'); await s.press('enter'); await s.waitFor('Installed items');
    await moveTo(s, 'Claude Desktop'); await s.press('enter'); await s.waitFor('Install details'); await s.press('r'); await s.waitFor('Remove Conquistador?'); await s.snap('targeted-remove-review');
    await s.press('enter'); expect(f.json(appFile(f.home, 'claude-desktop'))?.mcpServers?.conquistador, 'Enter removed the app without choosing y');
    await s.press('y'); await s.waitFor('Complete. Review the result.'); await s.snap('targeted-remove-result'); await s.press('enter'); await s.settle(120);
    const state = f.json(join(f.home, '.conquistador/installs.json'));
    expect(!state?.mcpApps?.['claude-desktop'] && state?.mcpApps?.zed && state?.agents?.['claude-code'], 'targeted removal changed another install');
    expect(f.json(appFile(f.home, 'claude-desktop'))?.mcpServers?.existing?.command === 'keep-me', 'targeted removal changed another server');
    await s.press('q'); await s.exit(); return s.snaps;
  } finally { if (s) { transcript('terminal-raw', s.raw); s.kill(); await s.exit({ timeout: 1000 }); } f.cleanup(); }
});

scenario('live-progress', ['C4'], async ({ expect, transcript }) => {
  const f = fixture('live-progress', { agents: ['claude'], env: { FAKE_AGENT_DELAY: '1800' } });
  const s = f.term(['--providers=claude', '--scope=global', '--no-hooks']);
  try {
    await s.waitFor(TITLE.review); await s.press('enter');
    for (let i = 0; i < 80 && !f.calls().some(call => call.args[0] === 'plugin' && call.args[1] === 'install'); i += 1) await new Promise(done => setTimeout(done, 50));
    const at = s.raw.length;
    await new Promise(done => setTimeout(done, 500));
    const frames = s.raw.slice(at);
    expect(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(frames), 'the spinner froze during a plugin install (C4)');
    transcript('animation-during-plugin', frames);
    await finish(s); expect(await s.exit() === 0, 'slow install did not complete'); return s.snaps;
  } finally { s.kill(); await s.exit({ timeout: 1000 }); f.cleanup(); }
});

for (const manager of ['npm', 'bun']) scenario(`cli-${manager}`, ['C6'], async ({ expect, transcript }) => {
  const f = fixture(`cli-${manager}`, { agents: [], managers: true });
  try {
    const preview = f.run(['--surface=cli', `--package-manager=${manager}`, '--dry-run']);
    expect(preview.status === 0 && has(preview.stdout, manager), 'CLI preview did not name the package manager');
    expect(!f.calls().some(call => ['install', 'add'].includes(call.args[0])), 'dry run installed a package');
    const printed = preview.stdout.split('To install:')[1]?.split('No files changed')[0]?.trim().split(/\s+/) ?? [];
    expect(printed.includes(`--package-manager=${manager}`), 'the copied install command loses the package manager');
    const result = f.run(printed.slice(printed.findIndex(arg => arg.startsWith('--'))));
    transcript('install-cli', `${result.stdout}${result.stderr}`);
    expect(result.status === 0, `CLI install exited ${result.status}`);
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.cli?.manager === manager, 'CLI manager was not recorded');
    expect(!f.calls().some(call => call.name === 'claude'), 'CLI-only install changed an agent');
  } finally { f.cleanup(); }
});

for (const failure of ['FAIL', 'NO_COMMAND']) scenario(`cli-recovery-${failure.toLowerCase()}`, ['C6'], async ({ expect, transcript }) => {
  const f = fixture(`cli-recovery-${failure}`, { agents: [], managers: true, env: { [`FAKE_CLI_${failure}`]: '1' } });
  let s;
  try {
    const result = f.run(['--surface=cli', '--package-manager=npm', '--yes']);
    transcript('cli-recovery', `${result.stdout}${result.stderr}`);
    expect(result.status === 1, `CLI failure returned ${result.status}`);
    expect(has(result.stdout, 'Retry:') || has(result.stdout, 'PATH'), 'CLI failure has no recovery command');
    expect(!f.json(join(f.home, '.conquistador/installs.json'))?.cli, 'an unverified CLI was recorded as an install');
    s = f.term([]);
    await s.waitFor(TITLE.agents, { timeout: 5000 });
    await s.snap('first-use-after-failure');
    await s.press('ctrlC');
    expect(await s.exit() === 130, 'first-use installation did not cancel cleanly');

    if (failure === 'NO_COMMAND') {
      const prior = { manager: 'bun', version: '0.4.0', path: join(f.bin, 'previous-cli'), verified: true, at: '2026-10-01T00:00:00Z' };
      mkdirSync(join(f.home, '.conquistador'), { recursive: true });
      writeFileSync(join(f.home, '.conquistador/installs.json'), JSON.stringify({ agents: {}, cli: prior }));
      const retry = f.run(['--surface=cli', '--package-manager=npm', '--yes']);
      expect(retry.status === 1 && JSON.stringify(f.json(join(f.home, '.conquistador/installs.json'))?.cli) === JSON.stringify(prior), 'an unverified replacement overwrote the previous CLI record');
    }

    return s.snaps;
  } finally {
    if (s) { s.kill(); await s.exit({ timeout: 1000 }); }

    f.cleanup();
  }
});

scenario('no-agent', ['T5', 'F1'], async ({ expect }) => {
  const f = fixture('no-agent', { agents: [] });
  try {
    const s = f.term([]);
    await s.waitFor(TITLE.agents);
    await s.snap('agents-none');
    expect(has(s.screen.text(), 'No coding agent found'), 'agents screen does not say no agent was found');
    // T5: nothing chosen, so the review has nothing to do until a surface is on.
    await s.press('enter');
    await s.waitFor(TITLE.options);
    await setOption(s, 'Chat bot files', 'On');
    await s.snap('options-bot');
    await s.press('enter');
    await s.waitFor(TITLE.review); await s.snap('review'); await s.press('enter');
    await finish(s);
    const code = await s.exit();
    expect(code === 0, `exit ${code}`);
    expect(existsSync(join(f.project, 'conquistador-bot', 'SYSTEM-PROMPT.md')), 'bot files missing');
    expect(f.calls().length === 0, 'an agent command ran');
    const empty = fixture('no-agent-empty', { agents: [] });
    try {
      const e = empty.term([]);
      await e.waitFor(TITLE.agents); await e.press('enter');
      await e.waitFor(TITLE.options); await e.press('enter');
      await e.waitFor('Nothing to install'); await e.snap('review-empty');
      await e.press('escape'); await e.waitFor(TITLE.options); await e.press('escape'); await e.waitFor(TITLE.agents); await e.press('escape');
      await e.waitFor('Cancelled. No files changed.');
      expect(await e.exit() === 130, 'an empty plan did not cancel cleanly (T5)');
      return [...s.snaps, ...e.snaps];
    } finally { empty.cleanup(); }
  } finally { f.cleanup(); }
});

// --- F2: only skill-only agents -------------------------------------------------------------------
scenario('skill-only', ['F2'], async ({ expect }) => {
  const f = fixture('skill-only', { agents: ['gemini', 'opencode'] });
  try {
    const s = f.term([]);
    await toReview(s);
    expect(!has(s.snaps.find(item => item.name === 'options').text, 'Prompt hooks'), 'hooks option shown with no plugin agent');
    await s.press('enter');
    await finish(s);
    const code = await s.exit();
    expect(code === 0, `exit ${code}`);
    expect(existsSync(join(f.home, '.gemini/skills/conquistador/SKILL.md')), 'Gemini CLI skill copy missing');
    expect(existsSync(join(f.home, '.config/opencode/skills/conquistador/SKILL.md')), 'OpenCode skill copy missing');
    expect(!f.calls().some(call => call.args[0] === 'plugin'), 'a plugin command ran for a skill-only agent');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- T11, F3, F7, F20: one agent fails, one app cannot be edited, the rest installs ----------------
scenario('half-fail', ['T11', 'F3', 'F7', 'F20'], async ({ expect }) => {
  const zed = '{\n  // My Zed settings\n  "theme": "One Dark"\n}\n';
  const f = fixture('half-fail', { agents: ['claude', 'codex'], env: { FAKE_AGENT_FAIL: 'codex' },
    apps: { 'claude-desktop': null, zed } });
  try {
    const s = f.term([]);
    await toReview(s, { options: { 'MCP clients': 'On' } });
    expect(has(s.snaps.at(-1).text, 'by hand'), 'review does not say the Zed entry is manual (F20)');
    await s.press('enter');
    await finish(s);
    const code = await s.exit();
    expect(code === 1, `exit ${code}; a failed surface must exit 1 (F7)`);
    const done = s.snaps.find(item => item.name === 'done').text;
    expect(done.includes('✗') && has(done, 'Codex'), 'Done screen does not show the Codex failure (T11)');
    const summary = s.snaps.at(-1).text;
    expect(has(summary, 'Codex') && has(summary, 'conquistador --providers=codex'), 'summary lacks the Codex failure and retry (F3)');
    expect(has(summary, 'Claude Desktop'), 'summary lacks the app that worked (F7)');
    expect(f.read(appFile(f.home, 'zed')) === zed, 'Zed settings changed (F20)');
    expect(f.json(appFile(f.home, 'claude-desktop'))?.mcpServers?.conquistador, 'Claude Desktop entry missing after a sibling failed (F7)');
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.['claude-code'], 'Claude Code not recorded after Codex failed (F7)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F4: plugin and MCP chosen for the same app ---------------------------------------------------
scenario('dedupe', ['F4'], async ({ expect }) => {
  const f = fixture('dedupe', { agents: ['claude'], apps: { cursor: null, 'claude-desktop': null } });
  try {
    const s = f.term([]);
    await toReview(s, { options: { 'MCP clients': 'On' } });
    const options = s.snaps.find(item => item.name === 'options').text;
    expect(has(options, 'Cursor gets the plugin') || !has(options, 'Cursor'), 'options screen offers Cursor as an MCP client next to its plugin (F4)');
    const review = s.snaps.at(-1).text;
    expect(!/Cursor\s+add/.test(review) && !has(review, '.cursor/mcp.json'), 'review plans an MCP entry for Cursor (F4)');
    await s.press('enter');
    await finish(s);
    await s.exit();
    expect(!existsSync(appFile(f.home, 'cursor')), 'Cursor MCP config was written (F4)');
    const plan = JSON.parse(f.run(['--json', '--surface=agents,mcp-apps', '--providers=cursor', '--apps=cursor,claude-desktop']).stdout);
    const steps = plan.surfaces.find(item => item.id === 'mcp-apps').steps;
    expect(!steps.some(step => step.app === 'cursor' && step.action !== 'skip'), 'JSON plan configures Cursor twice (F4)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F5: global and project install both present --------------------------------------------------
scenario('both-scopes', ['F5'], async ({ expect }) => {
  const f = fixture('both-scopes', { agents: ['claude'] });
  try {
    expect(f.run(['--providers=claude', '--scope=project', '--yes']).status === 0, 'project install failed');
    const second = f.run(['--providers=claude', '--scope=global', '--yes']);
    expect(second.status === 0, `global install exited ${second.status}`);
    expect(has(second.stdout, 'loads both'), `install summary does not warn about two copies (F5):\n${second.stdout}`);
    const doctor = f.run(['doctor']);
    expect(has(doctor.stdout, 'loads both') && has(doctor.stdout, 'conquistador remove --scope=project'), `doctor does not warn about two copies (F5):\n${doctor.stdout}`);
    const s = f.term(['add']);
    // The default scope stays project, because this project already has a copy.
    await toReview(s);
    expect(/Install for.*‹\s*This project\s*›/.test(s.snaps.find(item => item.name === 'options').text), 'default scope is not project when a project copy exists (F5)');
    expect(has(s.screen.text(), 'loads both'), 'review does not warn about two copies (F5)');
    await s.press('q');
    await s.waitFor('Cancelled. No files changed.');
    await s.exit();
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F6: an older version is installed ------------------------------------------------------------
scenario('update', ['F6'], async ({ expect }) => {
  const f = fixture('update', { agents: ['claude'] });
  try {
    expect(f.run(['--providers=claude', '--yes']).status === 0, 'first install failed');
    const stateFile = join(f.home, '.conquistador/installs.json');
    const state = f.json(stateFile);
    state.agents['claude-code'].version = '0.2.0';
    writeFileSync(stateFile, JSON.stringify(state));
    const owned = join(f.home, '.conquistador/plugin/.conquistador-owned.json');
    writeFileSync(owned, JSON.stringify({ ...f.json(owned), version: '0.2.0' }));
    const plan = f.run(['--surface=agents', '--providers=claude', '--dry-run']);
    expect(has(plan.stdout, 'update') && has(plan.stdout, '0.2.0'), `plan does not say update from 0.2.0 (F6):\n${plan.stdout}`);
    const s = f.term(['add']);
    await toReview(s);
    expect(has(s.screen.text(), '0.2.0'), 'review does not say update from 0.2.0 (F6)');
    await s.press('enter');
    await finish(s);
    const code = await s.exit();
    expect(code === 0, `update exit ${code}`);
    expect(f.calls().some(call => call.name === 'claude' && call.args.join(' ') === 'plugin update conquistador@conquistador'), 'host update command did not run (F6)');
    expect(f.json(stateFile)?.agents?.['claude-code']?.version === version, 'state still records the old version (F6)');
    expect(f.json(owned)?.version === version, 'plugin copy not refreshed (F6)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- T12, T16, F8: flags answer the questions; the verify pass finds a problem ----------------------
scenario('verify-problem', ['T12', 'T16', 'F8'], async ({ expect }) => {
  const f = fixture('verify-problem', { agents: ['claude'], env: { FAKE_AGENT_NOREG: 'claude' } });
  try {
    const s = f.term(['--providers=claude', '--scope=global', '--no-hooks']);
    // T16: every question has a flag, so the installer opens on the review.
    await s.waitFor(TITLE.review); await s.snap('review');
    expect(!has(s.screen.text({ history: true }), TITLE.agents), 'flags did not skip the agents screen (T16)');
    expect(has(s.screen.text(), 'hooks off'), 'review does not show hooks off from --no-hooks (T16)');
    await s.press('enter');
    await finish(s);
    const code = await s.exit();
    expect(code === 1, `exit ${code}`);
    const text = s.screen.text({ history: true });
    expect(has(text, 'not registered') && has(text, 'conquistador doctor --fix'), 'verify line lacks the problem or the fix (F8)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- T16: --yes answers every question, even without --scope, and closes by itself ------------------
scenario('yes', ['T16'], async ({ expect }) => {
  const f = fixture('yes', { agents: ['claude'] });
  try {
    // No keys are pressed: a screen that waits for input fails this scenario on the timeout.
    const s = f.term(['--in', 'claude', '--no-open', '--yes']);
    await s.waitFor('Summary', { timeout: 60_000 }); await s.snap('summary');
    const code = await s.exit();
    expect(code === 0, `exit ${code}`);
    const seen = s.raw;
    expect(!seen.includes(TITLE.options) && !seen.includes(TITLE.agents) && !seen.includes(TITLE.review), '--yes showed a question screen (T16)');
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.['claude-code'], '--yes did not install');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- T3, F9: cancel at each screen leaves no files -------------------------------------------------
const CANCEL_STEPS = [
  ['agents', TITLE.agents, 'ctrlC'],
  ['agents-escape', TITLE.agents, 'escape'],
  ['options', TITLE.options, 'ctrlC'],
  ['options-q', TITLE.options, 'q'],
  ['review', TITLE.review, 'ctrlC'],
  ['review-q', TITLE.review, 'q'],
];
for (const [step, title, key] of CANCEL_STEPS) {
  scenario(`cancel-${step}`, ['T3', 'F9'], async ({ expect }) => {
    const f = fixture(`cancel-${step}`, { agents: ['claude'], executor: 'running', apps: { 'claude-desktop': { mcpServers: {} } } });
    try {
      const before = f.tree();
      const s = f.term([]);
      for (const screen of [TITLE.agents, TITLE.options, TITLE.review]) {
        await s.waitFor(screen);
        if (screen === title) break;
        await s.press('enter');
      }
      await s.press(key);
      await s.waitFor('Cancelled. No files changed.');
      await s.snap(`cancelled-at-${step}`);
      const code = await s.exit();
      expect(code === 130, `exit ${code}`);
      expect(s.raw.lastIndexOf('\x1b[?1049l') > s.raw.lastIndexOf('\x1b[?1049h'), 'cancel left the alternate screen open (T2)');
      expect(JSON.stringify(f.tree()) === JSON.stringify(before), `files changed after cancel at ${step}:\n${f.tree().filter(line => !before.includes(line)).join('\n')}`);
      expect(!f.calls().some(call => call.args[0] === 'plugin' && !/list/.test(call.args[1])) && !f.calls().some(call => call.name === 'executor' && /call|resume|daemon run/.test(call.args.join(' '))), 'a host command ran before confirm');
      return s.snaps;
    } finally { f.cleanup(); }
  });
}

// --- T4, F28: Ctrl-C during and after the install keeps the installs ---------------------------------
scenario('cancel-after-install', ['T4', 'F28'], async ({ expect }) => {
  const f = fixture('cancel-after-install', { agents: ['claude'] });
  try {
    const s = f.term(['--providers=claude', '--scope=global']);
    await s.waitFor(TITLE.review); await s.press('enter');
    // T4: Ctrl-C while installing does not stop a step half way.
    await s.press('ctrlC');
    await s.waitFor(TITLE.done, { timeout: 60_000 }); await s.snap('done');
    await s.press('ctrlC');
    await s.waitFor('Summary'); await s.snap('summary-after-ctrl-c');
    const code = await s.exit();
    expect(code === 0, `exit ${code}; Ctrl-C after a good install is not a failure`);
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.['claude-code'], 'install was undone by a later Ctrl-C');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F10, F11, F12: no terminal, dry run, JSON plan ------------------------------------------------
scenario('non-tty', ['F10', 'F11', 'F12'], async ({ expect, transcript }) => {
  const f = fixture('non-tty', { agents: ['claude', 'codex'], executor: 'running', apps: { 'claude-desktop': { mcpServers: {} } } });
  try {
    const before = f.tree();
    const plan = f.run(['--surface=agents,mcp-apps,executor,bot']);
    transcript('no-tty-no-yes', `$ conquistador --surface=agents,mcp-apps,executor,bot   (exit ${plan.status})\n${plan.stdout}${plan.stderr}`);
    expect(plan.status === 2, `no TTY and no --yes exited ${plan.status} (F10)`);
    expect(has(plan.stdout, 'Claude Desktop') && has(plan.stdout, '--yes'), 'plan output lacks the plan or the --yes hint (F10)');
    const dry = f.run(['--surface=agents,mcp-apps,executor,bot', '--dry-run']);
    transcript('dry-run', `$ conquistador --surface=agents,mcp-apps,executor,bot --dry-run   (exit ${dry.status})\n${dry.stdout}${dry.stderr}`);
    expect(dry.status === 0, `--dry-run exited ${dry.status} (F11)`);
    const tty = f.term(['--dry-run']);
    await tty.waitFor('No files changed'); await tty.snap('tty-dry-run');
    expect(await tty.exit() === 0, 'TTY --dry-run did not exit 0 (F11)');
    const args = ['--json', '--surface=agents,mcp-apps,executor,bot', '--providers=claude,codex', '--apps=claude-desktop'];
    const first = f.run(args), second = f.run(args);
    transcript('json', `$ conquistador ${args.join(' ')}   (exit ${first.status})\n${first.stdout}`);
    let parsed = null;
    try { parsed = JSON.parse(first.stdout); } catch { /* Checked below. */ }
    expect(parsed?.schema === 'conquistador.onboarding-plan/v1', 'JSON plan has no schema (F12)');
    expect(first.stdout === second.stdout, 'JSON plan differs between two runs (F12)');
    expect(JSON.stringify(parsed?.surfaces?.map(item => item.id)) === '["agents","mcp-apps","executor","bot"]', 'JSON plan surfaces wrong (F12)');
    expect(JSON.stringify(f.tree()) === JSON.stringify(before), 'a preview changed files (F10, F11, F12)');
    // Previews may ask Executor for its version and status (read-only); nothing else runs.
    const ran = f.calls().filter(call => !(call.name === 'executor' && ['--version', 'daemon status'].includes(call.args.join(' '))));
    expect(ran.length === 0, `a preview ran a host command: ${JSON.stringify(ran)}`);
    return tty.snaps;
  } finally { f.cleanup(); }
});

// --- T7, F13: 60 and 100 columns, 24 rows; F14: NO_COLOR -----------------------------------------------
for (const [name, columns, rows] of [['narrow', 60, 24], ['wide', 100, 30]]) {
  scenario(name, ['T7', 'F13'], async ({ expect }) => {
    const f = fixture(name, { agents: ['claude', 'codex', 'gemini', 'opencode'], executor: 'running', apps: { 'claude-desktop': { mcpServers: {} } } });
    try {
      const s = f.term([], { columns, rows });
      await toReview(s, { options: { 'MCP clients': 'On', Executor: 'On' } });
      await s.press('enter');
      await finish(s);
      await s.exit();
      const wide = tooWide(s.raw, columns);
      expect(!wide.length, `lines wider than ${columns} columns (T7, F13):\n${wide.join('\n')}`);
      for (const snap of s.snaps.filter(item => item.name !== 'summary')) expect(snap.text.split('\n').length <= rows + 1, `${snap.name} has more lines than the terminal (T7)`);
      return s.snaps;
    } finally { f.cleanup(); }
  });
}

scenario('no-color', ['T8', 'F14'], async ({ expect }) => {
  const f = fixture('no-color', { agents: ['claude'] });
  try {
    const s = f.term([], { env: { NO_COLOR: '1' } });
    await toReview(s);
    await s.press('ctrlC');
    await s.exit();
    expect(!hasColor(s.raw), 'color codes printed with NO_COLOR=1 (F14)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- T8, F25: TERM=dumb gets line prompts and never asks for a task ---------------------------------
scenario('plain', ['T8', 'T13', 'F25'], async ({ expect }) => {
  const f = fixture('plain', { agents: ['claude'] });
  try {
    const s = f.term([], { env: { TERM: 'dumb' } });
    await s.waitFor('Where do you want Conquistador?'); await s.snap('plain-surfaces'); await s.press('enter');
    await s.waitFor('Which agents?'); await s.press('enter');
    await s.waitFor('or only this one?'); await s.press('enter');
    await s.waitFor('Turn on prompt hooks?'); await s.press('enter');
    await s.waitFor('Install now?'); await s.snap('plain-review'); await s.press('enter');
    await s.waitFor('Summary'); await s.snap('plain-summary');
    const code = await s.exit();
    expect(code === 0, `exit ${code}`);
    expect(!/\x1b/.test(s.raw), 'escape codes printed with TERM=dumb (F25)');
    const text = s.screen.text({ history: true });
    expect(!has(text, 'What should we work on') && !has(text, 'Set up this project now'), 'the plain flow asked for a task (T13)');
    expect(has(text, '/conquistador init'), 'the plain flow does not say /conquistador init (T13)');
    expect(!launches(f).length, 'the plain flow opened an agent (T13)');
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.['claude-code'], 'plain flow did not install');
    return s.snaps;
  } finally { f.cleanup(); }
});

for (const mode of ['plain', 'dumb']) {
  for (const choice of ['explicit', 'defaults']) {
    scenario(`yes-${mode}-${choice}`, ['L1', 'T16', 'F25'], async ({ expect, transcript }) => {
      const f = fixture(`yes-${mode}-${choice}`, { agents: ['claude'], apps: { 'claude-desktop': { mcpServers: {} } } });
      const args = ['--yes', ...(mode === 'plain' ? ['--plain'] : []), ...(choice === 'explicit' ? ['--surface=agents,mcp-apps', '--providers=pi'] : [])];
      const s = f.term(args, { env: mode === 'dumb' ? { TERM: 'dumb' } : {} });
      try {
        // No key presses: --yes must choose scope, agents, apps and consent on its own.
        await s.waitFor('Summary', { timeout: 12_000 }); await s.snap('no-input-summary');
        expect(await s.exit({ timeout: 6000 }) === 0, '--yes fallback did not exit 0 without input');
        const shown = s.screen.text({ history: true });

        for (const question of ['Where do you want Conquistador?', 'Which agents?', 'All projects, or only this one?', 'Which MCP clients?', 'Turn on prompt hooks?', 'Install now?']) {
          expect(!has(shown, question), `--yes fallback asked ${question}`);
        }
        expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.[choice === 'explicit' ? 'pi' : 'claude-code'], 'default global agent install was not recorded');
        expect(!launches(f).length, '--yes fallback opened an agent');
        return s.snaps;
      } finally { transcript('terminal-raw', s.raw); s.kill(); await s.exit({ timeout: 1000 }); f.cleanup(); }
    });
  }
}

scenario('scroll-capacity', ['S1', 'T7'], async ({ expect, transcript }) => {
  // Exercise the real private Scroll function with a minimal element renderer. Check row bounds
  // independently from its implementation; the PTY narrow/wide cases check full Ink frames.
  const source = readFileSync(join(root, 'tools/installer-tui.mjs'), 'utf8');
  const scrollSource = /function Scroll\([\s\S]*?\n}/.exec(source)?.[0];
  if (!scrollSource) throw Error('Scroll function not found');
  const h = (type, props, ...children) => ({ type, props, children: children.flat().filter(Boolean) });
  const scroll = new Function('h', 'Box', 'Text', 'Line', `${scrollSource}; return Scroll;`)(h, 'box', 'text', 'line');
  const lines = Array.from({ length: 12 }, (_, i) => ({ text: i === 11 ? 'Retry: conquistador doctor --fix' : `Recovery line ${i + 1}` }));
  const evidence = [];
  for (const height of [1, 2, 3, 4, 10, 12, 15]) {
    const limit = { current: 0 };
    scroll({ c: {}, lines, offset: 0, height, limit });
    const last = scroll({ c: {}, lines, offset: limit.current, height, limit });
    expect(last.children.some(row => row.props?.text === lines.at(-1).text), `height ${height}: final retry line is unreachable`);
    expect(!last.children.some(row => row.children?.some(text => typeof text === 'string' && text.startsWith('↓'))), `height ${height}: bottom marker remains at end`);
    for (let offset = 0; offset <= limit.current + 2; offset += 1) {
      const rows = scroll({ c: {}, lines, offset, height, limit }).children;
      expect(rows.length <= height, `height ${height}, offset ${offset}: drew ${rows.length} rows`);
    }
    evidence.push({ height, maximumOffset: limit.current, finalRows: last.children.map(row => row.props?.text ?? row.children.join('')) });
  }
  transcript('scroll-row-bounds', JSON.stringify(evidence, null, 2));
  return [];
});

scenario('scroll-recovery', ['S1', 'T2', 'T7'], async ({ expect, transcript }) => {
  const f = fixture('scroll-recovery', { agents: ['claude'] });
  mkdirSync(join(f.home, '.conquistador/config.json'), { recursive: true });
  const s = f.term(['--providers=claude', '--scope=global', '--no-hooks'], { columns: 60, rows: 24 });
  try {
    await s.waitFor(TITLE.review); await s.press('enter');
    await s.waitFor(TITLE.done); await s.snap('done-before-scroll');
    for (let i = 0; i < 40; i += 1) await s.press('down');
    await s.snap('done-at-end');
    const end = s.screen.text();
    expect(has(end, 'Retry: conquistador doctor --fix'), 'final recovery instruction is not visible');
    expect(!/↓\s*\d+\s*more/.test(end), 'bottom marker remains after scrolling to the end');
    expect(!tooWide(s.raw, 60).length, 'short recovery card overflows its width');
    await s.press('q'); await s.waitFor('Summary');
    expect(await s.exit() === 1, 'failed recovery card did not exit 1');
    expect(s.raw.lastIndexOf('\x1b[?1049l') > s.raw.lastIndexOf('\x1b[?1049h'), 'recovery card left the alternate screen open');
    return s.snaps;
  } finally { transcript('terminal-raw', s.raw); s.kill(); await s.exit({ timeout: 1000 }); f.cleanup(); }
});

// --- T19, F15: a stale copy earlier on PATH --------------------------------------------------------------
scenario('shadowed', ['T19', 'F15'], async ({ expect, transcript }) => {
  const f = fixture('shadowed', { agents: ['claude'], stale: '0.0.14' });
  try {
    const s = f.term([], { rows: 40 });
    await s.waitFor(TITLE.agents);
    await s.snap('preflight-shadowed');
    const text = s.screen.text();
    expect(has(text, '0.0.14') && has(text, version) && has(text, 'npm i -g @forsvn/conquistador@latest'), 'preflight does not name both versions and the fix (F15)');
    await s.press('ctrlC');
    await s.exit();
    const dry = f.run(['--dry-run']);
    transcript('shadowed-non-tty', `$ conquistador --dry-run   (exit ${dry.status})\n--- stderr ---\n${dry.stderr}--- stdout ---\n${dry.stdout}`);
    expect(has(dry.stderr, '0.0.14'), 'non-TTY run does not warn about the stale copy (F15)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- T17, F16, F23: offline, and the hosted surface when tools/login.mjs exists ----------------------
scenario('offline', ['T17', 'F16'], async ({ expect }) => {
  const f = fixture('offline', { agents: ['claude'], login: true, env: { npm_config_registry: `${hanging.url}/`, CONQUISTADOR_HOSTED_URL: `${closed}/mcp` } });
  try {
    const started = Date.now();
    const s = f.term([]);
    await s.waitFor(TITLE.agents);
    const waited = Date.now() - started;
    await s.press('enter');
    await s.waitFor(TITLE.options);
    await s.snap('options-offline');
    const text = s.screen.text();
    expect(waited < 6000, `the first screen took ${waited} ms offline (F16)`);
    expect(!/Hosted MCP.*‹/.test(text) && has(text, 'Hosted MCP needs a network connection'), 'Hosted MCP offered offline, or no reason shown (F16)');
    expect(!has(text, 'is out'), 'update notice shown offline (F16)');
    await s.press('ctrlC');
    await s.exit();
    return s.snaps;
  } finally { f.cleanup(); }
});

scenario('hosted', ['T17', 'F23'], async ({ expect }) => {
  const f = fixture('hosted', { agents: [], login: true });
  try {
    const s = f.term([]);
    await s.waitFor(TITLE.agents); await s.press('enter');
    await s.waitFor(TITLE.options);
    await setOption(s, 'Hosted MCP', 'On');
    await s.snap('options-hosted');
    await s.press('enter');
    await s.waitFor(TITLE.review); await s.snap('review-hosted'); await s.press('enter');
    await finish(s);
    const code = await s.exit();
    const text = s.screen.text({ history: true });
    expect(code === 0, `exit ${code}`);
    expect(has(text, 'cq_test_token_123') && has(text, '/mcp') && has(text, 'octocat'), 'summary lacks the client config');
    expect(has(text, '9.9.9'), 'summary lacks the update notice from the registry');
    const cancel = fixture('hosted-cancel', { agents: [], login: true, env: { FAKE_LOGIN: 'cancel' } });
    try {
      const c = cancel.term(['--surface=hosted', '--yes']);
      await finish(c);
      expect(await c.exit() === 1, 'a cancelled sign-in must not exit 0 (F23)');
      expect(has(c.screen.text({ history: true }), 'skipped'), 'cancelled sign-in not reported as skipped (F23)');
      return [...s.snaps, ...c.snaps];
    } finally { cancel.cleanup(); }
  } finally { f.cleanup(); }
});

// Real login code, loopback HTTP only. Do not replace login.mjs for these recovery checks.
// The held request/body exercises fetch cancellation, rather than returning a canned cancel.
for (const phase of ['config', 'device', 'sleep', 'poll', 'body', 'exchange', 'timeout', 'timeout-body', 'expiry']) {
  scenario(`hosted-cancel-${phase}`, ['H1-H8', 'T2', 'T4', 'F23'], async ({ expect, transcript, keepSnaps }) => {
    let reached;
    const target = new Promise(done => { reached = done; });
    let pendingClosed = false;
    const requests = [];
    const server = await listen((request, response) => {
      const path = new URL(request.url, 'http://fixture').pathname;
      const stage = path === '/api/login' ? request.method === 'POST' ? 'exchange' : 'config'
        : path === '/login/device/code' ? 'device' : path === '/login/oauth/access_token' ? 'poll' : 'probe';
      requests.push(stage);
      const json = value => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(value)); };
      if (stage === 'probe') { response.writeHead(401); response.end('{}'); return; }
      if (stage === phase || (stage === 'poll' && ['body', 'timeout', 'timeout-body', 'expiry'].includes(phase))) {
        response.on('close', () => { pendingClosed = true; });
        if (['body', 'timeout-body'].includes(phase)) { response.writeHead(200, { 'content-type': 'application/json' }); response.write('{'); }
        reached(stage);
        return;
      }
      if (stage === 'config') json({ githubClientId: 'local-e2e-client' });
      else if (stage === 'device') {
        json({ device_code: 'local-device', user_code: 'LOCAL-CODE', verification_uri: `${server.url}/device`, interval: phase === 'sleep' ? 60 : 1, expires_in: phase === 'expiry' ? 3 : 900 });
        if (phase === 'sleep') reached('sleep');
      } else if (stage === 'poll') json({ access_token: 'local-github-token' });
      else json({ token: 'cq_local_issued', login: 'local-user' });
    });
    const f = fixture(`hosted-cancel-${phase}`, { agents: ['claude'], env: {
      CONQUISTADOR_MCP_URL: server.url, CONQUISTADOR_GITHUB_URL: server.url, CONQUISTADOR_HOSTED_URL: `${server.url}/mcp`,
    } });
    const existingToken = join(f.home, '.conquistador/mcp-token');
    mkdirSync(dirname(existingToken), { recursive: true });
    writeFileSync(existingToken, 'cq_existing_token\n');
    let s;
    try {
      s = f.term(['--surface=agents,hosted', '--providers=claude', '--scope=global', '--yes']);
      let timer;
      try { await Promise.race([target, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`login never reached ${phase}`)), 15_000); })]); }
      finally { clearTimeout(timer); }
      expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.['claude-code'], 'agent install did not complete before sign-in');
      const installedBefore = f.tree().filter(path => /\.conquistador\/plugin\//.test(path));
      expect(installedBefore.length > 0, 'no completed plugin payload to preserve');
      if (phase === 'sleep') await s.waitFor('Waiting for you to approve');
      // The active install spinner never becomes quiet. Capture this frame directly so the
      // test sends Ctrl-C while the held request is active, before its independent timeout.
      const title = `waiting-${phase}`;
      s.snaps.push({ name: title, text: s.screen.text(), html: s.screen.html({ title }), styled: s.screen.styled() });
      const started = Date.now();
      const bounded = phase.startsWith('timeout') || phase === 'expiry';
      if (!bounded) await s.press('ctrlC');
      await s.waitFor(TITLE.done, { timeout: phase.startsWith('timeout') ? 20_000 : 5000 });
      await s.snap(`done-${phase}`);
      const elapsed = Date.now() - started;
      expect(elapsed < (phase.startsWith('timeout') ? 20_000 : 5000), `sign-in recovery took ${elapsed} ms`);
      await s.waitFor('Summary', { timeout: 6000 }); await s.snap(`summary-${phase}`);
      expect(await s.exit({ timeout: 6000 }) === 1, 'cancelled or timed-out sign-in must exit 1');
      const shown = s.screen.text({ history: true });
      const done = s.snaps.find(snap => snap.name === `done-${phase}`).text;
      expect(has(shown, 'Hosted MCP') && has(shown, 'conquistador --surface=hosted'), 'no usable Hosted MCP retry');
      expect(has(done, 'Claude Code') && /checks?\s+passed/.test(done), 'completed agent did not pass verification');
      if (!bounded) expect(has(shown, 'skipped'), 'cancelled sign-in was not recorded as skipped');
      else expect(has(shown, phase === 'expiry' ? 'expired' : 'timed out'), 'stalled response did not report its finite timeout or expiry');
      expect(f.read(existingToken) === 'cq_existing_token\n', 'existing token was replaced during failed sign-in');
      expect(JSON.stringify(f.tree().filter(path => /\.conquistador\/plugin\//.test(path))) === JSON.stringify(installedBefore), 'completed plugin payload changed after sign-in cancellation');
      expect(!launches(f).length, 'sign-in recovery opened an agent');
      expect(s.raw.lastIndexOf('\x1b[?1049l') > s.raw.lastIndexOf('\x1b[?1049h'), 'alternate screen was not restored');
      expect(/\x1b\[\?25h/.test(s.raw.slice(s.raw.lastIndexOf('\x1b[?1049l'))), 'cursor stayed hidden');
      if (phase === 'sleep') expect(!requests.includes('poll'), 'polling continued after sleep cancellation');
      else expect(pendingClosed, 'pending sign-in network request did not close');
      return [];
    } finally {
      if (s) { transcript('terminal-raw', s.raw); keepSnaps(s.snaps); s.kill(); await s.exit({ timeout: 1000 }); }
      server.server.closeAllConnections?.(); server.server.close(); f.cleanup();
    }
  });
}

// --- F17, F22: Executor stopped, Executor too old --------------------------------------------------
scenario('executor-stopped', ['F17'], async ({ expect, transcript }) => {
  const f = fixture('executor-stopped', { agents: [], executor: 'stopped' });
  try {
    const plan = f.run(['--surface=executor', '--dry-run']);
    expect(has(plan.stdout, 'not running') && has(plan.stdout, 'starts'), `plan does not say the step starts Executor (F17):\n${plan.stdout}`);
    const result = f.run(['--surface=executor', '--yes']);
    transcript('executor-stopped', `$ conquistador --surface=executor --yes   (exit ${result.status})\n${result.stdout}${result.stderr}`);
    expect(result.status === 0, `exit ${result.status}`);
    const calls = f.calls().filter(call => call.name === 'executor').map(call => call.args.join(' '));
    const start = calls.findIndex(call => call === 'daemon run'), add = calls.findIndex(call => call.startsWith('call executor mcp addServer'));
    expect(start >= 0 && add > start, `Executor not started before the source was added (F17): ${calls.join(' | ')}`);
    return [];
  } finally { f.cleanup(); }
});

scenario('executor-old', ['F22'], async ({ expect, transcript }) => {
  const f = fixture('executor-old', { agents: [], executor: 'old' });
  try {
    const result = f.run(['--surface=executor', '--yes']);
    transcript('executor-old', `$ conquistador --surface=executor --yes   (exit ${result.status})\n${result.stdout}${result.stderr}`);
    expect(result.status === 1, `exit ${result.status}`);
    expect(has(result.stdout, 'Add Integration') && has(result.stdout, 'server.mjs'), 'no manual steps for an old Executor (F22)');
    return [];
  } finally { f.cleanup(); }
});

// --- F30: Executor 1.5.40 adds a source but cannot remove one ---------------------------------------
scenario('executor-1.5', ['F30'], async ({ expect, transcript }) => {
  const f = fixture('executor-1.5', { agents: [], executor: 'v1.5' });
  try {
    const install = f.run(['--surface=executor', '--yes']);
    expect(install.status === 0, `install exit ${install.status}: ${install.stdout}`);
    const removed = f.run(['remove']);
    transcript('executor-1.5-remove', `$ conquistador remove   (exit ${removed.status})\n${removed.stdout}${removed.stderr}`);
    expect(removed.status === 1 && has(removed.stdout, 'in the Executor app'), 'remove does not give the manual step (F30)');
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.executor?.slug === 'conquistador', 'remove forgot a source it could not remove (F30)');
    return [];
  } finally { f.cleanup(); }
});

for (const mode of ['v2', 'stderr-v2', 'unknown', 'version-failed']) scenario(`executor-${mode === 'v2' ? 'v2-handoff' : mode}`, ['E2', 'E3'], async ({ expect, transcript }) => {
  const f = fixture(`executor-${mode}`, { agents: [], executor: mode });
  const message = mode.includes('v2') ? 'Executor 2' : 'Could not verify the Executor version';

  try {
    const dry = f.run(['--surface=executor', '--dry-run']);
    transcript('v2-plan', `${dry.stdout}${dry.stderr}`);
    expect(has(dry.stdout, message), 'the review does not explain why source setup is paused');
    expect(!has(dry.stdout, 'not running'), 'an unchecked v2 process is reported as stopped');
    expect(!has(dry.stdout, 'daemon run') && !has(dry.stdout, 'executor call'), 'the review promises removed v1 commands');
    const install = f.run(['--surface=executor', '--yes']);
    transcript('v2-handoff', `${install.stdout}${install.stderr}`);
    expect(install.status === 1 && has(install.stdout, message), 'the unsupported source route is reported as installed');
    expect(!existsSync(join(f.home, '.conquistador/plugin')), 'the manual-only handoff staged an unused plugin');
    expect(!f.json(join(f.home, '.conquistador/installs.json'))?.executor, 'the handoff recorded an unverified source');

    // Keep a source recorded by an earlier supported installation when the CLI upgrades.
    mkdirSync(join(f.home, '.conquistador'), { recursive: true });
    writeFileSync(join(f.home, '.conquistador/installs.json'), JSON.stringify({ agents: {}, executor: { slug: 'conquistador', name: 'conquistador', version } }));
    const doctor = f.run(['doctor', '--json']);
    transcript('v2-doctor', doctor.stdout);
    expect(JSON.parse(doctor.stdout).checks.some(check => check.detail.startsWith('Executor:') && check.status !== 'ok'), 'doctor claims the legacy source is verified on v2');
    const removal = f.run(['remove']);
    transcript('v2-remove', `${removal.stdout}${removal.stderr}`);
    expect(removal.status === 1 && f.json(join(f.home, '.conquistador/installs.json'))?.executor, 'unsupported removal discarded the tracked source');
    const deprecated = f.calls().filter(call => call.name === 'executor' && ['daemon', 'call', 'tools', 'resume', 'web'].includes(call.args[0]));
    expect(!deprecated.length, `removed Executor commands ran: ${JSON.stringify(deprecated)}`);

    return [];
  } finally { f.cleanup(); }
});

scenario('executor-stderr-v1', ['E3'], async ({ expect, transcript }) => {
  const f = fixture('executor-stderr-v1', { agents: [], executor: 'stderr-v1' });

  try {
    const result = f.run(['--surface=executor', '--yes']);
    transcript('stderr-v1-install', `${result.stdout}${result.stderr}`);
    expect(result.status === 0 && f.json(join(f.home, '.conquistador/installs.json'))?.executor, 'a confirmed legacy version on stderr cannot install');
    expect(f.calls().some(call => call.name === 'executor' && call.args.includes('addServer')), 'the confirmed legacy source path was not used');

    return [];
  } finally { f.cleanup(); }
});

// --- F18: old flags ----------------------------------------------------------------------------------
scenario('old-flags', ['F18'], async ({ expect, transcript }) => {
  const f = fixture('old-flags', { agents: ['claude'], apps: { 'claude-desktop': null } });
  let s;
  try {
    s = f.term(['--mcp']);
    await s.waitFor('Which MCP clients?');
    await s.press('enter');
    await s.waitFor(TITLE.options);
    await s.snap('old-flag-mcp');
    expect(has(s.screen.text(), '--surface=mcp-apps'), '--mcp does not print the new flag');
    expect(/MCP clients.*‹\s*On\s*›/.test(s.screen.text()), '--mcp did not turn MCP clients on');
    await s.press('ctrlC');
    await s.exit();
    const legacy = f.run(['--plugin', '--host', 'codex', '--dry-run']);
    transcript('old-plugin-route', `$ conquistador --plugin --host codex --dry-run   (exit ${legacy.status})\n${legacy.stdout}${legacy.stderr}`);
    expect(legacy.status === 0 && has(legacy.stdout, 'Prepare a Conquistador plugin source'), 'old --plugin --host route changed');
    for (const [flag, text] of [['--bot', 'Chat bots'], ['--skills', 'project'], ['--plugin', 'Claude Code'], ['--mcp', 'Claude Desktop']]) {
      const result = f.run([flag, '--dry-run']);
      transcript(`old${flag}`, `$ conquistador ${flag} --dry-run   (exit ${result.status})\n${result.stdout}${result.stderr}`);
      expect(result.status === 0 && has(result.stdout, text) && has(result.stderr, '--surface'), `${flag} --dry-run: exit ${result.status}, no ${text}, or no note`);
    }
    expect(f.run(['project', '--help']).status === 0, 'conquistador project --help broke');
    expect(f.run(['--mcp', '--help']).status === 0, 'conquistador --mcp --help broke');
    return s.snaps;
  } finally {
    if (s) { s.kill(); await s.exit({ timeout: 1000 }); }

    f.cleanup();
  }
});

// --- Run ------------------------------------------------------------------------------------------------
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const results = [];
const gallery = [];
for (const item of scenarios.filter(entry => !only.length || only.includes(entry.name))) {
  const { problems, expect } = checker();
  const folder = join(out, item.name);
  mkdirSync(folder, { recursive: true });
  const extra = [];
  const texts = [];
  const started = Date.now();
  let snaps = [];
  try {
    snaps = await item.body({ expect, keepSnaps: list => extra.push(...list), transcript: (name, text) => texts.push([name, text]) }) ?? [];
  } catch (error) { problems.push(error.message.slice(0, 4000)); }
  snaps = [...snaps, ...extra];
  snaps.forEach((snap, index) => writeFileSync(join(folder, `${String(index + 1).padStart(2, '0')}-${snap.name}.txt`), snap.text));
  texts.forEach(([name, text], index) => writeFileSync(join(folder, `${String(snaps.length + index + 1).padStart(2, '0')}-${name}.txt`), text));
  gallery.push(...snaps.map(snap => snap.html.replace('<figcaption>', `<figcaption>${item.name} · `)));
  results.push({ name: item.name, covers: item.covers, pass: problems.length === 0, problems, screens: snaps.length + texts.length, ms: Date.now() - started });
  console.log(`${problems.length ? 'FAIL' : 'pass'}  ${item.name.padEnd(22)} ${item.covers.join(' ')}${problems.length ? `\n      ${problems.join('\n      ')}` : ''}`);
}
for (const server of [registry, hosted, hanging]) { server.server.closeAllConnections?.(); server.server.close(); }
if (packageCopy && !keep) rmSync(packageCopy, { recursive: true, force: true });
const passed = results.filter(item => item.pass).length;
const report = { schema: 'conquistador.e2e-installer/v1', createdAt: new Date().toISOString(), version, commit, dirty, sourceHashes, node: process.version, platform: process.platform, total: results.length, passed, results };
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'screens.html'), `${HTML_HEAD}\n${gallery.join('\n')}\n`);
writeFileSync(join(out, 'report.md'), [`# Installer E2E: ${passed}/${results.length} pass`, '', `Run ${report.createdAt} on ${process.platform}, Node ${process.version}, Conquistador ${version}.`, '',
  `Commit ${commit}${dirty ? ' with uncommitted changes' : ', clean checkout'}. Exact source hashes are in report.json.`, '',
  '| Result | Scenario | Failure modes | Screens | Problems |', '| --- | --- | --- | --- | --- |',
  ...results.map(item => `| ${item.pass ? 'pass' : 'FAIL'} | ${item.name} | ${item.covers.join(', ')} | ${item.screens} | ${item.problems.join('; ').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 300)} |`), ''].join('\n'));
console.log(`\n${passed}/${results.length} pass. Report: ${join(out, 'report.md')}`);
process.exitCode = passed === results.length ? 0 : 1;
