// Real pinned Executor v2 runtime. No replay server, user profiles, or provider credentials.
// The failure contract is in docs/INSTALLATION-ACCEPTANCE.md.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, createConnection } from 'node:net';
import { createServer as httpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExecutorClient } from '../../hosts/executor/client.mjs';
import { createMcpRequestHandler } from '../../api/mcp.mjs';
import { executorV2Connection, createExecutorV2Api, openExecutorV2Mcp, registerExecutorV2Source, checkExecutorV2Source, removeExecutorV2Source } from '../executor-v2.mjs';
import { readiness, verify } from '../connect.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
if (argv.some((word, index) => word !== '--out' && argv[index - 1] !== '--out') ||
    argv.filter(word => word === '--out').length > 1 || argv.at(-1) === '--out') throw Error('Use --out DIR.');
const out = resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : join(root, 'dist/e2e/executor-v2'));
const work = await mkdtemp(join(tmpdir(), 'cq-executor-v2-'));
const binary = join(root, 'hosts/executor/node_modules/.bin/executor');
const results = [];
let child, stopped, port, playbooks;
const pause = ms => new Promise(done => setTimeout(done, ms));
async function record(name, run) {
  try { results.push({ name, pass: true, ...await run() }); }
  catch (error) { results.push({ name, pass: false, error: error.code ?? 'ACCEPTANCE_FAILED' }); }
}
function check(value, code) { if (!value) { const error = Error(code); error.code = code; throw error; } }
async function freePort() {
  const socket = createServer();
  await new Promise((done, fail) => socket.once('error', fail).listen(0, '127.0.0.1', done));
  const value = socket.address().port;
  await new Promise(done => socket.close(done));
  return value;
}
const env = { PATH: process.env.PATH, HOME: work, TMPDIR: work, EXECUTOR_DATA_DIR: join(work, 'data'),
  EXECUTOR_KEY_STORAGE: 'file', EXECUTOR_NO_UPDATE_CHECK: '1', DO_NOT_TRACK: '1', CI: '1' };
function cli(args) {
  const result = spawnSync(binary, args, { cwd: work, env, encoding: 'utf8', timeout: 90000, maxBuffer: 1024 * 1024 });
  check(!result.error && result.status === 0, 'EXECUTOR_COMMAND_FAILED');
  try { return JSON.parse(result.stdout); } catch { throw Object.assign(Error(), { code: 'EXECUTOR_JSON_REQUIRED' }); }
}
try {
  port = await freePort();
  env.EXECUTOR_PORT = String(port);
  env.EXECUTOR_HOST = `http://127.0.0.1:${port}`;
  child = spawn(binary, ['serve'], { cwd: work, env, detached: process.platform !== 'win32', stdio: 'ignore' });
  stopped = new Promise(done => child.once('close', done));
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const keys = JSON.parse(await readFile(join(env.EXECUTOR_DATA_DIR, 'keys.json'), 'utf8'));
      const value = keys.apiKey ?? keys.api_key;
      check(typeof value === 'string' && value.length >= 32, 'NATIVE_KEY_MISSING');
      const response = await fetch(`${env.EXECUTOR_HOST}/api/health`, { signal: AbortSignal.timeout(500), redirect: 'error' });
      if (response.status < 500) { env.EXECUTOR_API_KEY = value; ready = true; break; }
    } catch { /* Only native startup is retried. No write or tool call is replayed. */ }
    await pause(500);
  }
  check(ready, 'NATIVE_START_TIMEOUT');
  const config = { schema: 'conquistador.executor-connection/v1', endpoint: `${env.EXECUTOR_HOST}/mcp`,
    uiUrl: `${env.EXECUTOR_HOST}/`, authEnv: 'CONQUISTADOR_EXECUTOR_NATIVE' };
  await record('actual v2 MCP discovery includes the direct-call and describe tools', async () => {
    const client = await createExecutorClient(config, { env: { CONQUISTADOR_EXECUTOR_NATIVE: env.EXECUTOR_API_KEY } });
    const result = await client.probe();
    check(result.knownTools.includes('call') && result.knownTools.includes('describe'), 'V2_TOOLS_NOT_RECOGNIZED');
    return { ...result, providerCalls: 0 };
  });
  await record('the host reports its own exact app framework', async () => {
    const framework = cli(['apps', 'framework']);
    check(typeof framework.version === 'string' && /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(framework.version), 'FRAMEWORK_IDENTITY_INVALID');
    return { version: framework.version };
  });
  const handler = createMcpRequestHandler({ authorize: request => ['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress) });
  playbooks = httpServer(handler);
  await new Promise(done => playbooks.listen(0, '127.0.0.1', done));
  const sourceUrl = `http://127.0.0.1:${playbooks.address().port}/mcp`;
  const options = { env: { ...env, CONQUISTADOR_EXECUTOR_URL: env.EXECUTOR_HOST }, sourceUrl };
  let installed;
  await record('install an owned app from the real bundled Conquistador service', async () => {
    installed = await registerExecutorV2Source('Conquistador acceptance', options);
    check(installed.ok && installed.status === 'added', 'V2_INSTALL_FAILED');
    return { status: installed.status, accountRequired: installed.accountRequired };
  });
  if (installed?.ok) {
    const bound = { ...options, binding: installed.binding };
    await record('verify the exact owned deployment and repeat install without changes', async () => {
      check((await checkExecutorV2Source('Conquistador acceptance', bound)).ok, 'V2_CHECK_FAILED');
      check((await registerExecutorV2Source('Conquistador acceptance', bound)).status === 'unchanged', 'V2_INSTALL_NOT_IDEMPOTENT');
    });
    await record('real MCP discovery returns current app tool paths and descriptions', async () => {
      const session = await openExecutorV2Mcp(executorV2Connection(options.env));
      try {
        const search = await session.call('search', { query: 'conquistador_methods' });
        await mkdir(out, { recursive: true });
        await writeFile(join(out, 'discovery.json'), JSON.stringify(search, null, 2) + '\n');
        check(JSON.stringify(search).includes('conquistador_methods'), 'V2_APP_TOOL_NOT_FOUND');
        const found = search.items.find(item => item.path.endsWith('.conquistador_methods'));
        check(found, 'V2_APP_TOOL_NOT_FOUND');
        const described = await session.call('describe', { paths: [found.path] });
        await writeFile(join(out, 'description.json'), JSON.stringify(described, null, 2) + '\n');
        const response = await session.call('call', { calls: { path: found.path, input: {} } });
        await writeFile(join(out, 'tool-result.json'), JSON.stringify(response, null, 2) + '\n');
        check(JSON.stringify(response).includes('social'), 'V2_REAL_PLAYBOOK_READ_FAILED');
        const toolDefinitions = await session.listTools();
        await writeFile(join(out, 'meta-tools.json'), JSON.stringify(toolDefinitions, null, 2) + '\n');
        return { providerCalls: 0 };
      } finally { await session.close(); }
    });
    await record('capability verification reads real playbooks and invalidates changed schemas and credentials', async () => {
      const nativeEnv = { ...options.env, CONQUISTADOR_HOME: join(work, 'cq') };
      const tool = `tools[${JSON.stringify(installed.slug)}].conquistador_read`;
      const result = await verify({ capability: 'docs.read', tool, args: JSON.stringify({ path: 'conquistador/SKILL.md' }), env: nativeEnv });
      check(result.status === 'verified' && result.resultBytes > 1000, 'V2_CAPABILITY_READ_FAILED');
      check(result.providerVerified !== true, 'V2_PROVIDER_CLAIM_INVALID');
      const report = await readiness({ names: ['docs.read'], env: nativeEnv });
      check(report.executor.generation === 2, 'V2_CAPABILITY_WRONG_GENERATION');
      check(report.capabilities[0].state === 'verified', 'V2_READ_NOT_RECORDED');
      const denied = await verify({ capability: 'docs.read', tool: `tools[${JSON.stringify(installed.slug)}].delete`, args: '{}', env: nativeEnv }).catch(() => ({ status: 'failed' }));
      check(denied.status !== 'verified', 'V2_WRITE_VERIFY_ALLOWED');
      const changed = await readiness({ names: ['docs.read'], env: { ...nativeEnv, EXECUTOR_API_KEY: 'invalid-credential-for-isolated-acceptance' } });
      check(changed.capabilities[0].state !== 'verified', 'V2_STALE_AUTH_VERIFIED');
    });
    await record('source update keeps app identity and protects unowned or edited source', async () => {
      const request = createExecutorV2Api(executorV2Connection(options.env));
      const source = await request(`/apps/${installed.appId}/workspace`);
      const edited = source.files.map(file => file.path === 'index.ts' ? { ...file, content: file.content + '// user edit\n' } : file);
      await request(`/apps/${installed.appId}/commits`, { method: 'POST', body: { expected: source.revision.commit, files: edited, message: 'Acceptance: preserve a user edit' } });
      const refused = await registerExecutorV2Source('Conquistador acceptance', bound).catch(error => error.code);
      check(refused === 'EXECUTOR_APP_MODIFIED', 'V2_USER_EDIT_OVERWRITTEN');
      const current = await request(`/apps/${installed.appId}/workspace`);
      const marker = source.files.map(file => file.path === 'conquistador.json' ? { ...file, content: JSON.stringify({ ...JSON.parse(file.content), productVersion: '0.0.0' }) + '\n' } : file);
      await request(`/apps/${installed.appId}/commits`, { method: 'POST', body: { expected: current.revision.commit, files: marker, message: 'Acceptance: previous managed release' } });
      const updated = await registerExecutorV2Source('Conquistador acceptance', bound);
      check(updated.ok && updated.status === 'updated' && updated.appId === installed.appId && updated.binding.commit !== installed.binding.commit, 'V2_UPDATE_FAILED');
      installed = updated;
      bound.binding = updated.binding;
      const unowned = await request('/apps', { method: 'POST', body: { name: 'Unowned acceptance', files: [{ path: 'index.ts', content: 'export default {};\n' }] } });
      try {
        const guard = await registerExecutorV2Source('Unowned acceptance', options).catch(error => error.code);
        check(guard === 'EXECUTOR_APP_UNOWNED', 'V2_UNOWNED_APP_OVERWRITTEN');
        const removal = await removeExecutorV2Source('Unowned acceptance', options).catch(error => error.code);
        check(removal === 'EXECUTOR_APP_UNOWNED', 'V2_UNOWNED_APP_REMOVED');
      } finally { await request(`/apps/${unowned.id}`, { method: 'DELETE', sdk: true }); }
      return { status: updated.status, identityPreserved: true };
    });
    await record('removal affects only the owned app and is verified', async () => {
      check((await removeExecutorV2Source('Conquistador acceptance', bound)).removed, 'V2_REMOVE_FAILED');
      check((await removeExecutorV2Source('Conquistador acceptance', bound)).removed === false, 'V2_REMOVE_NOT_IDEMPOTENT');
    });
  }
} catch (error) { results.push({ name: 'native runtime setup', pass: false, error: error.code ?? 'NATIVE_SETUP_FAILED' }); }
finally {
  if (playbooks) { playbooks.closeAllConnections(); await new Promise(done => playbooks.close(done)); }
  if (child && child.exitCode === null && child.signalCode === null) {
    try { process.platform === 'win32' ? child.kill() : process.kill(-child.pid, 'SIGTERM'); } catch {}
    const timer = setTimeout(() => { try { process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL'); } catch {} }, 5000);
    await stopped;
    clearTimeout(timer);
  }
  await rm(work, { recursive: true, force: true });
  const closed = !port || await new Promise(done => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); done(value); };
    socket.once('connect', () => finish(false)).once('error', error => finish(error.code === 'ECONNREFUSED'));
    socket.setTimeout(1000, () => finish(false));
  });
  results.push({ name: 'process and temporary state removed', pass: closed });
}
const sourceHashes = Object.fromEntries(await Promise.all(['tools/e2e/executor-v2.mjs', 'hosts/executor/package.json',
  'hosts/executor/bun.lock', 'hosts/executor/client.mjs', 'tools/executor-v2.mjs', 'tools/executor-source.mjs',
  'tools/connect.mjs', 'tools/onboard.mjs'].map(async path => [path, createHash('sha256').update(await readFile(join(root, path))).digest('hex')])));
const report = { schema: 'conquistador.executor-v2-acceptance/v1', checkedAt: new Date().toISOString(),
  nativeRuntime: '2.0.0-beta.25', evidence: 'real-isolated-native-runtime', sourceHashes,
  total: results.length, passed: results.filter(result => result.pass).length, results };
await mkdir(out, { recursive: true });
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
for (const result of results) console.log(`${result.pass ? 'pass' : 'FAIL'} ${result.name}${result.error ? ` (${result.error})` : ''}`);
console.log(`${report.passed}/${report.total} pass. ${join(out, 'report.json')}`);
process.exitCode = report.passed === report.total ? 0 : 1;
