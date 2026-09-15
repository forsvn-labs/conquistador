import { createHash } from 'node:crypto';
import { ExecutorError, requireCondition, validateConfig } from './config.mjs';

const MAX_BYTES = 262144;
const TIMEOUT_MS = 10000;
const KNOWN_TOOLS = new Set(['execute', 'search', 'invoke', 'integrations', 'skills', 'resume']);

// This is a transport guard, not an alternate MCP implementation. The installed
// SDK owns negotiation, protocol validation and sessions.
export function boundedFetch(endpoint, bearer, lifetimeSignal) {
  return async (input, init = {}) => {
    requireCondition(String(input instanceof Request ? input.url : input) === endpoint, 'ENDPOINT_CHANGED');
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${bearer}`);
    const signal = AbortSignal.any([lifetimeSignal, ...(init.signal ? [init.signal] : [])]);
    const response = await fetch(input, { ...init, headers, signal, redirect: 'error', credentials: 'omit' });
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      throw new ExecutorError('AUTH_REQUIRED');
    }
    if (!response.body) return response;
    const reader = response.body.getReader();
    let bytes = 0;
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (chunk.done) { controller.close(); return; }
          bytes += chunk.value.byteLength;
          if (bytes > MAX_BYTES) { await reader.cancel(); throw new ExecutorError('RESPONSE_LIMIT'); }
          controller.enqueue(chunk.value);
        } catch (error) { controller.error(error); }
      },
      cancel(reason) { return reader.cancel(reason); },
    });
    return new Response(body, { status: response.status, headers: response.headers });
  };
}

async function openSession(config, { env = process.env, signal, passthrough = false } = {}) {
  const checked = validateConfig(config);
  const bearer = env[checked.authEnv];
  requireCondition(typeof bearer === 'string' && bearer.length >= 16 && bearer.length <= 8192 &&
    /^[A-Za-z0-9._~+\/-]+=*$/.test(bearer), 'AUTH_REQUIRED');
  let Client, StreamableHTTPClientTransport;
  try {
    ({ Client } = await import('@modelcontextprotocol/sdk/client/index.js'));
    ({ StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js'));
  } catch { throw new ExecutorError('SDK_NOT_INSTALLED'); }
  const lifetime = new AbortController();
  const timer = setTimeout(() => lifetime.abort(), TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([lifetime.signal, signal]) : lifetime.signal;
  const endpoint = checked.endpoint + (passthrough ? "?mode=passthrough" : "");
  const client = new Client({ name: 'conquistador-executor', version: '0.1.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    fetch: boundedFetch(endpoint, bearer, requestSignal),
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 100, maxReconnectionDelay: 100, reconnectionDelayGrowFactor: 1 },
  });
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    if (!lifetime.signal.aborted) await transport.terminateSession().catch(() => {});
    lifetime.abort();
    clearTimeout(timer);
    await client.close().catch(() => {});
  }
  try {
    await client.connect(transport, { timeout: TIMEOUT_MS });
  } catch { await close(); throw new ExecutorError('CONNECTION_FAILED'); }
  return Object.freeze({
    client,
    signal: requestSignal,
    async probe() {
      requireCondition(!closed, 'CLIENT_CLOSED');
      try {
        const names = new Set();
        const fingerprints = [];
        let cursor;
        for (let page = 0; page < 3; page++) {
          const result = await client.listTools(cursor ? { cursor } : {}, { timeout: TIMEOUT_MS, signal: lifetime.signal });
          requireCondition(result.tools.length <= 64 && fingerprints.length + result.tools.length <= 128, 'DISCOVERY_LIMIT');
          for (const tool of result.tools) {
            if (KNOWN_TOOLS.has(tool.name)) names.add(tool.name);
            fingerprints.push(createHash('sha256').update(JSON.stringify({ name: tool.name, inputSchema: tool.inputSchema })).digest('hex'));
          }
          if (!result.nextCursor) return { status: 'connected', connectionVerified: true,
            providerVerified: false, toolCount: fingerprints.length, knownTools: [...names].sort(), schemaDigests: fingerprints };
          requireCondition(result.nextCursor !== cursor, 'DISCOVERY_LIMIT');
          cursor = result.nextCursor;
        }
        throw new ExecutorError('DISCOVERY_LIMIT');
      } catch (error) {
        throw new ExecutorError(error instanceof ExecutorError ? error.code : 'PROBE_FAILED');
      } finally { await close(); }
    },
    close,
  });
}

export async function createExecutorClient(config, options) {
  const session = await openSession(config, options);
  return Object.freeze({ probe: session.probe, close: session.close });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function digest(value) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }

/** Host-only callback for createExecutorGithubRepositoryAdapter. Never expose to a model as a tool. */
export function createExecutorGithubRepositoryRead(config, { env = process.env, connection, allowedRepositories, binding }) {
  const checked = validateConfig(config);
  requireCondition(connection?.provider === 'github' && connection.state === 'active' &&
    connection.allowedOperationIds?.includes('github.repository.get'), 'BINDING_INVALID');
  const connectionDigest = digest(connection);
  const initialBearer = env[checked.authEnv];
  requireCondition(typeof initialBearer === 'string' && initialBearer.length >= 16, 'AUTH_REQUIRED');
  const bearerDigest = digest(initialBearer);
  requireCondition(Array.isArray(allowedRepositories) && allowedRepositories.length > 0 &&
    allowedRepositories.every(id => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(id)), 'BINDING_INVALID');
  const allowed = new Set(allowedRepositories);
  requireCondition(binding && Object.keys(binding).sort().join(',') === 'connection,inputSchema,integration,owner,toolId', 'BINDING_INVALID');
  const bound = structuredClone(binding);
  requireCondition(bound.integration === 'github' && ['org', 'user'].includes(bound.owner) &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(bound.connection) &&
    typeof bound.toolId === 'string' && bound.toolId.startsWith(`tools.github.${bound.owner}.${bound.connection}.`) &&
    /^tools\.[A-Za-z0-9_.-]{1,200}$/.test(bound.toolId), 'BINDING_INVALID');
  const schema = bound.inputSchema;
  requireCondition(schema?.type === 'object' && schema.properties &&
    Object.keys(schema.properties).sort().join(',') === 'owner,repo' &&
    schema.properties.owner.type === 'string' && schema.properties.repo.type === 'string' &&
    Array.isArray(schema.required) && [...schema.required].sort().join(',') === 'owner,repo' &&
    schema.additionalProperties === false, 'BINDING_INVALID');
  const schemaDigest = digest(schema);
  const credential = Object.freeze(Object.create(null));
  return Object.freeze({
    credential,
    async readRepository(input, options) {
      requireCondition(options?.credential === credential && digest(options.connection) === connectionDigest, 'CONNECTION_BINDING_MISMATCH');
      requireCondition(!options.connection.expiresAt || Date.parse(options.connection.expiresAt) > Date.now(), 'CONNECTION_EXPIRED');
      requireCondition(input && Object.keys(input).sort().join(',') === 'owner,repository' &&
        allowed.has(`${input.owner}/${input.repository}`), 'REPOSITORY_DENIED');
      const remaining = Date.parse(options.deadlineAt) - Date.now();
      requireCondition(Number.isFinite(remaining) && remaining > 0 && !options.signal?.aborted, 'DEADLINE_EXPIRED');
      const signal = AbortSignal.any([AbortSignal.timeout(Math.min(10000, Math.ceil(remaining))), ...(options.signal ? [options.signal] : [])]);
      let session;
      const currentBearer = env[checked.authEnv];
      requireCondition(typeof currentBearer === 'string' && digest(currentBearer) === bearerDigest, 'AUTH_BINDING_MISMATCH');
      const sessionEnv = { [checked.authEnv]: currentBearer };
      try {
        session = await openSession(checked, { env: sessionEnv, signal, passthrough: true });
        const requestOptions = { timeout: Math.min(10000, remaining), signal: session.signal };
        const search = await session.client.callTool({ name: 'search', arguments: {
          query: 'get repository', integration: bound.integration, owner: bound.owner,
          connection: bound.connection, limit: 20, offset: 0,
        } }, undefined, requestOptions);
        requireCondition(!search.isError && Array.isArray(search.structuredContent?.items) && search.structuredContent.items.length <= 20, 'DISCOVERY_FAILED');
        const matches = search.structuredContent.items.filter(item => item.id === bound.toolId);
        requireCondition(matches.length === 1 && digest(matches[0].inputSchema) === schemaDigest &&
          matches[0].annotations?.readOnlyHint === true && matches[0].annotations?.destructiveHint === false,
          'TOOL_BINDING_MISMATCH');
        signal.throwIfAborted();
        const response = await session.client.callTool({ name: 'invoke', arguments: {
          tool: bound.toolId, arguments: { owner: input.owner, repo: input.repository },
        } }, undefined, requestOptions);
        requireCondition(!response.isError && response.structuredContent?.status === 'completed', 'PROVIDER_READ_FAILED');
        const body = response.structuredContent.result;
        requireCondition(body && body.full_name === `${input.owner}/${input.repository}` &&
          Number.isSafeInteger(body.id) && body.id > 0 && body.name === input.repository &&
          typeof body.private === 'boolean', 'PROVIDER_RESPONSE_INVALID');
        // A response cannot echo the gateway bearer through metadata or logs.
        requireCondition(!JSON.stringify(body).includes(sessionEnv[checked.authEnv]), 'PROVIDER_RESPONSE_INVALID');
        const fields = ['id', 'name', 'full_name', 'description', 'default_branch', 'archived', 'disabled',
          'fork', 'html_url', 'visibility', 'private', 'topics', 'created_at', 'updated_at', 'pushed_at'];
        const metadata = Object.fromEntries(fields.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
        for (const [key, value] of Object.entries(metadata)) {
          if (key === 'id') continue;
          if (key === 'topics') requireCondition(Array.isArray(value) && value.length <= 50 && value.every(topic => typeof topic === 'string' && topic.length <= 100), 'PROVIDER_RESPONSE_INVALID');
          else if (['private', 'archived', 'disabled', 'fork'].includes(key)) requireCondition(typeof value === 'boolean', 'PROVIDER_RESPONSE_INVALID');
          else requireCondition(value === null || (typeof value === 'string' && value.length <= 2048), 'PROVIDER_RESPONSE_INVALID');
        }
        return { status: 200, headers: {}, body: metadata };
      } catch (error) {
        throw new ExecutorError(error instanceof ExecutorError ? error.code : 'REPOSITORY_READ_FAILED');
      } finally { await session?.close(); }
    },
  });
}
