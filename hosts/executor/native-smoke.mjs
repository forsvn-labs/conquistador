// Explicit native integration smoke. No provider connections or tool calls.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExecutorClient } from './client.mjs';

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

const directory = await mkdtemp(join(tmpdir(), 'conquistador-executor-native-'));
let child;
let exited;
let failure = false;
let port;
try {
  if (process.platform === 'win32') throw new Error('POSIX_PROCESS_GROUP_REQUIRED');
  port = await freePort();
  // No ambient provider credentials or Executor profiles. DO_NOT_TRACK also
  // disables integrations.sh catalog fetches and crash reporting in Executor.
  child = spawn(process.execPath, [fileURLToPath(new URL('./node_modules/executor/bin/executor', import.meta.url)),
    'web', '--foreground', '--hostname', '127.0.0.1', '--port', String(port), '--scope', directory], {
    cwd: directory,
    detached: true,
    env: { PATH: process.env.PATH, EXECUTOR_DATA_DIR: directory, EXECUTOR_SCOPE_DIR: directory,
      DO_NOT_TRACK: '1', EXECUTOR_DISABLE_ANALYTICS: '1', EXECUTOR_DISABLE_UPDATE_CHECK: '1' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  exited = new Promise(resolve => child.once('exit', resolve));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('NATIVE_START_TIMEOUT')), 20000);
    let tail = '';
    child.stdout.on('data', chunk => {
      // Upstream prints a bearer in its startup output. Never retain full logs.
      tail = (tail + chunk.toString()).slice(-4096);
      if (tail.includes('Executor is ready.')) { tail = ''; clearTimeout(timeout); resolve(); }
    });
    child.once('error', () => { clearTimeout(timeout); reject(new Error('NATIVE_START_FAILED')); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('NATIVE_EXIT_BEFORE_READY')); });
  });
  const { token } = JSON.parse(await readFile(join(directory, 'server-control/auth.json'), 'utf8'));
  const client = await createExecutorClient({ schema: 'conquistador.executor-connection/v1',
    endpoint: `http://127.0.0.1:${port}/mcp`, uiUrl: `http://127.0.0.1:${port}/`,
    authEnv: 'CONQUISTADOR_EXECUTOR_NATIVE_SMOKE' }, { env: { CONQUISTADOR_EXECUTOR_NATIVE_SMOKE: token } });
  const result = await client.probe();
  const { version } = JSON.parse(await readFile(new URL('./node_modules/executor/package.json', import.meta.url), 'utf8'));
  process.stdout.write(JSON.stringify({ nativeExecutorVersion: version, ...result, providerCalls: 0 }) + '\n');
} catch {
  failure = true;
  // Native startup errors and config may contain tokens. Do not print them.
  process.stderr.write('Native Executor smoke failed before verified discovery.\n');
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
      if (error.code !== 'ESRCH') failure = true;
    }
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 5000);
    await exited;
    clearTimeout(timer);
  }
  await rm(directory, { recursive: true, force: true });
  const endpointClosed = port === undefined || await new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.once('error', error => finish(error.code === 'ECONNREFUSED'));
    socket.once('connect', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
  if (!endpointClosed) failure = true;
  process.stdout.write(JSON.stringify({ temporaryStateRemoved: true, processStopped: endpointClosed }) + '\n');
}
process.exitCode = failure ? 1 : 0;
