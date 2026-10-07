// Onboarding v2, end to end, in a real pseudo-terminal. Every scenario gets a new HOME, a project
// folder, and fake agent and Executor CLIs on PATH (tools/e2e/fake-agent.mjs, fake-executor.mjs).
// No real agent, no network beyond 127.0.0.1, no model. Failure-mode IDs (F1-F29) are in the PR.
//   node tools/e2e/onboarding-v2.mjs [--only NAME[,NAME]] [--out DIR]
// Writes one transcript per screen, screens.html (for screenshots), report.json, and report.md.
// Needs python3 (the PTY bridge). Sandboxes that block /dev/ptmx must run it outside the sandbox.
import { spawnSync } from 'node:child_process';
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
const out = resolve(option('--out', join(root, 'dist/e2e/onboarding-v2')));
const only = option('--only', '')?.split(',').filter(Boolean) ?? [];
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const keep = argv.includes('--keep');

// --- Local servers: a fake npm registry, a fake hosted MCP endpoint, a hanging server, a closed port.
const listen = handler => new Promise(done => { const server = createServer(handler); server.listen(0, '127.0.0.1', () => done({ server, url: `http://127.0.0.1:${server.address().port}` })); });
const registry = await listen((request, response) => { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ name: '@forsvn/conquistador', version: '9.9.9' })); });
const hosted = await listen((request, response) => { response.writeHead(401, { 'content-type': 'application/json' }); response.end('{"error":"unauthorized"}'); });
const hanging = await listen(() => { /* Never answers: the update check must not wait for it. */ });
const closed = await new Promise(done => { const server = createTcpServer(); server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => done(`http://127.0.0.1:${port}`)); }); });

// A stand-in for tools/login.mjs (built on another branch). It follows the agreed contract:
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

function fixture(name, { agents = ['claude', 'codex'], apps = {}, executor = null, growth = false, env: extra = {}, login = false, stale = null } = {}) {
  const work = mkdtempSync(join(tmpdir(), `cq-onboarding-${name}-`));
  const home = join(work, 'home'), bin = join(work, 'bin'), project = join(home, 'acme');
  for (const folder of [home, bin, project]) mkdirSync(folder, { recursive: true });
  const shim = (file, body) => { writeFileSync(join(bin, file), `#!/bin/sh\n${body}\n`); chmodSync(join(bin, file), 0o755); };
  shim('node', `exec "${process.execPath}" "$@"`);
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
    PATH, HOME: home, USERPROFILE: home, TERM: 'xterm-256color', LANG: 'en_US.UTF-8', TMPDIR: process.env.TMPDIR ?? tmpdir(),
    FAKE_AGENT_LOG: logFile, npm_config_registry: `${registry.url}/`, CONQUISTADOR_HOSTED_URL: `${hosted.url}/mcp`,
    CONQUISTADOR_PREFILL: 'off', ...(executor ? { FAKE_EXECUTOR: executor } : {}), ...extra,
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
const has = (text, needle) => text.replace(/\s+/g, '').includes(needle.replace(/\s+/g, ''));
// Lines as a terminal would show them if it never wrapped: render at a huge width.
const unwrappedWidth = raw => { const screen = new Screen(400, 2000); screen.write(raw); return Math.max(0, ...screen.lines({ history: true }).map(line => [...line].length)); };

function checker() {
  const problems = [];
  return { problems, expect: (condition, message) => { if (!condition) problems.push(message); } };
}

// Press Down N times, then Space: toggle the Nth option below the cursor in a multiselect.
async function toggle(s, steps) { for (let index = 0; index < steps; index += 1) await s.press('down'); await s.press('space'); }

// The happy path's questions, answered with Enter (defaults), up to the review.
async function acceptDefaultsToReview(s, { snap = true, hooks = true, apps = true, executor = true } = {}) {
  await s.waitFor('Where do you want Conquistador?'); if (snap) await s.snap('surfaces'); await s.press('enter');
  await s.waitFor('Which agents?'); if (snap) await s.snap('agents'); await s.press('enter');
  await s.waitFor('all projects, or only this one?'); if (snap) await s.snap('scope'); await s.press('enter');
  if (hooks) { await s.waitFor('Turn on prompt hooks?'); if (snap) await s.snap('hooks'); await s.press('enter'); }
  if (apps) { await s.waitFor('Which MCP apps?'); if (snap) await s.snap('mcp-apps'); await s.press('enter'); }
  if (executor) { await s.waitFor('Name for the source in Executor'); if (snap) await s.snap('executor'); await s.press('enter'); }
  await s.waitFor('Install now?');
  if (snap) await s.snap('review');
}

// After install: decline project setup, pick Finish, wait for the summary.
async function finishAfterInstall(s, { project = true } = {}) {
  if (project) {
    await s.waitFor('Set up this project now?'); await s.snap('installed-and-verified');
    await s.press('down', 'enter');
  }
  await s.waitFor('What should we work on?'); await s.snap('first-task');
  await s.press('up', 'enter');
  await s.waitFor('Summary'); await s.snap('summary');
}

// --- F24, F21, F26, F27, F29: the happy path ------------------------------------------------------
scenario('happy', ['F21', 'F24', 'F26', 'F27', 'F29'], async ({ expect, keepSnaps }) => {
  const f = fixture('happy', { agents: ['claude', 'codex'], executor: 'running',
    apps: { 'claude-desktop': { mcpServers: { other: { command: 'other-server' } } }, vscode: null } });
  try {
    const s = f.term([]);
    await s.waitFor('Nothing changes until you confirm.');
    await s.snap('welcome');
    await acceptDefaultsToReview(s);
    const surfaces = s.snaps.find(item => item.name === 'surfaces').text;
    for (const label of ['Coding agents', 'MCP apps', 'Executor', 'Chat bots', 'Step 1 of 5']) expect(has(surfaces, label), `surfaces screen lacks ${label}`);
    expect(!has(surfaces, 'Hosted MCP'), 'Hosted MCP shown without tools/login.mjs (F24)');
    const review = s.snaps.at(-1).text;
    for (const text of ['Claude Code', 'Codex', 'Claude Desktop', 'VS Code', 'backup', 'Unchanged', 'conquistador remove', 'Step 3 of 5']) expect(has(review, text), `review lacks ${text}`);
    await s.press('enter');
    await finishAfterInstall(s);
    const code = await s.exit();
    expect(code === 0, `first run exited ${code}`);
    const installed = s.snaps.find(item => item.name === 'installed-and-verified').text;
    expect(has(installed, 'Checking') && !installed.includes('✗'), 'verify pass missing or failed');
    const summary = s.snaps.at(-1).text;
    for (const text of ['/conquistador', 'conquistador doctor', 'conquistador update', 'conquistador remove']) expect(has(summary, text), `summary lacks ${text}`);
    const calls = f.calls().map(call => `${call.name} ${call.args.join(' ')}`);
    expect(calls.some(call => call.startsWith('claude plugin install conquistador@conquistador')), 'Claude Code plugin not installed');
    expect(calls.some(call => call.startsWith('codex plugin add conquistador@conquistador')), 'Codex plugin not installed');
    expect(calls.some(call => call.startsWith('executor call executor mcp addServer')) && calls.some(call => /^executor resume .*--action accept/.test(call)), 'Executor source not added');
    const desktop = f.json(appFile(f.home, 'claude-desktop'));
    expect(desktop?.mcpServers?.other?.command === 'other-server', 'Claude Desktop lost its other server (F21)');
    expect(desktop?.mcpServers?.conquistador?.args?.[0]?.endsWith(join('plugin', 'mcp', 'server.mjs')), 'Claude Desktop entry missing');
    expect(readdirSync(dirname(appFile(f.home, 'claude-desktop'))).some(file => file.includes('conquistador-backup')), 'no backup of the Claude Desktop config (F21)');
    expect(f.json(appFile(f.home, 'vscode'))?.servers?.conquistador?.type === 'stdio', 'VS Code entry missing');

    // F29: a second run opens the task flow, not the installer.
    const again = f.term([]);
    await again.waitFor(/Open in|What should we work on|OPENED WITH/);
    await again.snap('second-run');
    expect(!has(again.screen.text({ history: true }), 'Where do you want Conquistador?'), 'second run showed the installer (F29)');
    if (has(again.screen.text(), 'Open in')) await again.press('enter');
    await again.waitFor('OPENED WITH');
    await again.exit();
    keepSnaps(again.snaps);

    const doctor = f.run(['doctor']);
    expect(doctor.status === 0 && has(doctor.stdout, 'Claude Desktop'), `doctor after install: exit ${doctor.status}\n${doctor.stdout}`);

    // F26: remove undoes the MCP entries and the Executor source; other servers stay.
    const removed = f.run(['remove']);
    expect(removed.status === 0, `remove exited ${removed.status}: ${removed.stdout}${removed.stderr}`);
    const after = f.json(appFile(f.home, 'claude-desktop'));
    expect(after?.mcpServers?.other && !after.mcpServers.conquistador, 'remove left the Claude Desktop entry or dropped the other server (F26)');
    expect(!f.json(appFile(f.home, 'vscode'))?.servers?.conquistador, 'remove left the VS Code entry (F26)');
    expect(f.calls().some(call => call.name === 'executor' && call.args.join(' ').includes('integrations remove')), 'remove did not remove the Executor source (F26)');
    return [...s.snaps];
  } finally { f.cleanup(); }
});

// --- F1: no agent detected ------------------------------------------------------------------------
scenario('no-agent', ['F1'], async ({ expect }) => {
  const f = fixture('no-agent', { agents: [] });
  try {
    const s = f.term([]);
    await s.waitFor('Where do you want Conquistador?');
    await s.snap('surfaces');
    expect(has(s.screen.text(), 'No coding agent found'), 'surfaces screen does not say no agent was found');
    // Options: Coding agents, MCP apps, Executor, Chat bots. Nothing is preselected.
    await toggle(s, 3);
    await s.press('enter');
    await s.waitFor('Folder for the bot files'); await s.snap('bot-folder'); await s.press('enter');
    await s.waitFor('Install now?'); await s.snap('review'); await s.press('enter');
    await s.waitFor('Summary'); await s.snap('summary');
    const code = await s.exit();
    expect(code === 0, `exit ${code}`);
    expect(existsSync(join(f.project, 'conquistador-bot', 'SYSTEM-PROMPT.md')), 'bot files missing');
    expect(f.calls().length === 0, 'an agent command ran');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F2: only skill-only agents -------------------------------------------------------------------
scenario('skill-only', ['F2'], async ({ expect }) => {
  const f = fixture('skill-only', { agents: ['gemini', 'opencode'] });
  try {
    const s = f.term([]);
    await acceptDefaultsToReview(s, { hooks: false, apps: false, executor: false });
    await s.press('enter');
    await finishAfterInstall(s);
    const code = await s.exit();
    expect(code === 0, `exit ${code}`);
    expect(!has(s.screen.text({ history: true }), 'Turn on prompt hooks?'), 'hooks question shown with no plugin agent');
    expect(existsSync(join(f.home, '.gemini/skills/conquistador/SKILL.md')), 'Gemini CLI skill copy missing');
    expect(existsSync(join(f.home, '.config/opencode/skills/conquistador/SKILL.md')), 'OpenCode skill copy missing');
    expect(!f.calls().some(call => call.args[0] === 'plugin'), 'a plugin command ran for a skill-only agent');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F3, F7, F20: one agent fails, one app cannot be edited, the rest installs ---------------------
scenario('half-fail', ['F3', 'F7', 'F20'], async ({ expect }) => {
  const zed = '{\n  // My Zed settings\n  "theme": "One Dark"\n}\n';
  const f = fixture('half-fail', { agents: ['claude', 'codex'], env: { FAKE_AGENT_FAIL: 'codex' },
    apps: { 'claude-desktop': null, zed } });
  try {
    const s = f.term([]);
    await acceptDefaultsToReview(s, { executor: false });
    expect(has(s.snaps.at(-1).text, 'by hand'), 'review does not say the Zed entry is manual (F20)');
    await s.press('enter');
    await finishAfterInstall(s);
    const code = await s.exit();
    expect(code === 1, `exit ${code}; a failed surface must exit 1 (F7)`);
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
    await acceptDefaultsToReview(s, { executor: false });
    const apps = s.snaps.find(item => item.name === 'mcp-apps').text;
    expect(has(apps, 'Cursor gets the plugin'), 'MCP apps step does not explain why Cursor is left out (F4)');
    const review = s.snaps.at(-1).text;
    expect(!/Cursor\s+add/.test(review) && !has(review, '.cursor/mcp.json'), 'review plans an MCP entry for Cursor (F4)');
    await s.press('enter');
    await finishAfterInstall(s);
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
    expect(f.run(['--providers=claude', '--scope=project', '--yes', '--no-open']).status === 0, 'project install failed');
    const second = f.run(['--providers=claude', '--scope=global', '--yes', '--no-open']);
    expect(second.status === 0, `global install exited ${second.status}`);
    expect(has(second.stdout, 'loads both'), `install summary does not warn about two copies (F5):\n${second.stdout}`);
    const doctor = f.run(['doctor']);
    expect(has(doctor.stdout, 'loads both') && has(doctor.stdout, 'conquistador remove --scope=project'), `doctor does not warn about two copies (F5):\n${doctor.stdout}`);
    const s = f.term(['add']);
    await s.waitFor('Where do you want Conquistador?'); await s.press('enter');
    await s.waitFor('Which agents?'); await s.press('enter');
    await s.waitFor('all projects, or only this one?'); await s.press('enter');
    await s.waitFor('Turn on prompt hooks?'); await s.press('enter');
    await s.waitFor('Install now?'); await s.snap('review-both-scopes');
    expect(has(s.screen.text(), 'loads both'), 'review does not warn about two copies (F5)');
    await s.press('escape');
    await s.exit();
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F6: an older version is installed ------------------------------------------------------------
scenario('update', ['F6'], async ({ expect }) => {
  const f = fixture('update', { agents: ['claude'] });
  try {
    expect(f.run(['--providers=claude', '--yes', '--no-open']).status === 0, 'first install failed');
    const stateFile = join(f.home, '.conquistador/installs.json');
    const state = f.json(stateFile);
    state.agents['claude-code'].version = '0.2.0';
    writeFileSync(stateFile, JSON.stringify(state));
    const owned = join(f.home, '.conquistador/plugin/.conquistador-owned.json');
    writeFileSync(owned, JSON.stringify({ ...f.json(owned), version: '0.2.0' }));
    const plan = f.run(['--surface=agents', '--providers=claude', '--dry-run']);
    expect(has(plan.stdout, 'update') && has(plan.stdout, '0.2.0'), `plan does not say update from 0.2.0 (F6):\n${plan.stdout}`);
    const s = f.term(['add']);
    await s.waitFor('Where do you want Conquistador?'); await s.press('enter');
    await s.waitFor('Which agents?'); await s.press('enter');
    await s.waitFor('all projects, or only this one?'); await s.press('enter');
    await s.waitFor('Turn on prompt hooks?'); await s.press('enter');
    await s.waitFor('Install now?'); await s.snap('review-update'); await s.press('enter');
    await finishAfterInstall(s);
    const code = await s.exit();
    expect(code === 0, `update exit ${code}`);
    expect(f.calls().some(call => call.name === 'claude' && call.args.join(' ') === 'plugin update conquistador@conquistador'), 'host update command did not run (F6)');
    expect(f.json(stateFile)?.agents?.['claude-code']?.version === version, 'state still records the old version (F6)');
    expect(f.json(owned)?.version === version, 'plugin copy not refreshed (F6)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F8: the verify pass finds a problem ----------------------------------------------------------
scenario('verify-problem', ['F8'], async ({ expect }) => {
  const f = fixture('verify-problem', { agents: ['claude'], env: { FAKE_AGENT_NOREG: 'claude' } });
  try {
    const s = f.term(['--providers=claude', '--scope=global', '--no-hooks']);
    await s.waitFor('Install now?'); await s.snap('review'); await s.press('enter');
    await s.waitFor('Summary'); await s.snap('summary');
    const code = await s.exit();
    expect(code === 1, `exit ${code}`);
    const text = s.screen.text({ history: true });
    expect(has(text, 'not registered') && has(text, 'conquistador doctor --fix'), 'verify line lacks the problem or the fix (F8)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F9: cancel at each step leaves no files -------------------------------------------------------
const CANCEL_STEPS = [
  ['surfaces', 'Where do you want Conquistador?', 'ctrlC', []],
  ['agents', 'Which agents?', 'escape', []],
  ['scope', 'all projects, or only this one?', 'ctrlC', []],
  ['hooks', 'Turn on prompt hooks?', 'escape', []],
  ['mcp-apps', 'Which MCP apps?', 'ctrlC', []],
  ['executor', 'Name for the source in Executor', 'ctrlC', []],
  ['bot-folder', 'Folder for the bot files', 'escape', ['bot']],
  ['review-no', 'Install now?', 'no', []],
  ['review-escape', 'Install now?', 'escape', []],
];
for (const [step, question, key, extra] of CANCEL_STEPS) {
  scenario(`cancel-${step}`, ['F9'], async ({ expect }) => {
    const f = fixture(`cancel-${step}`, { agents: ['claude'], executor: 'running', apps: { 'claude-desktop': { mcpServers: {} } } });
    try {
      const before = f.tree();
      const s = f.term([]);
      const answers = [
        ['Where do you want Conquistador?', extra.includes('bot') ? async () => { await toggle(s, 3); await s.press('enter'); } : null],
        ['Which agents?'], ['all projects, or only this one?'], ['Turn on prompt hooks?'], ['Which MCP apps?'],
        ['Name for the source in Executor'], ...(extra.includes('bot') ? [['Folder for the bot files']] : []), ['Install now?'],
      ];
      for (const [text, act] of answers) {
        await s.waitFor(text);
        if (text === question) break;
        if (act) await act(); else await s.press('enter');
      }
      if (key === 'no') await s.press('right', 'enter'); else await s.press(key);
      await s.waitFor('Cancelled. No files changed.');
      await s.snap(`cancelled-at-${step}`);
      const code = await s.exit();
      expect(code === 130, `exit ${code}`);
      expect(JSON.stringify(f.tree()) === JSON.stringify(before), `files changed after cancel at ${step}:\n${f.tree().filter(line => !before.includes(line)).join('\n')}`);
      expect(!f.calls().some(call => call.args[0] === 'plugin' && !/list/.test(call.args[1])) && !f.calls().some(call => call.name === 'executor' && /call|resume|daemon run/.test(call.args.join(' '))), 'a host command ran before confirm');
      return s.snaps;
    } finally { f.cleanup(); }
  });
}

// --- F28: cancel after install keeps the installs --------------------------------------------------
scenario('cancel-after-install', ['F28'], async ({ expect }) => {
  const f = fixture('cancel-after-install', { agents: ['claude'] });
  try {
    const s = f.term(['--providers=claude', '--scope=global']);
    await s.waitFor('Turn on prompt hooks?'); await s.press('enter');
    await s.waitFor('Install now?'); await s.press('enter');
    await s.waitFor('Set up this project now?'); await s.press('ctrlC');
    await s.waitFor('Conquistador is installed'); await s.snap('cancelled-after-install');
    const code = await s.exit();
    expect(code === 130, `exit ${code}`);
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.['claude-code'], 'install was undone by a later cancel');
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
    expect(f.calls().length === 0, `a preview ran a host command: ${JSON.stringify(f.calls())}`);
    return tty.snaps;
  } finally { f.cleanup(); }
});

// --- F13, F14: 60 columns and NO_COLOR -------------------------------------------------------------
scenario('narrow', ['F13'], async ({ expect }) => {
  const f = fixture('narrow', { agents: ['claude', 'codex'], executor: 'running', apps: { 'claude-desktop': { mcpServers: {} } } });
  try {
    const s = f.term([], { columns: 60 });
    await acceptDefaultsToReview(s);
    await s.press('enter');
    await finishAfterInstall(s);
    await s.exit();
    const widest = unwrappedWidth(s.raw);
    expect(widest <= 60, `a line is ${widest} columns wide at 60 columns (F13)`);
    return s.snaps;
  } finally { f.cleanup(); }
});

scenario('no-color', ['F14'], async ({ expect }) => {
  const f = fixture('no-color', { agents: ['claude'] });
  try {
    const s = f.term([], { env: { NO_COLOR: '1' } });
    await s.waitFor('Where do you want Conquistador?'); await s.snap('surfaces-no-color'); await s.press('enter');
    await s.waitFor('Which agents?'); await s.press('enter');
    await s.waitFor('all projects, or only this one?'); await s.press('enter');
    await s.waitFor('Turn on prompt hooks?'); await s.press('enter');
    await s.waitFor('Install now?'); await s.snap('review-no-color');
    await s.press('ctrlC');
    await s.exit();
    expect(!hasColor(s.raw), 'color codes printed with NO_COLOR=1 (F14)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F25: TERM=dumb gets line prompts ---------------------------------------------------------------
scenario('plain', ['F25'], async ({ expect }) => {
  const f = fixture('plain', { agents: ['claude'] });
  try {
    const s = f.term([], { env: { TERM: 'dumb' } });
    await s.waitFor('Where do you want Conquistador?'); await s.snap('plain-surfaces'); await s.press('enter');
    await s.waitFor('Which agents?'); await s.press('enter');
    await s.waitFor('all projects, or only this one?'); await s.press('enter');
    await s.waitFor('Turn on prompt hooks?'); await s.press('enter');
    await s.waitFor('Install now?'); await s.snap('plain-review'); await s.press('enter');
    await s.waitFor('Set up this project now?'); await s.type('2\r');
    await s.waitFor('What should we work on?'); await s.type('6\r');
    await s.waitFor('Summary'); await s.snap('plain-summary');
    const code = await s.exit();
    expect(code === 0, `exit ${code}`);
    expect(!/\x1b/.test(s.raw), 'escape codes printed with TERM=dumb (F25)');
    expect(f.json(join(f.home, '.conquistador/installs.json'))?.agents?.['claude-code'], 'plain flow did not install');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F15: a stale copy earlier on PATH --------------------------------------------------------------
scenario('shadowed', ['F15'], async ({ expect, transcript }) => {
  const f = fixture('shadowed', { agents: ['claude'], stale: '0.0.14' });
  try {
    const s = f.term([]);
    await s.waitFor('Where do you want Conquistador?');
    await s.snap('preflight-shadowed');
    const text = s.screen.text({ history: true });
    expect(has(text, '0.0.14') && has(text, version) && has(text, 'npm i -g @forsvn/conquistador@latest'), 'preflight does not name both versions and the fix (F15)');
    await s.press('ctrlC');
    await s.exit();
    const dry = f.run(['--dry-run']);
    transcript('shadowed-non-tty', `$ conquistador --dry-run   (exit ${dry.status})\n--- stderr ---\n${dry.stderr}--- stdout ---\n${dry.stdout}`);
    expect(has(dry.stderr, '0.0.14'), 'non-TTY run does not warn about the stale copy (F15)');
    return s.snaps;
  } finally { f.cleanup(); }
});

// --- F16, F23: offline, and the hosted surface when tools/login.mjs exists -------------------------
scenario('offline', ['F16'], async ({ expect }) => {
  const f = fixture('offline', { agents: ['claude'], login: true, env: { npm_config_registry: `${hanging.url}/`, CONQUISTADOR_HOSTED_URL: `${closed}/mcp` } });
  try {
    const started = Date.now();
    const s = f.term([]);
    await s.waitFor('Where do you want Conquistador?');
    const waited = Date.now() - started;
    await s.snap('surfaces-offline');
    const text = s.screen.text({ history: true });
    expect(waited < 6000, `the surfaces question took ${waited} ms offline (F16)`);
    expect(!/[◻◼□■\[]\s*\]?\s*Hosted MCP/.test(text) && has(text, 'Hosted MCP needs a network connection'), 'Hosted MCP offered offline, or no reason shown (F16)');
    expect(!has(text, 'is out'), 'update notice shown offline (F16)');
    await s.press('ctrlC');
    await s.exit();
    return s.snaps;
  } finally { f.cleanup(); }
});

scenario('hosted', ['F23'], async ({ expect }) => {
  const f = fixture('hosted', { agents: [], login: true });
  try {
    const s = f.term([]);
    await s.waitFor('Where do you want Conquistador?');
    await s.snap('surfaces-online');
    expect(has(s.screen.text(), 'Hosted MCP'), 'Hosted MCP not offered with tools/login.mjs present');
    // Options: Coding agents, MCP apps, Hosted MCP, Executor, Chat bots.
    await toggle(s, 2);
    await s.press('enter');
    await s.waitFor('Install now?'); await s.snap('review-hosted'); await s.press('enter');
    await s.waitFor('Summary'); await s.snap('summary-hosted');
    const code = await s.exit();
    const text = s.screen.text({ history: true });
    expect(code === 0, `exit ${code}`);
    expect(has(text, 'cq_test_token_123') && has(text, '/mcp') && has(text, 'octocat'), 'summary lacks the client config');
    expect(has(text, '9.9.9'), 'summary lacks the update notice from the registry');
    const cancel = fixture('hosted-cancel', { agents: [], login: true, env: { FAKE_LOGIN: 'cancel' } });
    try {
      const c = cancel.term(['--surface=hosted', '--yes']);
      await c.waitFor('Summary'); await c.snap('summary-hosted-cancelled');
      expect(await c.exit() === 1, 'a cancelled sign-in must not exit 0 (F23)');
      expect(has(c.screen.text({ history: true }), 'skipped'), 'cancelled sign-in not reported as skipped (F23)');
      return [...s.snaps, ...c.snaps];
    } finally { cancel.cleanup(); }
  } finally { f.cleanup(); }
});

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

// --- F18: old flags ----------------------------------------------------------------------------------
scenario('old-flags', ['F18'], async ({ expect, transcript }) => {
  const f = fixture('old-flags', { agents: ['claude'], apps: { 'claude-desktop': null } });
  try {
    const s = f.term(['--mcp']);
    await s.waitFor('Where do you want Conquistador?');
    await s.snap('old-flag-mcp');
    expect(has(s.screen.text({ history: true }), '--surface=mcp-apps'), '--mcp does not print the new flag');
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
  } finally { f.cleanup(); }
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
const report = { schema: 'conquistador.e2e-onboarding-v2/v1', createdAt: new Date().toISOString(), version, node: process.version, platform: process.platform, total: results.length, passed, results };
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'screens.html'), `${HTML_HEAD}\n${gallery.join('\n')}\n`);
writeFileSync(join(out, 'report.md'), [`# Onboarding v2 E2E: ${passed}/${results.length} pass`, '', `Run ${report.createdAt} on ${process.platform}, Node ${process.version}, Conquistador ${version}.`, '',
  '| Result | Scenario | Failure modes | Screens | Problems |', '| --- | --- | --- | --- | --- |',
  ...results.map(item => `| ${item.pass ? 'pass' : 'FAIL'} | ${item.name} | ${item.covers.join(', ')} | ${item.screens} | ${item.problems.join('; ').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 300)} |`), ''].join('\n'));
console.log(`\n${passed}/${results.length} pass. Report: ${join(out, 'report.md')}`);
process.exitCode = passed === results.length ? 0 : 1;
