import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createExecutorClient, createExecutorGithubRepositoryRead, boundedFetch } from './client.mjs';
import { validateConfig } from './config.mjs';
import { run } from './cli.mjs';

// Synthetic local protocol conformance, never provider or authenticated live proof.
const credential = 'synthetic-test-credential-only';
const authEnv = 'CONQUISTADOR_EXECUTOR_TEST';
const env = { [authEnv]: credential };
const config = endpoint => ({ schema: 'conquistador.executor-connection/v1', endpoint,
  uiUrl: new URL(endpoint).origin + '/', authEnv });

async function fixture(t, listing, intercept, callHandler) {
  const sdk = new Server({ name: 'synthetic-local-server', version: '1' }, { capabilities: { tools: {} } });
  let calls = 0;
  sdk.setRequestHandler(ListToolsRequestSchema, listing);
  sdk.setRequestHandler(CallToolRequestSchema, req => { calls++; if (callHandler) return callHandler(req); throw new Error('must never call tools'); });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, enableJsonResponse: true });
  await sdk.connect(transport);
  const server = createServer((req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${credential}`);
    if (intercept) return intercept(req, res);
    transport.handleRequest(req, res).catch(() => { res.writeHead(500); res.end(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await sdk.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { config: config(`http://127.0.0.1:${server.address().port}/mcp`), calls: () => calls };
}
const tool = name => ({ name, inputSchema: { type: 'object' } });

test('installed SDK negotiates real local HTTP MCP, bounds pages and closes', async t => {
  let pages = 0;
  const f = await fixture(t, req => {
    pages++;
    return req.params?.cursor ? { tools: [tool(credential)] } : { tools: [tool('execute')], nextCursor: 'page2' };
  });
  const client = await createExecutorClient(f.config, { env });
  assert.deepEqual(Object.keys(client).sort(), ['close', 'probe']);
  const result = await client.probe();
  assert.equal(result.connectionVerified, true);
  assert.equal(result.providerVerified, false);
  assert.deepEqual(result.knownTools, ['execute']);
  assert.equal(result.toolCount, 2);
  assert.equal(pages, 2);
  assert.equal(f.calls(), 0);
  assert.ok(!JSON.stringify(result).includes(credential));
  await assert.rejects(client.probe(), /CLIENT_CLOSED/);
});

test('repeated cursor fails closed', async t => {
  const f = await fixture(t, () => ({ tools: [], nextCursor: 'same' }));
  await assert.rejects((await createExecutorClient(f.config, { env })).probe(), /DISCOVERY_LIMIT/);
});

test('oversized tool page fails closed', async t => {
  const f = await fixture(t, () => ({ tools: Array.from({ length: 65 }, (_, i) => tool(`tool${i}`)) }));
  await assert.rejects((await createExecutorClient(f.config, { env })).probe(), /DISCOVERY_LIMIT/);
});

test('server errors cannot print credentials', async t => {
  const f = await fixture(t, () => { throw new Error(credential); });
  await assert.rejects((await createExecutorClient(f.config, { env })).probe(), /^ExecutorError: PROBE_FAILED$/);
});

test('401 does not start OAuth or accept server error text', async t => {
  const f = await fixture(t, () => ({ tools: [] }), (_req, res) => { res.writeHead(401); res.end(credential); });
  await assert.rejects(createExecutorClient(f.config, { env }), /^ExecutorError: CONNECTION_FAILED$/);
});

test('redirect never reaches another origin', async t => {
  let reached = 0;
  const target = createServer((_req, res) => { reached++; res.end(); });
  await new Promise(resolve => target.listen(0, '127.0.0.1', resolve));
  t.after(() => { target.closeAllConnections(); target.close(); });
  const f = await fixture(t, () => ({ tools: [] }), (_req, res) => {
    res.writeHead(307, { location: `http://127.0.0.1:${target.address().port}/mcp` }); res.end();
  });
  await assert.rejects(createExecutorClient(f.config, { env }), /CONNECTION_FAILED/);
  assert.equal(reached, 0);
});

test('transport rejects oversized bodies and endpoint changes', async t => {
  const f = await fixture(t, () => ({ tools: [] }), (_req, res) => { res.end('x'.repeat(262145)); });
  const fetcher = boundedFetch(f.config.endpoint, credential, AbortSignal.timeout(1000));
  await assert.rejects((await fetcher(f.config.endpoint)).text(), /RESPONSE_LIMIT/);
  await assert.rejects(fetcher('https://example.com/mcp'), /ENDPOINT_CHANGED/);
});

test('missing or malformed auth is rejected before connection', async () => {
  for (const value of [undefined, '', 'short', 'x'.repeat(16) + '\r\nsecret']) {
    await assert.rejects(createExecutorClient(config('http://127.0.0.1:1/mcp'), { env: { [authEnv]: value } }), /AUTH_REQUIRED/);
  }
});

test('config rejects raw secrets, URL auth, queries, remote HTTP and UI origin drift', () => {
  const base = config('https://executor.example/mcp');
  for (const value of [{ ...base, token: credential }, { ...base, endpoint: 'https://secret@executor.example/mcp' },
    { ...base, endpoint: 'https://executor.example/mcp?token=secret' },
    { ...base, endpoint: 'http://executor.example/mcp' }, { ...base, uiUrl: 'https://other.example/' },
    { ...base, authEnv: credential }, { ...base, uiUrl: 'https://executor.example/secret' }]) {
    assert.throws(() => validateConfig(value), /INVALID_CONFIG/);
  }
});

test('offline CLI prepares draft, rejects credential flags without echo, hands off UI', async () => {
  let output = '', errors = '';
  const io = { stdout: { write: s => { output += s; } }, stderr: { write: s => { errors += s; } } };
  assert.equal(await run(['prepare', '--endpoint', 'https://executor.example/mcp', '--ui-url', 'https://executor.example/', '--auth-env', authEnv], io), 0);
  assert.equal(JSON.parse(output).authEnv, authEnv);
  output = '';
  assert.equal(await run(['probe', '--token', credential], io), 1);
  assert.ok(!errors.includes(credential));
  assert.equal(output, '');
  assert.equal(await run(['--help'], io), 0);
});

test('stalled connection is cancelled within the fixed lifetime', async t => {
  const f = await fixture(t, () => ({ tools: [] }), () => {});
  const started = Date.now();
  await assert.rejects(createExecutorClient(f.config, { env }), /CONNECTION_FAILED/);
  assert.ok(Date.now() - started < 12000);
});

test('offline help and preparation work with no optional node_modules', async t => {
  const { mkdtemp, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = await mkdtemp(join(tmpdir(), 'conquistador-executor-offline-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ['cli.mjs', 'config.mjs']) await copyFile(new URL(name, import.meta.url), join(dir, name));
  for (const args of [['--help'], ['prepare', '--endpoint', 'https://executor.example/mcp', '--ui-url', 'https://executor.example/', '--auth-env', authEnv]]) {
    const child = spawnSync(process.execPath, [join(dir, 'cli.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stderr, '');
  }
});

const binding = {
  integration: 'github', owner: 'org', connection: 'main', toolId: 'tools.github.org.main.getRepository',
  inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'], additionalProperties: false },
};
const connection = { provider: 'github', state: 'active', allowedOperationIds: ['github.repository.get'], id: 'synthetic', revision: 1 };
function options(credential) { return { credential, connection, deadlineAt: new Date(Date.now() + 5000).toISOString() }; }
function discovered(overrides = {}) { return { id: binding.toolId, inputSchema: binding.inputSchema,
  annotations: { readOnlyHint: true, destructiveHint: false }, ...overrides }; }

test('fixed GitHub callback uses exact schema and identity over installed MCP SDK', async t => {
  const requests = [];
  const f = await fixture(t, () => ({ tools: [] }), undefined, req => {
    requests.push(req.params);
    if (req.params.name === 'search') return { content: [], structuredContent: { items: [discovered()] } };
    return { content: [], structuredContent: { status: 'completed', result: { id: 1, name: 'repo', full_name: 'owner/repo', private: false, secretExtra: 'discard' } } };
  });
  const route = createExecutorGithubRepositoryRead(f.config, { env, binding, connection, allowedRepositories: ['owner/repo'] });
  const result = await route.readRepository({ owner: 'owner', repository: 'repo' }, options(route.credential));
  assert.equal(result.body.full_name, 'owner/repo');
  assert.equal(result.body.secretExtra, undefined);
  assert.deepEqual(requests.map(x => x.name), ['search', 'invoke']);
  assert.deepEqual(requests[1].arguments, { tool: binding.toolId, arguments: { owner: 'owner', repo: 'repo' } });
});

test('GitHub binding denies schema drift before invoke', async t => {
  const f = await fixture(t, () => ({ tools: [] }), undefined, () => ({ content: [], structuredContent: { items: [discovered({ inputSchema: { type: 'object' } })] } }));
  const route = createExecutorGithubRepositoryRead(f.config, { env, binding, connection, allowedRepositories: ['owner/repo'] });
  await assert.rejects(route.readRepository({ owner: 'owner', repository: 'repo' }, options(route.credential)), /TOOL_BINDING_MISMATCH/);
  assert.equal(f.calls(), 1);
});

test('GitHub callback denies connection, credential, repository and deadline drift before network', async () => {
  const route = createExecutorGithubRepositoryRead(config('http://127.0.0.1:1/mcp'), { env, binding, connection, allowedRepositories: ['owner/repo'] });
  const input = { owner: 'owner', repository: 'repo' };
  await assert.rejects(route.readRepository(input, options({})), /CONNECTION_BINDING_MISMATCH/);
  await assert.rejects(route.readRepository(input, { ...options(route.credential), connection: { ...connection, revision: 2 } }), /CONNECTION_BINDING_MISMATCH/);
  await assert.rejects(route.readRepository({ owner: 'other', repository: 'repo' }, options(route.credential)), /REPOSITORY_DENIED/);
  await assert.rejects(route.readRepository(input, { ...options(route.credential), deadlineAt: '2000-01-01' }), /DEADLINE_EXPIRED/);
});

for (const [name, items] of [
  ['mutating annotation', [discovered({ annotations: { readOnlyHint: true, destructiveHint: true } })]],
  ['missing ID', []], ['duplicate ID', [discovered(), discovered()]],
]) test(`GitHub discovery rejects ${name} before invoke`, async t => {
  const f = await fixture(t, () => ({ tools: [] }), undefined, () => ({ content: [], structuredContent: { items } }));
  const route = createExecutorGithubRepositoryRead(f.config, { env, binding, connection, allowedRepositories: ['owner/repo'] });
  await assert.rejects(route.readRepository({ owner: 'owner', repository: 'repo' }, options(route.credential)), /TOOL_BINDING_MISMATCH/);
  assert.equal(f.calls(), 1);
});

for (const [name, result] of [
  ['repository mismatch', { id: 1, name: 'repo', full_name: 'other/repo', private: false }],
  ['credential echo', { id: 1, name: 'repo', full_name: 'owner/repo', private: false, description: credential }],
]) test(`GitHub response rejects ${name}`, async t => {
  const f = await fixture(t, () => ({ tools: [] }), undefined, req => ({ content: [], structuredContent:
    req.params.name === 'search' ? { items: [discovered()] } : { status: 'completed', result } }));
  const route = createExecutorGithubRepositoryRead(f.config, { env, binding, connection, allowedRepositories: ['owner/repo'] });
  await assert.rejects(route.readRepository({ owner: 'owner', repository: 'repo' }, options(route.credential)), /PROVIDER_RESPONSE_INVALID/);
});

test('CLI handoff reads only bounded regular config files and prints no token', async t => {
  const { mkdtemp, writeFile, symlink, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(join(tmpdir(), 'executor-config-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'connection.json');
  await writeFile(path, JSON.stringify(config('https://executor.example/mcp')));
  let output = '', error = '';
  const io = { stdout: { write: s => { output += s; } }, stderr: { write: s => { error += s; } } };
  assert.equal(await run(['login', '--config', path], io), 0);
  assert.equal(JSON.parse(output).status, 'operator-action-required');
  assert.equal(JSON.parse(output).connectionVerified, false);
  await symlink(path, join(dir, 'link'));
  assert.equal(await run(['login', '--config', join(dir, 'link')], io), 1);
  await writeFile(path, credential.repeat(1000));
  assert.equal(await run(['login', '--config', path], io), 1);
  assert.ok(!error.includes(credential));
});
