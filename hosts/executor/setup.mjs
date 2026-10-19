import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecFile = promisify(execFileCallback);

export const DEFAULT_LOCAL_ENDPOINT = 'http://127.0.0.1:4788/mcp';
export const DEFAULT_LOCAL_UI = 'http://127.0.0.1:4788/';

export const OFFICIAL_DOCS = Object.freeze({
  intro: 'https://executor.sh/docs',
  cli: 'https://executor.sh/docs/run/cli',
  cloud: 'https://executor.sh/docs/hosted/cloud',
});

export const OFFICIAL_INSTALL = Object.freeze({
  npm: 'npm install -g executor',
  pnpm: 'pnpm add -g executor',
  bun: 'bun add -g executor',
  yarn: 'yarn global add executor',
});

export const CONNECT_AGENT = 'npx add-mcp http://127.0.0.1:4788/mcp --transport http --name executor';

function firstLine(text) {
  return String(text ?? '').split(/\r?\n/, 1)[0].trim().slice(0, 64);
}

function versionFromError(error) {
  return firstLine(error?.stdout) || firstLine(error?.stderr) || 'unknown';
}

export async function inspectExecutor({ env = process.env, execFile = defaultExecFile } = {}) {
  let installed = false;
  let version = null;
  try {
    const { stdout, stderr } = await execFile('executor', ['--version'], {
      timeout: 4000,
      env,
      encoding: 'utf8',
      maxBuffer: 4096,
    });
    installed = true;
    version = firstLine(stdout) || firstLine(stderr) || 'unknown';
  } catch (error) {
    if (error?.code === 'ENOENT') {
      installed = false;
      version = null;
    } else if (error?.stdout || error?.stderr) {
      installed = true;
      version = versionFromError(error);
    } else {
      installed = false;
      version = null;
    }
  }
  const authEnvPresent = Object.keys(env).some(
    key => /^CONQUISTADOR_EXECUTOR_[A-Z][A-Z0-9_]*$/.test(key) && Boolean(env[key]),
  );
  return Object.freeze({
    schema: 'conquistador.executor-status/v1',
    installed,
    version,
    generation: Number.parseInt(version, 10) >= 2 ? 2 : 1,
    defaultEndpoint: Number.parseInt(version, 10) >= 2 ? 'http://127.0.0.1:4312/mcp' : DEFAULT_LOCAL_ENDPOINT,
    defaultUiUrl: Number.parseInt(version, 10) >= 2 ? 'http://127.0.0.1:4312/' : DEFAULT_LOCAL_UI,
    authEnvPresent,
    docs: OFFICIAL_DOCS,
    connectionVerified: false,
    providerVerified: false,
  });
}

export function setupGuide(inspect) {
  if (Number.parseInt(inspect.version, 10) >= 2) return Object.freeze({
    ...inspect, schema: 'conquistador.executor-setup/v1', status: 'executor-installed',
    next: Object.freeze([
      'Start the local service only when needed: executor serve. The default port is 4312.',
      'Connect accounts and set app policies in Executor. Keep provider credentials there.',
      'Connect the agent through Executor’s Connect page. For the Conquistador CLI, set CONQUISTADOR_EXECUTOR_URL to the API origin and name the access-credential environment variable with CONQUISTADOR_EXECUTOR_AUTH_ENV. Hosted access also needs CONQUISTADOR_EXECUTOR_ORGANIZATION.',
      'Run conquistador connect, inspect the exact tool signature, and verify one read. Discovery does not prove provider access.',
    ]),
    officialInstall: Object.freeze({ npm: 'npm install -g executor@beta', bun: 'bun add -g executor@beta' }),
    startLocal: Object.freeze(['executor serve']), connectAgent: 'Use the Executor Connect page for this account and agent.',
  });
  const next = inspect.installed
    ? Object.freeze([
      'If the local service is not running: executor install && executor web',
      `Connect this coding agent: ${CONNECT_AGENT}`,
      'Restart or open a new chat if the host loads MCP only at startup.',
      'In Executor UI, add the CRM, warehouse, docs, or ads source this task needs. Restrict policies. Sign in there, not in chat.',
      'Tell Conquistador which systems are now connected, then continue the original growth, GTM, sales, marketing, or product task.',
    ])
    : Object.freeze([
      `Install the official CLI (Node 20+): ${OFFICIAL_INSTALL.npm}. Also supported: ${OFFICIAL_INSTALL.pnpm}; ${OFFICIAL_INSTALL.bun}; ${OFFICIAL_INSTALL.yarn}. Docs: ${OFFICIAL_DOCS.cli}`,
      `Or skip local install with Executor Cloud: ${OFFICIAL_DOCS.cloud}`,
      'Then rerun conquistador connections setup',
    ]);
  return Object.freeze({
    ...inspect,
    schema: 'conquistador.executor-setup/v1',
    status: inspect.installed ? 'executor-installed' : 'install-required',
    next,
    officialInstall: OFFICIAL_INSTALL,
    startLocal: Object.freeze(['executor install', 'executor web']),
    connectAgent: CONNECT_AGENT,
  });
}
