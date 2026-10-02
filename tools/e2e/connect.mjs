// Connect E2E: `conquistador connect` against the real local Executor, as users run it.
// Offline cases always run. They never start Executor: one runs with `executor` off PATH, one
// points at a port where nothing listens and checks that no daemon record or listener appears.
// Live cases run only with --live and need a running Executor (Executor.app or `executor web`).
//   node tools/e2e/connect.mjs [--out DIR] [--json]
//   node tools/e2e/connect.mjs --live [--verify CAPABILITY --tool PATH --args JSON]
// Live verify runs one read-class tool. It records to an isolated CONQUISTADOR_HOME.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnCommand } from '../spawn.mjs';
import { findExecutor, findServer, toolClass } from '../connect.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = join(root, 'runtime/bin/conquistador.js');
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const out = resolve(option('--out', join(root, 'dist/e2e/connect')));
const live = args.includes('--live');
const STATES = new Set(['missing', 'connected', 'verified', 'unknown']);

// Every command from docs/OVERHAUL-2026-10.md D2.
const SKILLS = 'position brand pricing channels budget funnel diagnose prioritize shape decide campaign event copy social outreach article video ads creative ideas vietnamese seo convert audit critique factcheck measure results watch flow ui architect build docs feedback'.split(' ');
const PLAYS = 'launch gtm plan landing lifecycle referral outbound press content series paid expand answers pseo report trailer appstore qa interactive experiment spec'.split(' ');
const META = 'init pin unpin check connect review doctor'.split(' ');

const scratch = mkdtempSync(join(tmpdir(), 'conquistador-connect-'));
const cases = [];
function record(id, run) {
  const started = Date.now();
  try {
    const result = run();
    const problems = result?.problems ?? [];
    cases.push({ id, status: result?.notRun ? 'not run' : problems.length ? 'fail' : 'pass', problems, ...(result?.notRun ? { reason: result.notRun } : {}), ...(result?.facts ? { facts: result.facts } : {}), ms: Date.now() - started });
  } catch (error) {
    cases.push({ id, status: 'fail', problems: [error.message], ms: Date.now() - started });
  }
}

function conquistador(argv, env) {
  const { file, args: fileArgs, options } = spawnCommand(process.execPath, [cli, ...argv], env);
  const result = spawnSync(file, fileArgs, { env, encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function isolatedEnv(name, extra = {}) {
  const home = join(scratch, name, 'home');
  mkdirSync(home, { recursive: true });
  return {
    HOME: home,
    USERPROFILE: home,
    CONQUISTADOR_HOME: join(home, '.conquistador'),
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    ...extra,
  };
}

function shapeProblems(report) {
  const problems = [];
  if (report.schema !== 'conquistador.connect/v1') problems.push(`schema is ${report.schema}`);
  if (typeof report.checkedAt !== 'string') problems.push('checkedAt missing');
  if (typeof report.executor?.installed !== 'boolean') problems.push('executor.installed missing');
  if (typeof report.executor?.server?.state !== 'string') problems.push('executor.server.state missing');
  for (const key of ['integrations', 'capabilities', 'next']) if (!Array.isArray(report[key])) problems.push(`${key} is not a list`);
  for (const item of report.capabilities ?? []) {
    if (!STATES.has(item.state)) problems.push(`${item.id}: state ${item.state}`);
    if (!['read', 'write'].includes(item.class)) problems.push(`${item.id}: class ${item.class}`);
    if (!Array.isArray(item.integrations) || !Array.isArray(item.tools)) problems.push(`${item.id}: integrations or tools missing`);
    if (!existsSync(join(root, item.recipe ?? ''))) problems.push(`${item.id}: recipe ${item.recipe} missing`);
  }
  if (JSON.stringify(report).match(/token|secret|password|apikey/i)) problems.push('report mentions a credential field');
  return problems;
}

const json = text => { try { return JSON.parse(text); } catch { return null; } };

async function freePort() {
  return new Promise((done, fail) => {
    const server = createServer();
    server.on('error', fail);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => done(port)); });
  });
}

async function listening(port) {
  return new Promise(done => {
    const server = createServer();
    server.once('error', () => done(true));
    server.listen(port, '127.0.0.1', () => server.close(() => done(false)));
  });
}

const daemonFiles = folder => { try { return readdirSync(folder).filter(name => name.startsWith('daemon-')).sort(); } catch { return []; } };

// 1. The capability map covers every command, every capability has a recipe, and the connect
// command's table matches the map.
record('contract', () => {
  const problems = [];
  const map = JSON.parse(readFileSync(join(root, 'capabilities.json'), 'utf8'));
  for (const [id, spec] of Object.entries(map.capabilities)) {
    if (!/^[a-z-]+\.[a-z]+$/.test(id)) problems.push(`${id}: id format`);
    if (!['read', 'write'].includes(spec.class)) problems.push(`${id}: class`);
    if (!spec.description) problems.push(`${id}: description`);
    if (!Array.isArray(spec.search) || !spec.search.length) problems.push(`${id}: search phrases`);
    if (!existsSync(join(root, 'integrations', `${id}.md`))) problems.push(`${id}: recipe missing`);
  }
  for (const command of [...SKILLS, ...PLAYS, ...META]) if (!map.commands[command]) problems.push(`command ${command} not mapped`);
  for (const [command, spec] of Object.entries(map.commands)) {
    if (![...SKILLS, ...PLAYS, ...META].includes(command)) problems.push(`command ${command} is not in D2`);
    for (const id of spec.uses) if (!map.capabilities[id]) problems.push(`${command}: unknown capability ${id}`);
  }
  const table = readFileSync(join(root, 'skills/conquistador/commands/connect/COMMAND.md'), 'utf8');
  for (const id of Object.keys(map.capabilities)) if (!table.includes(`| \`${id}\` |`)) problems.push(`COMMAND.md table lacks ${id}`);
  return { problems, facts: { capabilities: Object.keys(map.capabilities).length, commands: Object.keys(map.commands).length } };
});

// 2. `executor` is not on PATH.
record('no-executor-on-path', () => {
  const bin = join(scratch, 'empty-bin');
  mkdirSync(bin, { recursive: true });
  const env = isolatedEnv('no-executor', { PATH: bin });
  const problems = [];
  const run = conquistador(['connect', '--json'], env);
  const report = json(run.stdout);
  if (run.status !== 0) problems.push(`exit ${run.status}: ${run.stderr.trim()}`);
  if (!report) return { problems: [...problems, 'output is not JSON'] };
  problems.push(...shapeProblems(report));
  if (report.executor.installed !== false) problems.push('executor reported as installed');
  if (report.executor.server.state !== 'not-installed') problems.push(`server state ${report.executor.server.state}`);
  if (report.capabilities.some(item => item.state !== 'missing')) problems.push('a capability is not missing');
  if (!report.next.some(step => step.includes('npm install -g executor'))) problems.push('no install step');
  const text = conquistador(['connect'], env);
  if (text.status !== 0 || !text.stdout.includes('executor install')) problems.push('text output lacks the install steps');
  const verify = conquistador(['connect', 'verify', 'crm.read', '--tool', 'hubspot.contacts.search', '--args', '{}'], env);
  if (verify.status !== 1) problems.push(`verify exit ${verify.status}, expected 1`);
  if (existsSync(join(env.CONQUISTADOR_HOME, 'connections.json'))) problems.push('verify wrote connections.json');
  return { problems, facts: { capabilities: report.capabilities.length } };
});

// 3. Executor is installed but no server answers. Nothing may start one.
const executorPath = findExecutor(process.env);
const port = await freePort();
record('not-running-starts-nothing', () => {
  if (!executorPath) return { notRun: 'executor is not on PATH on this machine' };
  const data = join(scratch, 'not-running', 'executor-data');
  mkdirSync(data, { recursive: true });
  const env = isolatedEnv('not-running', { PATH: process.env.PATH, EXECUTOR_DATA_DIR: data, CONQUISTADOR_EXECUTOR_URL: `http://127.0.0.1:${port}` });
  const problems = [];
  const run = conquistador(['connect', '--json', 'launch'], env);
  const report = json(run.stdout);
  if (run.status !== 0) problems.push(`exit ${run.status}: ${run.stderr.trim()}`);
  if (!report) return { problems: [...problems, 'output is not JSON'] };
  problems.push(...shapeProblems(report));
  if (report.executor.installed !== true) problems.push('executor not detected on PATH');
  if (report.executor.server.state !== 'not-running') problems.push(`server state ${report.executor.server.state}`);
  if (report.capabilities.some(item => item.state !== 'unknown')) problems.push('a capability is not unknown');
  const map = JSON.parse(readFileSync(join(root, 'capabilities.json'), 'utf8'));
  if (report.capabilities.map(item => item.id).join() !== map.commands.launch.uses.join()) problems.push('launch did not select its capabilities');
  if (!report.next.some(step => step.includes('executor web'))) problems.push('no start step');
  const add = conquistador(['connect', 'add'], env);
  if (add.status !== 0 || !add.stdout.includes('not running')) problems.push('connect add did not report not running');
  const verify = conquistador(['connect', 'verify', 'crm.read', '--tool', 'hubspot.contacts.search', '--args', '{}'], env);
  if (verify.status !== 1 || !verify.stdout.includes('not running')) problems.push('verify did not report not running');
  if (existsSync(join(env.CONQUISTADOR_HOME, 'connections.json'))) problems.push('verify wrote connections.json');
  if (readdirSync(data).length) problems.push(`Executor wrote ${readdirSync(data).join(', ')}`);
  return { problems, facts: { checked: report.executor.server.checked } };
});
if (await listening(port)) cases.find(item => item.id === 'not-running-starts-nothing')?.problems.push(`something listens on ${port}`);

// 4. Guards: writes are never verified, and bad input is a usage error.
record('verify-guards', () => {
  const env = isolatedEnv('guards', { PATH: join(scratch, 'empty-bin') });
  const problems = [];
  const expect = (argv, status, text) => {
    const run = conquistador(argv, env);
    if (run.status !== status || !run.stderr.includes(text)) problems.push(`${argv.join(' ')}: exit ${run.status}, ${run.stderr.trim()}`);
  };
  expect(['connect', 'verify', 'ads.write', '--tool', 'meta.campaigns.list', '--args', '{}'], 2, 'write capability');
  expect(['connect', 'verify', 'crm.read', '--tool', 'hubspot.contacts.create', '--args', '{}'], 2, 'does not read');
  expect(['connect', 'verify', 'social.read', '--tool', 'x.tweets.create', '--args', '{}'], 2, 'does not read');
  expect(['connect', 'verify', 'crm.read', '--tool', 'hubspot.contacts.search', '--args', '{bad'], 2, 'must be JSON');
  expect(['connect', 'verify', 'nope.read', '--tool', 'a.b', '--args', '{}'], 2, 'Unknown capability');
  expect(['connect', 'nope'], 2, 'Unknown capability or command');
  expect(['connect', '--colour'], 2, 'Unknown option');
  for (const [path, kind] of [['hubspot.crm.contacts.search', 'read'], ['linear.issueCreate', 'write'], ['slack.chat.postMessage', 'write'], ['x.get_post', 'read'], ['ga4.properties.runReport', 'read'], ['stripe.subscriptions.list', 'read'], ['resend.emails.send', 'write']]) {
    if (toolClass(path) !== kind) problems.push(`toolClass(${path}) is ${toolClass(path)}, expected ${kind}`);
  }
  return { problems };
});

// 5. Live: readiness against the user's running Executor. Uses the real Executor data folder,
// an isolated Conquistador home, and checks that no new daemon appears.
const executorData = process.env.EXECUTOR_DATA_DIR || join(homedir(), '.executor');
const server = live && executorPath ? await findServer({ env: process.env }) : null;
let liveReport = null;
record('live-readiness', () => {
  if (!live) return { notRun: 'run with --live after Executor.app or executor web is running' };
  if (!executorPath) return { notRun: 'executor is not on PATH' };
  if (server.state !== 'running') return { notRun: 'no Executor server answers; open Executor.app or run executor web' };
  const before = daemonFiles(executorData);
  const env = { ...process.env, CONQUISTADOR_HOME: join(scratch, 'live', '.conquistador') };
  const run = conquistador(['connect', '--json'], env);
  liveReport = json(run.stdout);
  const problems = [];
  if (run.status !== 0) problems.push(`exit ${run.status}: ${run.stderr.trim()}`);
  if (!liveReport) return { problems: [...problems, 'output is not JSON'] };
  problems.push(...shapeProblems(liveReport));
  const connected = liveReport.capabilities.filter(item => item.state === 'connected' || item.state === 'verified');
  if (!connected.length) problems.push('no capability is connected');
  const after = daemonFiles(executorData);
  if (after.join() !== before.join()) problems.push(`daemon records changed: ${after.filter(name => !before.includes(name)).join(', ') || 'removed'}`);
  return {
    problems,
    facts: {
      server: { origin: server.origin, folderScoped: server.folderScoped },
      integrations: liveReport.integrations.map(item => item.slug),
      connected: connected.map(item => ({ id: item.id, through: item.integrations })),
    },
  };
});

// 6. Live: one verify with a real read-class tool.
record('live-verify', () => {
  if (!live) return { notRun: 'run with --live --verify CAPABILITY --tool PATH --args JSON' };
  if (!option('--verify')) return { notRun: 'pass --verify CAPABILITY --tool PATH --args JSON with a read-class tool' };
  if (!liveReport) return { notRun: 'live readiness did not run' };
  const home = join(scratch, 'live', '.conquistador');
  const env = { ...process.env, CONQUISTADOR_HOME: home };
  const run = conquistador(['connect', 'verify', option('--verify'), '--tool', option('--tool'), '--args', option('--args', '{}'), '--json'], env);
  const result = json(run.stdout);
  const problems = [];
  if (run.status !== 0 || result?.status !== 'verified') problems.push(`verify: exit ${run.status}, ${result?.reason ?? run.stderr.trim()}`);
  const saved = json(existsSync(join(home, 'connections.json')) ? readFileSync(join(home, 'connections.json'), 'utf8') : '');
  const entry = saved?.verified?.[option('--verify')];
  if (!entry) problems.push('connections.json has no record');
  else if (Object.keys(entry).sort().join() !== 'argsDigest,integration,resultBytes,tool,verifiedAt') problems.push(`record keys: ${Object.keys(entry).join(', ')}`);
  const again = json(conquistador(['connect', '--json', option('--verify')], env).stdout);
  if (again?.capabilities?.[0]?.state !== 'verified') problems.push(`readiness after verify: ${again?.capabilities?.[0]?.state}`);
  return { problems, facts: { capability: option('--verify'), tool: option('--tool'), resultBytes: entry?.resultBytes } };
});

rmSync(scratch, { recursive: true, force: true });
const summary = {
  schema: 'conquistador.e2e-connect/v1',
  ranAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  executor: executorPath ? 'on PATH' : 'not on PATH',
  live,
  pass: cases.filter(item => item.status === 'pass').length,
  fail: cases.filter(item => item.status === 'fail').length,
  notRun: cases.filter(item => item.status === 'not run').length,
  cases,
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report.json'), `${JSON.stringify(summary, null, 2)}\n`);
const lines = ['# Connect E2E', '', `Ran ${summary.ranAt} on ${summary.platform}, Node ${summary.node}. Executor ${summary.executor}. Live: ${live ? 'yes' : 'no'}.`, '', `Pass ${summary.pass}, fail ${summary.fail}, not run ${summary.notRun}.`, '', '| Case | Status | Detail |', '| --- | --- | --- |'];
for (const item of cases) lines.push(`| ${item.id} | ${item.status} | ${(item.problems.length ? item.problems.join('; ') : item.reason ?? (item.facts ? JSON.stringify(item.facts) : '')).replace(/\|/g, '\\|')} |`);
writeFileSync(join(out, 'report.md'), `${lines.join('\n')}\n`);
if (args.includes('--json')) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
else process.stdout.write(`${lines.join('\n')}\n\nReport: ${join(out, 'report.md')}\n`);
process.exitCode = summary.fail ? 1 : 0;
