import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ExecutorError, requireCondition, validateConfig, loginHandoff } from './config.mjs';
import { inspectExecutor, setupGuide } from './setup.mjs';

const HELP = `Conquistador Executor connections
  setup
  status
  prepare --endpoint URL --ui-url URL --auth-env ENV_NAME
  login --config PATH
  probe --config PATH

setup inspects whether Executor is installed and prints official next steps.
status reports local install detection only. Neither installs a package or starts
a service. The parent Conquistador skill runs official install commands through
the host when the user wants to get going.

prepare prints a non-secret config draft. Save it to an operator-owned file.
login prints an Executor UI handoff; it does not open a browser or log in.
probe negotiates MCP and lists at most 128 tools across three pages in 10s.
No provider calls, arbitrary execution, credentials in flags, or OAuth flows.
Optional SDK install: cd hosts/executor && bun install --frozen-lockfile --ignore-scripts
`;

export async function run(argv, { stdout = process.stdout, stderr = process.stderr, env = process.env, execFile } = {}) {
  try {
    requireCondition(Array.isArray(argv), 'INVALID_ARGUMENTS');
    if (argv.length === 0 || (argv.length === 1 && ['help', '--help', '-h'].includes(argv[0]))) { stdout.write(HELP); return 0; }
    const [action, ...rest] = argv;
    let result;
    if (action === 'setup' || action === 'status') {
      requireCondition(rest.length === 0, 'INVALID_ARGUMENTS');
      const inspect = await inspectExecutor({ env, execFile });
      result = action === 'setup' ? setupGuide(inspect) : inspect;
    } else {
      requireCondition(['prepare', 'login', 'probe'].includes(action) && rest.length % 2 === 0, 'INVALID_ARGUMENTS');
      const allowed = action === 'prepare' ? ['--endpoint', '--ui-url', '--auth-env'] : ['--config'];
      const flags = {};
      for (let i = 0; i < rest.length; i += 2) {
        requireCondition(allowed.includes(rest[i]) && !Object.hasOwn(flags, rest[i]) && typeof rest[i + 1] === 'string', 'INVALID_ARGUMENTS');
        flags[rest[i]] = rest[i + 1];
      }
      requireCondition(Object.keys(flags).length === allowed.length, 'INVALID_ARGUMENTS');
      if (action === 'prepare') {
        result = validateConfig({ schema: 'conquistador.executor-connection/v1', endpoint: flags['--endpoint'], uiUrl: flags['--ui-url'], authEnv: flags['--auth-env'] });
      } else {
        let config;
        try {
          const file = await open(flags['--config'], constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          try {
            requireCondition((await file.stat()).isFile(), 'INVALID_CONFIG');
            const buffer = Buffer.alloc(4097);
            const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
            requireCondition(bytesRead <= 4096, 'INVALID_CONFIG');
            config = validateConfig(JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')));
          } finally { await file.close(); }
        } catch { throw new ExecutorError('INVALID_CONFIG'); }
        if (action === 'login') result = loginHandoff(config);
        else {
          const { createExecutorClient } = await import('./client.mjs');
          const client = await createExecutorClient(config, { env });
          result = await client.probe();
        }
      }
    }
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${JSON.stringify({ status: 'error', code: error instanceof ExecutorError ? error.code : 'CONNECTION_FAILED', connectionVerified: false, providerVerified: false })}\n`);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await run(process.argv.slice(2));
