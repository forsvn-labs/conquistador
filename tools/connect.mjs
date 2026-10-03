// `conquistador connect`: which capabilities this user can reach through Executor.
// Conquistador names capabilities (crm.read, email.send); the user's own Executor integrations
// supply the tools. skills/conquistador/capabilities.json maps commands to capabilities and
// capabilities to search phrases; skills/conquistador/integrations/<capability>.md holds the
// provider hints. Both ship inside the skill, so skill-only installs have them too.
//
// Executor's CLI read commands start a folder-scoped daemon when no server answers, and that
// daemon does not show the user's integrations. So this file never runs an executor command
// until a server already answers /api/health, and it always passes that server's --base-url.
// Only an explicit, confirmed `connect` step installs or starts Executor.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { spawnCommand } from './spawn.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = 'skills/conquistador';
const DEFAULT_PORTS = [4788, 4789];
const PROBE_MS = 800;
const CALL_MS = 20_000;
const OUTPUT_LIMIT = 1_000_000;
const INSTALL_STEPS = ['npm install -g executor', 'executor install', 'executor web'];
const START_STEPS = ['Open Executor.app, or run: executor web'];

const HELP = `Usage:
  conquistador connect [--json] [CAPABILITY|COMMAND...]
  conquistador connect add
  conquistador connect verify CAPABILITY --tool PATH --args JSON [--json]

Shows which capabilities you can use through Executor: missing, connected, or verified.
Name capabilities (crm.read) or commands (launch) to check only what they use.
add opens the Executor web UI so you can add an integration.
verify runs one read-class tool and records the result in ~/.conquistador/connections.json.
Set CONQUISTADOR_EXECUTOR_URL to check one Executor server only.
`;

export function loadCapabilities(directory = root) {
  return JSON.parse(readFileSync(join(directory, SKILL, 'capabilities.json'), 'utf8'));
}

// The capability ids a command can use, in declared order. Unknown commands use none.
export function capabilitiesFor(command, map = loadCapabilities()) {
  return map.commands[command]?.uses ?? [];
}

const userHome = env => env.HOME || env.USERPROFILE || homedir();
const conquistadorHome = env => env.CONQUISTADOR_HOME || join(userHome(env), '.conquistador');
const executorData = env => env.EXECUTOR_DATA_DIR || join(userHome(env), '.executor');
export const connectionsPath = (env = process.env) => join(conquistadorHome(env), 'connections.json');

// Finds `executor` on PATH without running it.
export function findExecutor(env = process.env) {
  const path = Object.entries(env).find(([name]) => name.toUpperCase() === 'PATH')?.[1] ?? '';
  const names = process.platform === 'win32'
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean).map(ext => `executor${ext.toLowerCase()}`)
    : ['executor'];
  for (const folder of path.split(delimiter)) {
    if (!folder) continue;
    for (const name of names) {
      const file = join(folder, name);
      try { if (statSync(file).isFile()) return file; } catch { /* Not here. */ }
    }
  }
  return null;
}

// Executor writes daemon-<host>-<port>.json for each daemon and daemon-active-<host>-<hash>.json
// for each scope. Read only host, port, pid, and scope; the active records also hold a token,
// which this code never reads into its results.
function daemonRecords(env) {
  const folder = executorData(env);
  let names = [];
  try { names = readdirSync(folder); } catch { return []; }
  const records = [];
  for (const name of names) {
    if (!/^daemon-.+\.json$/.test(name)) continue;
    try {
      const record = JSON.parse(readFileSync(join(folder, name), 'utf8'));
      if (typeof record?.hostname !== 'string' || !Number.isInteger(record?.port)) continue;
      records.push({
        hostname: record.hostname,
        port: record.port,
        pid: Number.isInteger(record.pid) ? record.pid : null,
        scope: typeof record.scopeId === 'string' ? record.scopeId : null,
        startedAt: typeof record.startedAt === 'string' ? record.startedAt : '',
      });
    } catch { /* Skip a record that is being written or is not JSON. */ }
  }
  return records;
}

const originOf = (hostname, port) => `http://${hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname}:${port}`;

async function answers(origin, fetchImpl, timeout) {
  try {
    const response = await fetchImpl(new URL('/api/health', origin), { signal: AbortSignal.timeout(timeout), redirect: 'error' });
    return response.ok && (await response.text()).trim() === 'ok';
  } catch { return false; }
}

// Returns the Executor server that already answers, without starting one.
export async function findServer({ env = process.env, fetchImpl = fetch, baseUrl = env.CONQUISTADOR_EXECUTOR_URL, timeout = PROBE_MS } = {}) {
  const records = baseUrl ? [] : daemonRecords(env);
  const candidates = new Map();
  if (baseUrl) {
    const url = new URL(baseUrl);
    candidates.set(url.origin, { origin: url.origin, source: 'configured' });
  } else {
    for (const record of records) {
      const origin = originOf(record.hostname, record.port);
      if (!candidates.has(origin)) candidates.set(origin, { origin, source: 'daemon record', startedAt: record.startedAt });
    }
    for (const port of DEFAULT_PORTS) {
      const origin = originOf('localhost', port);
      if (!candidates.has(origin)) candidates.set(origin, { origin, source: 'default port', startedAt: '' });
    }
  }
  const checked = [...candidates.values()];
  const live = (await Promise.all(checked.map(async item => (await answers(item.origin, fetchImpl, timeout) ? item : null)))).filter(Boolean);
  if (!live.length) return { state: 'not-running', checked: checked.map(item => item.origin) };
  for (const item of live) {
    const port = Number(new URL(item.origin).port);
    const scoped = records.filter(record => record.scope && record.port === port).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    item.scope = scoped[0]?.scope ?? null;
    // A daemon that an executor CLI call started in some folder. It may not show the user's integrations.
    item.folderScoped = Boolean(item.scope?.startsWith('cwd:'));
  }
  live.sort((a, b) => Number(a.folderScoped) - Number(b.folderScoped) || (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  const { origin, source, scope, folderScoped } = live[0];
  return { state: 'running', origin, source, scope, folderScoped };
}

function collect(child, timeout) {
  return new Promise(done => {
    let stdout = '';
    let stderr = '';
    const add = (text, chunk) => (text.length < OUTPUT_LIMIT ? text + chunk : text);
    child.stdout?.setEncoding('utf8').on('data', chunk => { stdout = add(stdout, chunk); });
    child.stderr?.setEncoding('utf8').on('data', chunk => { stderr = add(stderr, chunk); });
    const timer = setTimeout(() => { try { child.kill(); } catch { /* Gone. */ } }, timeout);
    child.on('error', error => { clearTimeout(timer); done({ status: null, stdout, stderr: stderr + error.message }); });
    child.on('close', status => { clearTimeout(timer); done({ status, stdout, stderr }); });
  });
}

// Runs one executor CLI command against the server that already answers.
// words: subcommand words; positional: arguments; options follow them, as in
// `executor tools search "send email" --limit 5`.
export async function runExecutor(words, positional, { executor, server, env = process.env, timeout = CALL_MS, extra = [] }) {
  if (!executor) throw new Error('Executor is not installed.');
  if (server?.state !== 'running') throw new Error('Executor is not running.');
  const args = [...words, ...positional, '--base-url', server.origin, ...extra];
  const { file, args: fileArgs, options } = spawnCommand(executor, args, env);
  const child = spawn(file, fileArgs, {
    env: { ...env, NO_COLOR: '1', EXECUTOR_DISABLE_UPDATE_CHECK: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...options,
  });
  return collect(child, timeout);
}

// Executor 1.5.40 prints JSON: {"items":[...]} for tools search and tools integrations, and
// {"ok":true,"data":...} for call.
export function parseJson(text) {
  try { return JSON.parse(String(text ?? '').trim()); } catch { return null; }
}

const items = text => { const parsed = parseJson(text); return Array.isArray(parsed?.items) ? parsed.items : []; };
const BUILT_IN = new Set(['executor']);

// Tool search results: [{ path, integration, description }]. Executor's own tools are left out.
// An item: { path: "google_gmail.org.localGmailApi.gmail.users.messages.send", name, description, integration, score }.
export function parseTools(text) {
  return items(text)
    .filter(item => typeof item?.path === 'string')
    .map(item => ({ path: item.path, integration: typeof item.integration === 'string' ? item.integration : item.path.split('.')[0], description: typeof item.description === 'string' ? item.description : '' }))
    .filter(tool => !BUILT_IN.has(tool.integration));
}

// Configured integrations: [{ slug, tools }]. An item: { id: "anytype_mcp", name, kind, toolCount }.
export function parseIntegrations(text) {
  return items(text)
    .filter(item => typeof item?.id === 'string' && !BUILT_IN.has(item.id))
    .map(item => ({ slug: item.id, tools: Number.isInteger(item.toolCount) ? item.toolCount : null }));
}

const READ_VERBS = new Set(['get', 'list', 'search', 'query', 'read', 'fetch', 'find', 'retrieve', 'describe', 'run', 'report', 'export', 'count', 'lookup', 'stats', 'insights', 'history', 'view', 'show', 'aggregate', 'download', 'analytics', 'metrics', 'overview']);
const WRITE_VERBS = new Set(['create', 'update', 'delete', 'remove', 'send', 'post', 'publish', 'insert', 'upsert', 'write', 'set', 'add', 'patch', 'put', 'cancel', 'refund', 'archive', 'merge', 'assert', 'mutate', 'trigger', 'schedule', 'upload', 'pause', 'resume', 'enable', 'disable', 'invite', 'move', 'append', 'edit', 'replace', 'submit', 'charge', 'pay', 'transfer', 'reply', 'share', 'import', 'unsubscribe', 'subscribe']);

// Classifies a tool by its name: 'read', 'write', or 'unknown'. Names usually start or end with
// the verb (create_issue, issues.create, issueCreate, chat.postMessage).
export function toolClass(path) {
  const last = String(path).split(/[./]/).pop() ?? '';
  const words = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return 'unknown';
  const [first] = words;
  const final = words.at(-1);
  if (READ_VERBS.has(first)) return 'read';
  if (WRITE_VERBS.has(first) || WRITE_VERBS.has(final)) return 'write';
  if (READ_VERBS.has(final)) return 'read';
  // Prefixed names such as api_search_global: the verb sits in the middle.
  if (words.some(word => WRITE_VERBS.has(word))) return 'write';
  if (words.some(word => READ_VERBS.has(word))) return 'read';
  return 'unknown';
}

export function readConnections(env = process.env) {
  try {
    const data = JSON.parse(readFileSync(connectionsPath(env), 'utf8'));
    return data?.schema === 'conquistador.connections/v1' && data.verified && typeof data.verified === 'object' ? data : { schema: 'conquistador.connections/v1', verified: {} };
  } catch { return { schema: 'conquistador.connections/v1', verified: {} }; }
}

function writeConnections(data, env) {
  const file = connectionsPath(env);
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, file);
}

// Resolves arguments to capability ids. A command name selects the capabilities it uses.
export function selectCapabilities(names, map = loadCapabilities()) {
  if (!names.length) return Object.keys(map.capabilities);
  const selected = new Set();
  for (const name of names) {
    if (map.capabilities[name]) selected.add(name);
    else if (map.commands[name]) for (const id of map.commands[name].uses) selected.add(id);
    else throw new UsageError(`Unknown capability or command: ${name}. Run conquistador connect to see them.`);
  }
  return [...selected];
}

class UsageError extends Error {}

async function pool(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await work(items[index]); }
  }));
  return results;
}

// The readiness report. Never starts Executor.
export async function readiness({ names = [], env = process.env, fetchImpl = fetch, directory = root } = {}) {
  const map = loadCapabilities(directory);
  const ids = selectCapabilities(names, map);
  const executor = findExecutor(env);
  const server = executor ? await findServer({ env, fetchImpl }) : { state: 'not-installed' };
  const records = readConnections(env).verified;
  const report = {
    schema: 'conquistador.connect/v1',
    checkedAt: new Date().toISOString(),
    executor: { installed: Boolean(executor), path: executor, server },
    integrations: [],
    capabilities: [],
    next: [],
  };
  // recipe is relative to the skill folder (skills/conquistador in the package).
  const base = id => ({ id, class: map.capabilities[id].class, description: map.capabilities[id].description, recipe: `integrations/${id}.md` });
  if (!executor) {
    report.capabilities = ids.map(id => ({ ...base(id), state: 'missing', integrations: [], tools: [] }));
    report.next.push('Install Executor: npm install -g executor, then executor install. Or run conquistador connect in a terminal and accept the install.');
    return report;
  }
  if (server.state !== 'running') {
    report.capabilities = ids.map(id => ({ ...base(id), state: 'unknown', integrations: [], tools: [], ...(records[id] ? { verifiedAt: records[id].verifiedAt } : {}) }));
    report.next.push('Executor is not running. Open Executor.app, or run executor web. Then run conquistador connect again.');
    return report;
  }
  if (server.folderScoped) report.next.push(`The Executor server at ${server.origin} was started for one folder (${server.scope}). It may not show your integrations. Open Executor.app, or run executor web.`);
  const listed = await runExecutor(['tools', 'integrations'], [], { executor, server, env });
  report.integrations = listed.status === 0 ? parseIntegrations(listed.stdout) : [];
  if (listed.status !== 0) report.executor.error = firstLine(listed.stderr || listed.stdout) || 'executor tools integrations failed';
  const configured = new Set(report.integrations.map(item => item.slug));
  report.capabilities = await pool(ids, 4, async id => {
    const capability = map.capabilities[id];
    let tools = [];
    for (const phrase of capability.search) {
      const result = await runExecutor(['tools', 'search'], [phrase], { executor, server, env, extra: ['--limit', '8'] });
      if (result.status !== 0) continue;
      tools = parseTools(result.stdout)
        .filter(tool => !configured.size || configured.has(tool.integration))
        .filter(tool => (capability.class === 'write' ? toolClass(tool.path) === 'write' : toolClass(tool.path) !== 'write'));
      if (tools.length) break;
    }
    const integrations = [...new Set(tools.map(tool => tool.integration))];
    const record = records[id];
    const verified = record && (integrations.includes(record.integration) || configured.has(record.integration));
    return {
      ...base(id),
      state: verified ? 'verified' : tools.length ? 'connected' : 'missing',
      integrations,
      tools: tools.slice(0, 3).map(tool => tool.path),
      ...(record ? { verifiedAt: record.verifiedAt, verifiedTool: record.tool } : {}),
    };
  });
  if (report.capabilities.some(item => item.state === 'missing')) report.next.push('Add an integration for a missing capability: conquistador connect add. The recipe in skills/conquistador/integrations/<capability>.md names common providers.');
  const unverified = report.capabilities.find(item => item.state === 'connected' && item.class === 'read');
  if (unverified) report.next.push(`Verify one read: conquistador connect verify ${unverified.id} --tool ${unverified.tools[0]} --args '<json from executor tools describe>'`);
  return report;
}

const firstLine = text => String(text ?? '').split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? '';

// Runs one read-class tool and records that the capability works. Records no payload and no arguments.
export async function verify({ capability, tool, args, env = process.env, fetchImpl = fetch, directory = root }) {
  const map = loadCapabilities(directory);
  const spec = map.capabilities[capability];
  if (!spec) throw new UsageError(`Unknown capability: ${capability}.`);
  if (spec.class !== 'read') throw new UsageError(`${capability} is a write capability. verify runs read-class tools only.`);
  if (typeof tool !== 'string' || !/^[A-Za-z0-9_$-]+(?:[./][A-Za-z0-9_$-]+)+$/.test(tool)) throw new UsageError('Give --tool as the tool path from executor tools search, for example hubspot.contacts.search.');
  const kind = toolClass(tool);
  if (kind !== 'read') throw new UsageError(`${tool} does not read (its name says ${kind === 'write' ? 'it changes data' : 'nothing about what it does'}). Pick a tool whose name starts or ends with get, list, search, or query.`);
  let input;
  try { input = JSON.parse(args ?? '{}'); } catch { throw new UsageError('--args must be JSON.'); }
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new UsageError('--args must be a JSON object.');
  const executor = findExecutor(env);
  if (!executor) return { status: 'failed', capability, tool, reason: 'Executor is not installed.' };
  const server = await findServer({ env, fetchImpl });
  if (server.state !== 'running') return { status: 'failed', capability, tool, reason: 'Executor is not running. Open Executor.app, or run executor web.' };
  // The full dotted path is one argument: executor call <path> '<json>'.
  const result = await runExecutor(['call'], [tool, JSON.stringify(input)], { executor, server, env, timeout: 60_000 });
  const output = `${result.stdout}\n${result.stderr}`;
  const execution = /\bexec_[A-Za-z0-9_-]+/.exec(output)?.[0];
  if (execution && /paus|approv|auth|resume/i.test(output)) {
    return { status: 'paused', capability, tool, execution, reason: `Executor paused the call for sign-in or approval. Finish it in Executor, then run: executor resume --execution-id ${execution} --base-url ${server.origin}` };
  }
  const parsed = parseJson(result.stdout);
  if (result.status !== 0 || parsed?.ok !== true) {
    const detail = typeof parsed?.error === 'string' ? parsed.error : parsed?.error?.message;
    return { status: 'failed', capability, tool, reason: detail || firstLine(result.stderr || result.stdout) || `executor call exited with ${result.status}` };
  }
  const verifiedAt = new Date().toISOString();
  const integration = tool.split(/[./]/)[0];
  const data = readConnections(env);
  data.verified[capability] = {
    tool,
    integration,
    verifiedAt,
    argsDigest: createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16),
    resultBytes: Buffer.byteLength(result.stdout),
  };
  writeConnections(data, env);
  return { status: 'verified', capability, tool, integration, verifiedAt, resultBytes: Buffer.byteLength(result.stdout), recordedIn: connectionsPath(env) };
}

async function ask(question, { stdin = process.stdin, stdout = process.stdout } = {}) {
  const rl = createInterface({ input: stdin, output: stdout });
  try { return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim()); } finally { rl.close(); }
}

function runInherited(command, args, env) {
  const { file, args: fileArgs, options } = spawnCommand(command, args, env);
  return new Promise(done => {
    const child = spawn(file, fileArgs, { env, stdio: 'inherit', ...options });
    child.on('error', () => done(1));
    child.on('close', status => done(status ?? 1));
  });
}

// Starts Executor's web UI after the user confirmed it, then waits until a server answers.
async function startExecutor({ executor, env, fetchImpl, stdout }) {
  const { file, args, options } = spawnCommand(executor, ['web'], env);
  const child = spawn(file, args, { env, stdio: 'ignore', detached: true, ...options });
  child.on('error', () => {});
  child.unref();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const server = await findServer({ env, fetchImpl });
    if (server.state === 'running') return server;
    await new Promise(done => setTimeout(done, 500));
  }
  stdout.write('Executor did not answer within 15 seconds. Open Executor.app, or run executor web, then try again.\n');
  return { state: 'not-running' };
}

function openUrl(url, env) {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? [env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'start', '', url]]
      : ['xdg-open', [url]];
  return new Promise(done => {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => done(false));
    child.on('spawn', () => { child.unref(); done(true); });
  });
}

const interactive = io => Boolean(io.stdin.isTTY && io.stdout.isTTY);

// Offers to install Executor (TTY only). Returns the executor path or null.
async function offerInstall(io, env) {
  if (!interactive(io)) {
    io.stdout.write(`Executor is not installed. Install it:\n${INSTALL_STEPS.map(step => `  ${step}`).join('\n')}\n`);
    return null;
  }
  io.stdout.write('Executor holds your integrations and credentials outside the agent. Conquistador uses it to read your data and, with your approval, to act.\n');
  if (!(await ask('Install Executor now? This runs npm install -g executor, then executor install (a background service).', io))) {
    io.stdout.write(`Skipped. To install later:\n${INSTALL_STEPS.map(step => `  ${step}`).join('\n')}\n`);
    return null;
  }
  if (await runInherited('npm', ['install', '-g', 'executor'], env) !== 0) { io.stdout.write('npm install -g executor failed. Fix the error above, then run conquistador connect again.\n'); return null; }
  const executor = findExecutor(env);
  if (!executor) { io.stdout.write('Executor installed, but it is not on PATH. Open a new terminal, then run conquistador connect again.\n'); return null; }
  if (await runInherited(executor, ['install'], env) !== 0) { io.stdout.write('executor install failed. Fix the error above, then run conquistador connect again.\n'); return null; }
  return executor;
}

async function offerStart(io, executor, env, fetchImpl) {
  if (!interactive(io)) { io.stdout.write(`Executor is not running. ${START_STEPS[0]}\n`); return { state: 'not-running' }; }
  if (!(await ask('Executor is not running. Start it now with executor web?', io))) { io.stdout.write(`${START_STEPS[0]}\n`); return { state: 'not-running' }; }
  return startExecutor({ executor, env, fetchImpl, stdout: io.stdout });
}

const STATE_ORDER = { verified: 0, connected: 1, unknown: 2, missing: 3 };

export function renderReport(report) {
  const lines = [];
  const { executor } = report;
  if (!executor.installed) lines.push('Executor: not installed');
  else if (executor.server.state !== 'running') lines.push('Executor: not running');
  else lines.push(`Executor: running at ${executor.server.origin}`);
  if (report.integrations.length) lines.push(`Integrations: ${report.integrations.map(item => (item.tools === null ? item.slug : `${item.slug} (${item.tools} tools)`)).join(', ')}`);
  lines.push('');
  const rows = [...report.capabilities].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.id.localeCompare(b.id));
  const width = Math.max(10, ...rows.map(row => row.id.length)) + 2;
  lines.push(`${'Capability'.padEnd(width)}${'State'.padEnd(11)}Through`);
  for (const row of rows) {
    const through = row.state === 'verified' ? `${row.verifiedTool} (${row.verifiedAt.slice(0, 10)})` : row.integrations.join(', ') || '-';
    lines.push(`${row.id.padEnd(width)}${row.state.padEnd(11)}${through}`);
  }
  if (report.next.length) lines.push('', 'Next:', ...report.next.map(step => `- ${step}`));
  return `${lines.join('\n')}\n`;
}

function parseFlags(argv, allowed) {
  const flags = {};
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') { flags.json = true; continue; }
    const [name, inline] = arg.startsWith('--') ? arg.split(/=(.*)/s) : [arg];
    if (allowed.includes(name)) {
      const value = inline ?? argv[++index];
      if (value === undefined) throw new UsageError(`Missing value for ${name}.`);
      flags[name.slice(2)] = value;
    } else if (arg.startsWith('-')) throw new UsageError(`Unknown option: ${arg}.`);
    else rest.push(arg);
  }
  return { flags, rest };
}

export async function runConnect(argv, { stdin = process.stdin, stdout = process.stdout, stderr = process.stderr, env = process.env, fetchImpl = fetch } = {}) {
  const io = { stdin, stdout };
  try {
    if (argv.some(arg => ['--help', '-h', 'help'].includes(arg))) { stdout.write(HELP); return 0; }
    const [action] = argv;
    if (action === 'verify') {
      const { flags, rest } = parseFlags(argv.slice(1), ['--tool', '--args']);
      if (rest.length !== 1 || !flags.tool) throw new UsageError('Usage: conquistador connect verify CAPABILITY --tool PATH --args JSON');
      const result = await verify({ capability: rest[0], tool: flags.tool, args: flags.args, env, fetchImpl });
      if (flags.json) stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      else if (result.status === 'verified') stdout.write(`Verified ${result.capability} through ${result.tool} (${result.resultBytes} bytes read). Recorded in ${result.recordedIn}.\n`);
      else stdout.write(`${result.status === 'paused' ? 'Paused' : 'Not verified'}: ${result.reason}\n`);
      return result.status === 'verified' ? 0 : 1;
    }
    if (action === 'add') {
      const { rest } = parseFlags(argv.slice(1), []);
      if (rest.length) throw new UsageError('Usage: conquistador connect add');
      let executor = findExecutor(env) ?? await offerInstall(io, env);
      if (!executor) return 0;
      let server = await findServer({ env, fetchImpl });
      if (server.state !== 'running') server = await offerStart(io, executor, env, fetchImpl);
      if (server.state !== 'running') return 0;
      const opened = await openUrl(server.origin, env);
      stdout.write(`${opened ? 'Opened' : 'Open'} ${server.origin} . Choose Add Integration, then sign in to the provider there. Never paste keys into chat.\nThen run conquistador connect to see what is connected.\n`);
      return 0;
    }
    const { flags, rest } = parseFlags(argv, []);
    const names = rest;
    selectCapabilities(names);
    if (!flags.json && !findExecutor(env)) {
      await offerInstall(io, env);
    } else if (!flags.json && interactive(io)) {
      const executor = findExecutor(env);
      const server = await findServer({ env, fetchImpl });
      if (server.state !== 'running') await offerStart(io, executor, env, fetchImpl);
    }
    const report = await readiness({ names, env, fetchImpl });
    stdout.write(flags.json ? `${JSON.stringify(report, null, 2)}\n` : renderReport(report));
    return 0;
  } catch (error) {
    if (error instanceof UsageError) { stderr.write(`${error.message}\n`); return 2; }
    stderr.write(`conquistador connect: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runConnect(process.argv.slice(2));
