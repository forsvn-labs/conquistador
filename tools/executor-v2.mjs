// Executor v2 app APIs. No legacy CLI calls, daemon startup, or provider credential store.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const OWNER_FILE = 'conquistador.json';
const DEFAULT_SOURCE = 'https://mcp.forsvn.com/mcp';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const slug = value => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const requireValue = (value, code) => { if (!value) fail(code); };

export function executorV2Connection(env = process.env) {
  let origin;
  try { origin = new URL(env.CONQUISTADOR_EXECUTOR_URL ?? 'http://127.0.0.1:4312'); }
  catch { fail('INVALID_EXECUTOR_ORIGIN'); }
  requireValue(!origin.username && !origin.password && !origin.search && !origin.hash &&
    ['/', ''].includes(origin.pathname) && (origin.protocol === 'https:' ||
      origin.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(origin.hostname)), 'INVALID_EXECUTOR_ORIGIN');
  const authEnv = env.CONQUISTADOR_EXECUTOR_AUTH_ENV ??
    (['127.0.0.1', '[::1]'].includes(origin.hostname) ? 'EXECUTOR_API_KEY' : 'CONQUISTADOR_EXECUTOR_ACCESS');
  requireValue(authEnv === 'EXECUTOR_API_KEY' || /^CONQUISTADOR_EXECUTOR_[A-Z][A-Z0-9_]{0,63}$/.test(authEnv), 'INVALID_AUTH_ENV');
  const credential = env[authEnv];
  requireValue(typeof credential === 'string' && credential.length >= 16 && credential.length <= 8192 &&
    /^[A-Za-z0-9._~+\/-]+=*$/.test(credential), 'EXECUTOR_AUTH_REQUIRED');
  const organization = env.CONQUISTADOR_EXECUTOR_ORGANIZATION ?? null;
  requireValue(organization === null || /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(organization), 'INVALID_ORGANIZATION');
  requireValue(['127.0.0.1', '[::1]'].includes(origin.hostname) || organization, 'EXECUTOR_ORGANIZATION_REQUIRED');
  const prefix = organization ? `/api/organizations/${encodeURIComponent(organization)}` : '/api';
  return Object.freeze({ origin: origin.origin, organization, authEnv, prefix,
    sdkPrefix: organization ? prefix : '/v1',
    identity: hash({ origin: origin.origin, organization, authEnv, credential }),
    headers() {
      requireValue(env[authEnv] === credential, 'EXECUTOR_CREDENTIAL_CHANGED');
      return { authorization: `Bearer ${credential}`, ...(organization ? { 'x-executor-organization': organization } : {}) };
    },
    containsCredential(value) { return JSON.stringify(value).includes(credential); },
  });
}

export function createExecutorV2Api(connection, { fetchImpl = fetch } = {}) {
  return async function request(path, { method = 'GET', body, sdk = false, allowMissing = false, timeout = 15000 } = {}) {
    requireValue(/^\/[a-zA-Z0-9_/-]+$/.test(path), 'INVALID_EXECUTOR_PATH');
    const response = await fetchImpl(connection.origin + (sdk ? connection.sdkPrefix : connection.prefix) + path, {
      method, headers: { ...connection.headers(), accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(timeout),
    });
    if (response.status === 404 && allowMissing) { await response.body?.cancel(); return null; }
    if (!response.ok) { await response.body?.cancel(); fail(response.status === 401 ? 'EXECUTOR_AUTH_REQUIRED' : response.status === 403 ? 'EXECUTOR_ACCESS_DENIED' : 'EXECUTOR_API_FAILED'); }
    requireValue(response.headers.get('content-type')?.includes('application/json'), 'EXECUTOR_JSON_REQUIRED');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > 2 * 1024 * 1024) { await response.body.cancel().catch(() => {}); fail('EXECUTOR_RESPONSE_LIMIT'); }
      chunks.push(Buffer.from(chunk));
    }
    let value;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('EXECUTOR_JSON_REQUIRED'); }
    requireValue(!connection.containsCredential(value), 'EXECUTOR_CREDENTIAL_ECHO');
    return value;
  };
}

// A bounded Streamable HTTP session for v2's discovery and direct-call meta-tools.
// This helper is internal host code; the public CLI exposes only capability-specific operations.
export async function openExecutorV2Mcp(connection, { fetchImpl = fetch, signal } = {}) {
  const official = new URL(connection.origin).hostname === 'api.executor.sh';
  const endpoint = official ? `https://mcp.executor.sh/org/${encodeURIComponent(connection.organization)}/mcp` : `${connection.origin}/mcp`;
  let session, nextId = 1, protocol = '2025-11-25';
  const lifetime = new AbortController();
  async function rpc(method, params, notification = false) {
    const id = notification ? undefined : nextId++;
    const response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', credentials: 'omit',
      headers: { ...connection.headers(), 'content-type': 'application/json', accept: 'application/json, text/event-stream',
        'mcp-protocol-version': protocol, ...(session ? { 'mcp-session-id': session } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', ...(id ? { id } : {}), method, ...(params ? { params } : {}) }),
      signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(20000), ...(signal ? [signal] : [])]),
    });
    if (!response.ok) { await response.body?.cancel(); fail(response.status === 401 ? 'EXECUTOR_AUTH_REQUIRED' : 'EXECUTOR_MCP_FAILED'); }
    const issued = response.headers.get('mcp-session-id');
    if (issued) { requireValue(!session || issued === session, 'EXECUTOR_SESSION_CHANGED'); session = issued; }
    if (notification || response.status === 202 || response.status === 204) { await response.body?.cancel(); return; }
    requireValue(/application\/json|text\/event-stream/.test(response.headers.get('content-type') ?? ''), 'EXECUTOR_MCP_JSON_REQUIRED');
    let bytes = 0, text = '';
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      requireValue(bytes <= 2 * 1024 * 1024, 'EXECUTOR_RESPONSE_LIMIT');
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
    let message;
    try {
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const messages = text.split(/\r?\n\r?\n/).filter(block => block.includes('data:')).map(block =>
          JSON.parse(block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')));
        message = messages.find(item => item.id === id);
      } else message = JSON.parse(text);
    } catch { fail('EXECUTOR_MCP_JSON_REQUIRED'); }
    requireValue(message?.id === id && message.jsonrpc === '2.0' && !message.error, 'EXECUTOR_MCP_REJECTED');
    requireValue(!connection.containsCredential(message), 'EXECUTOR_CREDENTIAL_ECHO');
    return message.result;
  }
  const initialized = await rpc('initialize', { protocolVersion: protocol, capabilities: {}, clientInfo: { name: 'conquistador', version: VERSION } });
  requireValue(['2025-03-26', '2025-06-18', '2025-11-25'].includes(initialized?.protocolVersion), 'EXECUTOR_PROTOCOL_UNSUPPORTED');
  protocol = initialized.protocolVersion;
  await rpc('notifications/initialized', undefined, true);
  return Object.freeze({
    async listTools() {
      const tools = [];
      let cursor;
      for (let page = 0; page < 3; page++) {
        const result = await rpc('tools/list', cursor ? { cursor } : {});
        requireValue(Array.isArray(result?.tools) && result.tools.length <= 64 && tools.length + result.tools.length <= 128, 'EXECUTOR_DISCOVERY_LIMIT');
        tools.push(...result.tools);
        if (!result.nextCursor) return tools;
        requireValue(result.nextCursor !== cursor, 'EXECUTOR_DISCOVERY_LIMIT');
        cursor = result.nextCursor;
      }
      fail('EXECUTOR_DISCOVERY_LIMIT');
    },
    async call(name, args) {
      requireValue(['search', 'describe', 'call', 'resume', 'skills'].includes(name), 'EXECUTOR_META_TOOL_DENIED');
      const result = await rpc('tools/call', { name, arguments: args });
      requireValue(result && !result.isError, 'EXECUTOR_TOOL_REJECTED');
      if (result.structuredContent) return result.structuredContent;
      try { return JSON.parse(result.content.filter(item => item.type === 'text').map(item => item.text).join('\n')); }
      catch { fail('EXECUTOR_TOOL_JSON_REQUIRED'); }
    },
    async close() {
      if (session) {
        try { await fetchImpl(endpoint, { method: 'DELETE', headers: { ...connection.headers(), 'mcp-session-id': session,
          'mcp-protocol-version': protocol }, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(2000) }); } catch {}
      }
      lifetime.abort();
    },
  });
}

export function executorV2SourceFiles(name, framework, sourceUrl = DEFAULT_SOURCE) {
  requireValue(typeof framework === 'string' && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(framework), 'INVALID_FRAMEWORK_VERSION');
  requireValue(typeof name === 'string' && name.length <= 80 && slug(name), 'INVALID_APP_NAME');
  let url;
  try { url = new URL(sourceUrl); } catch { fail('INVALID_SOURCE_URL'); }
  const local = url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname);
  requireValue(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/mcp' &&
    (sourceUrl === DEFAULT_SOURCE || local), 'INVALID_SOURCE_URL');
  const files = local ? [{ path: 'index.ts', content:
    'import { defineApp, toolAnnotations, withApprovals } from "apps";\n' +
    'import { mcpRouter } from "apps/mcp";\nimport { always } from "apps/operations/approval";\n' +
    `export default defineApp({}, async ({ signal, cache }) => ({ tools: withApprovals(await mcpRouter({ url: ${JSON.stringify(sourceUrl)}, signal, cache }), tool => toolAnnotations(tool)?.destructiveHint === true ? always() : undefined) }));\n` }]
    : [{ path: 'index.ts', content:
      'import { defineApp, accountRouter, toolAnnotations, withApprovals } from "apps";\n' +
      'import { mcpRouter } from "apps/mcp";\nimport { always } from "apps/operations/approval";\n' +
      'import { headers, provider, url } from "./provider.ts";\n' +
      'export default defineApp({ user: { accounts: { service: provider.many() } } }, async ({ user, signal, cache }) => ({\n' +
      '  tools: await accountRouter(user?.accounts.service ?? [], async account => withApprovals(\n' +
      '    await mcpRouter({ url, account, headers: headers(account), signal, cache }),\n' +
      '    tool => toolAnnotations(tool)?.destructiveHint === true ? always() : undefined), { signal }),\n}));\n' },
    { path: 'provider.ts', content:
      'import { defineProvider, oauth2 } from "apps";\nimport { mcpHealth } from "apps/mcp";\n' +
      `export const url = ${JSON.stringify(sourceUrl)};\n` +
      'export const headers = (account: { fields: { access_token: string } }) => ({ Authorization: "Bearer " + account.fields.access_token });\n' +
      'export const provider = defineProvider({ name: "Conquistador", hosts: ["mcp.forsvn.com"],\n' +
      '  auth: { oauth: oauth2({ discover: url }) },\n' +
      '  health: check => mcpHealth(check, { url, headers: headers(check.account) }),\n});\n' }];
  files.push({ path: 'package.json', content: JSON.stringify({ name: slug(name), private: true, type: 'module',
    dependencies: { apps: framework, '@modelcontextprotocol/sdk': '1.32.1' } }, null, 2) + '\n' });
  files.push({ path: OWNER_FILE, content: JSON.stringify({ schema: 'conquistador.executor-app/v1',
    manager: '@forsvn/conquistador', productVersion: VERSION, sourceUrl, filesDigest: hash(files) }, null, 2) + '\n' });
  return files;
}

function ownedFiles(files) {
  requireValue(Array.isArray(files) && files.length <= 8 && files.every(file => typeof file.path === 'string' && typeof file.content === 'string'), 'EXECUTOR_APP_UNOWNED');
  let marker;
  try { marker = JSON.parse(files.find(file => file.path === OWNER_FILE)?.content); } catch { fail('EXECUTOR_APP_UNOWNED'); }
  requireValue(marker?.schema === 'conquistador.executor-app/v1' && marker.manager === '@forsvn/conquistador', 'EXECUTOR_APP_UNOWNED');
  // Source APIs may sort files. Digest their original generated order, not the response order.
  const managed = ['index.ts', 'provider.ts', 'package.json'].flatMap(path => files.filter(file => file.path === path));
  requireValue(files.length === managed.length + 1 && marker.filesDigest === hash(managed), 'EXECUTOR_APP_MODIFIED');
  return marker;
}
function requireBinding(connection, binding) {
  if (!binding) return;
  requireValue(binding.origin === connection.origin && (binding.organization ?? null) === connection.organization, 'EXECUTOR_TARGET_CHANGED');
}
async function findApp(request, name, binding) {
  if (binding?.appId) {
    requireValue(/^app_[A-Za-z0-9-]+$/.test(binding.appId), 'INVALID_APP_ID');
    return request(`/apps/${binding.appId}`, { sdk: true, allowMissing: true });
  }
  const apps = await request('/apps', { sdk: true });
  requireValue(Array.isArray(apps) && apps.length <= 1000, 'EXECUTOR_APP_LIST_INVALID');
  const matches = apps.filter(app => app.name === name || app.slug === slug(name));
  requireValue(matches.length <= 1, 'EXECUTOR_APP_AMBIGUOUS');
  return matches[0] ?? null;
}

export async function registerExecutorV2Source(name, { env = process.env, fetchImpl = fetch, binding, sourceUrl = DEFAULT_SOURCE } = {}) {
  const connection = executorV2Connection(env);
  requireBinding(connection, binding);
  const request = createExecutorV2Api(connection, { fetchImpl });
  const framework = await request('/framework/release');
  const files = executorV2SourceFiles(name, framework.version, sourceUrl);
  let app = await findApp(request, name, binding);
  let status = 'added', commit;
  if (app) {
    const source = await request(`/apps/${app.id}/workspace`);
    const previous = ownedFiles(source.files);
    requireValue(previous.sourceUrl === sourceUrl, 'EXECUTOR_SOURCE_CHANGED');
    requireValue(/^[a-f0-9]{40}$/.test(source.revision?.commit), 'EXECUTOR_SOURCE_INVALID');
    if (hash([...source.files].sort((a, b) => a.path.localeCompare(b.path))) === hash([...files].sort((a, b) => a.path.localeCompare(b.path)))) {
      commit = source.revision.commit;
      if (binding?.commit === commit && binding?.activeVersion === app.activeVersion) status = 'unchanged';
      else status = 'updated';
    } else {
      const saved = await request(`/apps/${app.id}/commits`, { method: 'POST', body: { expected: source.revision.commit, files, message: `Update Conquistador ${VERSION}` } });
      requireValue(saved.removed?.count === 0 && /^[a-f0-9]{40}$/.test(saved.revision?.commit), 'EXECUTOR_COMMIT_INVALID');
      commit = saved.revision.commit;
      status = 'updated';
    }
  } else {
    app = await request('/apps', { method: 'POST', body: { name, files } });
    requireValue(/^app_[A-Za-z0-9-]+$/.test(app.id), 'EXECUTOR_APP_INVALID');
    const source = await request(`/apps/${app.id}/workspace`);
    ownedFiles(source.files);
    commit = source.revision?.commit;
    requireValue(/^[a-f0-9]{40}$/.test(commit), 'EXECUTOR_SOURCE_INVALID');
  }
  if (status !== 'unchanged') {
    const deployed = await request(`/apps/${app.id}/deploy`, { method: 'POST', body: { commit }, timeout: 120000 });
    requireValue(deployed.app?.id === app.id && typeof deployed.app.activeVersion === 'string', 'EXECUTOR_DEPLOY_INVALID');
    app = deployed.app;
  }
  return { ok: true, status, slug: app.slug ?? slug(name), appId: app.id,
    binding: { origin: connection.origin, organization: connection.organization, appId: app.id, commit, activeVersion: app.activeVersion },
    accountRequired: sourceUrl === DEFAULT_SOURCE,
    next: sourceUrl === DEFAULT_SOURCE ? 'Open the app in Executor, link your Conquistador account, then verify its tools.' : 'Verify the app tools through the connected Executor MCP client.' };
}

export async function checkExecutorV2Source(name, { env = process.env, fetchImpl = fetch, binding } = {}) {
  const connection = executorV2Connection(env);
  requireBinding(connection, binding);
  const request = createExecutorV2Api(connection, { fetchImpl });
  const app = await findApp(request, name, binding);
  requireValue(app?.activeVersion, 'EXECUTOR_APP_NOT_DEPLOYED');
  const source = await request(`/apps/${app.id}/workspace`);
  ownedFiles(source.files);
  if (binding) requireValue(binding.commit === source.revision?.commit && binding.activeVersion === app.activeVersion, 'EXECUTOR_DEPLOYMENT_CHANGED');
  return { ok: true, detail: 'The owned Executor v2 app is deployed. Account linking and tool execution are verified separately.', appId: app.id };
}

export async function removeExecutorV2Source(name, { env = process.env, fetchImpl = fetch, binding } = {}) {
  const connection = executorV2Connection(env);
  requireBinding(connection, binding);
  const request = createExecutorV2Api(connection, { fetchImpl });
  const app = await findApp(request, name, binding);
  if (!app) return { ok: true, removed: false };
  const source = await request(`/apps/${app.id}/workspace`);
  ownedFiles(source.files);
  const removed = await request(`/apps/${app.id}`, { method: 'DELETE', sdk: true });
  requireValue(removed.app === app.id, 'EXECUTOR_REMOVAL_UNVERIFIED');
  requireValue(await request(`/apps/${app.id}`, { sdk: true, allowMissing: true }) === null, 'EXECUTOR_REMOVAL_UNVERIFIED');
  return { ok: true, removed: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    const [action, raw] = process.argv.slice(2);
    const input = JSON.parse(raw);
    const actions = { register: registerExecutorV2Source, check: checkExecutorV2Source, remove: removeExecutorV2Source };
    requireValue(Object.hasOwn(actions, action) && typeof input?.name === 'string', 'INVALID_EXECUTOR_ACTION');
    console.log(JSON.stringify(await actions[action](input.name, { binding: input.binding, ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}) })));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, status: 'failed', error: error.code ?? 'EXECUTOR_V2_FAILED' }));
  }
}
