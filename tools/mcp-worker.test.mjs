// The Cloudflare Worker adapter: the same MCP responder behind a fetch handler.
// The live runtime check is tools/e2e/agent-loop.mjs --url against `wrangler dev`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker.mjs';
import { briefFiles } from './operator-package.mjs';

const call = (path, { method = 'POST', body, raw, token, env = { CONQUISTADOR_MCP_TOKEN: 'tok' } } = {}) => worker.fetch(new Request(`https://mcp.example${path}`, {
  method,
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: method === 'POST' ? raw ?? JSON.stringify(body) : undefined,
}), env);
const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

test('the worker fails closed without a token secret, and health stays open', async () => {
  assert.equal((await call('/mcp', { body: list, env: {} })).status, 503);
  const health = await call('/health', { method: 'GET', env: {} });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, server: 'conquistador' });
});

test('the worker refuses a wrong or missing token and serves the right one', async () => {
  assert.equal((await call('/mcp', { body: list })).status, 401);
  assert.equal((await call('/mcp', { body: list, token: 'nope' })).status, 401);
  const ok = await call('/mcp', { body: list, token: 'tok' });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.ok((await ok.json()).result.tools.some(tool => tool.name === 'conquistador_check'));
});

test('the worker bounds methods, JSON, size, and paths', async () => {
  assert.equal((await call('/mcp', { method: 'GET', token: 'tok' })).status, 405);
  assert.equal((await call('/mcp', { raw: '{nope', token: 'tok' })).status, 400);
  assert.equal((await call('/mcp', { raw: 'x'.repeat(70_000), token: 'tok' })).status, 413);
  assert.equal((await call('/elsewhere', { body: list, token: 'tok' })).status, 404);
});

test('the worker answers a brief and a check', async () => {
  const tool = (name, args) => call('/mcp', { token: 'tok', body: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } } }).then(response => response.json());
  assert.match((await tool('conquistador_brief', { task: 'Write a LinkedIn post about our launch' })).result.content[0].text, /# Conquistador brief/);
  assert.equal((await tool('conquistador_check', { text: 'Unlock seamless growth.' })).result.structuredContent.clean, false);
});

test('the Worker upload holds the library and code only, never local playbooks', () => {
  const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.match(config, /^main = "worker\.mjs"$/m);
  assert.match(config, /^no_bundle = true$/m);
  assert.match(config, /nodejs_compat/);
  const globs = [...config.matchAll(/globs = \[([^\]]*)\]/g)].flatMap(match => [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]));
  assert.ok(globs.length > 0);
  for (const glob of globs) assert.match(glob, /^(?:skills\/|tools\/|package\.json$)/, glob);
  const pattern = glob => new RegExp(`^${glob.replace(/[.]/g, '\\.').replace(/\*\*\//g, '\0').replace(/\*/g, '[^/]*').replaceAll('\0', '(?:.*/)?')}$`);
  const matches = file => globs.some(glob => pattern(glob).test(file));
  for (const file of [...briefFiles, 'tools/mcp-http.mjs', 'package.json', 'skills/conquistador/SKILL.md', 'skills/conquistador/routing-contract.json', 'skills/conquistador/commands/outreach/references/frameworks/ctas.md']) assert.ok(matches(file), `${file} is not uploaded`);
  assert.ok(!matches('tools/install.mjs'));
});

test('module roots come from the module URL, or /bundle when a Worker leaves it unset', async () => {
  const { packageRootOf } = await import('./module-root.mjs');
  assert.equal(packageRootOf(new URL('file:///opt/app/tools/brief.mjs').href), '/opt/app');
  assert.equal(packageRootOf(undefined), '/bundle');
});

test('the worker stops reading a streamed body without a length once it passes the limit', async () => {
  let pulled = 0;
  const chunk = new Uint8Array(16_384).fill(120);
  const body = new ReadableStream({ pull(controller) { pulled += chunk.length; if (pulled > 10_000_000) controller.close(); else controller.enqueue(chunk); } });
  const response = await worker.fetch(new Request('https://mcp.example/mcp', { method: 'POST', body, duplex: 'half', headers: { authorization: 'Bearer tok' } }), { CONQUISTADOR_MCP_TOKEN: 'tok' });
  assert.equal(response.status, 413);
  assert.ok(pulled < 1_000_000, `read ${pulled} bytes`);
});

test('Wrangler default module rules are off, so nothing outside the declared globs uploads', () => {
  const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const rules = config.split('[[rules]]').slice(1);
  for (const type of ['ESModule', 'CommonJS', 'CompiledWasm', 'Text', 'Data']) {
    const rule = rules.find(item => item.includes(`type = "${type}"`));
    assert.ok(rule, `${type} rule`);
    assert.match(rule, /fallthrough = false/, type);
  }
});

// Personal tokens. The full flows run in workerd: tools/e2e/signup.mjs. These cover binding
// permutations that one wrangler.toml cannot express.
const memoryKv = (entries = {}) => {
  const data = new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    data,
    get: async (key, type) => (data.has(key) ? ((type === 'json' || type?.type === 'json') ? JSON.parse(data.get(key)) : data.get(key)) : null),
    put: async (key, value) => { data.set(key, value); },
    delete: async key => { data.delete(key); },
  };
};
const allow = { limit: async () => ({ success: true }) };
const { createHash, randomBytes } = await import('node:crypto');
const hashOf = token => createHash('sha256').update(token).digest('hex');
const personal = () => `cq_${randomBytes(32).toString('base64url')}`;
const seeded = (token, user = {}) => memoryKv({
  [`token:${hashOf(token)}`]: { githubId: 7, created: '2026-10-07T00:00:00.000Z', lastUsed: '2026-10-07T00:00:00.000Z' },
  'user:7': { githubId: 7, login: 'seven', tokenHash: hashOf(token), created: '2026-10-07T00:00:00.000Z', status: 'active', ...user },
});

test('a personal token fails closed when the KV namespace is not bound', async () => {
  const response = await call('/mcp', { body: list, token: personal(), env: { CONQUISTADOR_MCP_TOKEN: 'tok', MCP_LIMITER: allow } });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not set up/);
});

test('a personal token fails closed when the rate limiter is not bound', async () => {
  const token = personal();
  const response = await call('/mcp', { body: list, token, env: { TOKENS: seeded(token) } });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /rate limit/i);
});

test('a seeded personal token works, and the admin token works beside it', async () => {
  const token = personal();
  const env = { CONQUISTADOR_MCP_TOKEN: 'tok', TOKENS: seeded(token), MCP_LIMITER: allow };
  assert.equal((await call('/mcp', { body: list, token, env })).status, 200);
  assert.equal((await call('/mcp', { body: list, token: 'tok', env })).status, 200);
});

test('a token record whose user record points at another hash is refused', async () => {
  // Two sign-ins at once, or a late last-used write after a rotation, leave such a record.
  const token = personal();
  const env = { TOKENS: seeded(token, { tokenHash: hashOf(personal()) }), MCP_LIMITER: allow };
  const response = await call('/mcp', { body: list, token, env });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /conquistador login/);
});

test('a token record without a user record is refused', async () => {
  const token = personal();
  const kv = seeded(token);
  kv.data.delete('user:7');
  assert.equal((await call('/mcp', { body: list, token, env: { TOKENS: kv, MCP_LIMITER: allow } })).status, 401);
});

test('the rate limiter refuses with 429, the reason, and retry-after', async () => {
  const token = personal();
  const env = { TOKENS: seeded(token), MCP_LIMITER: { limit: async () => ({ success: false }) }, RATE_LIMIT_PER_MINUTE: '60' };
  const response = await call('/mcp', { body: list, token, env });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  const body = await response.json();
  assert.match(body.error, /60 requests per minute/);
  assert.equal(body.retryAfter, 60);
});

test('the admin token cannot be revoked through /api/logout', async () => {
  const response = await call('/api/logout', { token: 'tok', env: { CONQUISTADOR_MCP_TOKEN: 'tok', TOKENS: memoryKv(), MCP_LIMITER: allow } });
  assert.equal(response.status, 400);
});

test('sign-up refuses GitHub URL overrides that are not HTTPS or loopback', async () => {
  const env = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret', TOKENS: memoryKv(), SIGNUP_LIMITER: allow, MCP_LIMITER: allow, GITHUB_URL: 'http://evil.example' };
  const response = await call('/signup/start', { method: 'GET', env });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('location'), null);
});

test('sign-up needs the KV namespace and the sign-up limiter', async () => {
  const base = { GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret', TOKENS: memoryKv(), SIGNUP_LIMITER: allow, MCP_LIMITER: allow };
  assert.equal((await call('/signup/start', { method: 'GET', env: base })).status, 302);
  for (const missing of ['TOKENS', 'SIGNUP_LIMITER', 'GITHUB_CLIENT_SECRET']) {
    const env = { ...base };
    delete env[missing];
    assert.equal((await call('/signup/start', { method: 'GET', env })).status, 503, missing);
  }
});

test('the rate-limit message reads the same limit that wrangler.toml configures', () => {
  const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const limiter = config.split('[[ratelimits]]').slice(1).find(block => /name = "MCP_LIMITER"/.test(block));
  assert.ok(limiter, 'MCP_LIMITER binding');
  assert.match(limiter, /period = 60/);
  const limit = limiter.match(/limit = (\d+)/)?.[1];
  assert.equal(config.match(/^RATE_LIMIT_PER_MINUTE = "(\d+)"$/m)?.[1], limit);
  assert.match(config, /binding = "TOKENS"/);
  assert.ok(config.split('[[ratelimits]]').slice(1).some(block => /name = "SIGNUP_LIMITER"/.test(block)));
});
