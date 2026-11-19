// Named API keys for the hosted MCP server: one person, several agents, one key each.
// The sign-in key (from /signup or conquistador login) manages the named keys. A named key can
// call the MCP endpoint and revoke itself, and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import worker from '../worker.mjs';

const hashOf = token => createHash('sha256').update(token).digest('hex');
const personal = () => `cq_${randomBytes(32).toString('base64url')}`;
const allow = { limit: async () => ({ success: true }) };
const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
const memoryKv = (entries = {}) => {
  const data = new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    data,
    get: async (key, type) => (data.has(key) ? ((type === 'json' || type?.type === 'json') ? JSON.parse(data.get(key)) : data.get(key)) : null),
    put: async (key, value) => { data.set(key, value); },
    delete: async key => { data.delete(key); },
  };
};

// A signed-in user (GitHub id 7) with a sign-in key and the given user-record fields.
function setup(user = {}) {
  const main = personal();
  const kv = memoryKv({
    [`token:${hashOf(main)}`]: { githubId: 7, created: '2026-11-01T00:00:00.000Z', lastUsed: null },
    'user:7': { githubId: 7, login: 'seven', tokenHash: hashOf(main), created: '2026-11-01T00:00:00.000Z', status: 'active', ...user },
  });
  const env = { CONQUISTADOR_MCP_TOKEN: 'admin', TOKENS: kv, MCP_LIMITER: allow };
  return { main, kv, env };
}

const call = (env, path, { method = 'GET', token, body, raw } = {}) => worker.fetch(new Request(`https://mcp.example${path}`, {
  method,
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: method === 'GET' || method === 'DELETE' ? undefined : raw ?? JSON.stringify(body ?? {}),
}), env);
const mcp = (env, token) => call(env, '/mcp', { method: 'POST', token, body: list });
const create = (env, token, name) => call(env, '/api/keys', { method: 'POST', token, body: { name } });

test('the sign-in key creates a named key that works on the MCP endpoint', async () => {
  const { main, env } = setup();
  const response = await create(env, main, 'ci-bot');
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.token, /^cq_[A-Za-z0-9_-]{43}$/);
  assert.equal(body.name, 'ci-bot');
  assert.equal((await mcp(env, body.token)).status, 200);
  assert.equal((await mcp(env, main)).status, 200, 'the sign-in key keeps working');
});

test('the server stores only the hash of a named key', async () => {
  const { main, kv, env } = setup();
  const { token } = await (await create(env, main, 'ci-bot')).json();
  for (const value of kv.data.values()) assert.ok(!value.includes(token));
  assert.ok(kv.data.has(`token:${hashOf(token)}`));
});

test('whoami names the key that made the request', async () => {
  const { main, env } = setup();
  const { token } = await (await create(env, main, 'ci-bot')).json();
  const named = await (await call(env, '/api/whoami', { token })).json();
  assert.equal(named.key, 'ci-bot');
  assert.equal(named.login, 'seven');
  const signIn = await (await call(env, '/api/whoami', { token: main })).json();
  assert.equal(signIn.key, null);
});

test('key management needs a bearer token, and the admin token has no keys', async () => {
  const { env } = setup();
  assert.equal((await call(env, '/api/keys')).status, 401);
  assert.equal((await create(env, undefined, 'x')).status, 401);
  assert.equal((await create(env, 'admin', 'x')).status, 400);
  assert.equal((await call(env, '/api/keys', { token: 'admin' })).status, 400);
});

test('a named key cannot create, list, or revoke other keys', async () => {
  const { main, env } = setup();
  const { token } = await (await create(env, main, 'agent-a')).json();
  await create(env, main, 'agent-b');
  assert.equal((await create(env, token, 'agent-c')).status, 403);
  assert.equal((await call(env, '/api/keys', { token })).status, 403);
  assert.equal((await call(env, '/api/keys/agent-b', { method: 'DELETE', token })).status, 403);
});

test('a key name must be short lowercase letters, digits, dashes, or underscores', async () => {
  const { main, env } = setup();
  for (const name of ['', 'Has-Caps', 'has space', '../up', '-lead', 'x'.repeat(41), 42, null]) {
    assert.equal((await create(env, main, name)).status, 400, JSON.stringify(name));
  }
  assert.equal((await create(env, main, 'a')).status, 201);
  assert.equal((await create(env, main, 'x'.repeat(40))).status, 201);
});

test('the create request must be small JSON', async () => {
  const { main, env } = setup();
  assert.equal((await call(env, '/api/keys', { method: 'POST', token: main, raw: 'not json' })).status, 400);
  assert.equal((await call(env, '/api/keys', { method: 'POST', token: main, raw: JSON.stringify({ name: 'a', pad: 'x'.repeat(5000) }) })).status, 413);
  assert.equal((await call(env, '/api/keys', { method: 'PUT', token: main })).status, 405);
});

test('a name in use is refused, so a running agent never loses its key by accident', async () => {
  const { main, env } = setup();
  const first = await (await create(env, main, 'ci-bot')).json();
  const again = await create(env, main, 'ci-bot');
  assert.equal(again.status, 409);
  assert.match((await again.json()).error, /revoke/i);
  assert.equal((await mcp(env, first.token)).status, 200);
});

test('a user can hold at most 10 named keys', async () => {
  const { main, env } = setup();
  for (let index = 0; index < 10; index += 1) assert.equal((await create(env, main, `k${index}`)).status, 201);
  const over = await create(env, main, 'k10');
  assert.equal(over.status, 409);
  assert.match((await over.json()).error, /10/);
});

test('the list shows names and dates, never tokens or hashes', async () => {
  const { main, env } = setup();
  const { token } = await (await create(env, main, 'ci-bot')).json();
  await create(env, main, 'zapier');
  await mcp(env, token);
  const response = await call(env, '/api/keys', { token: main });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes(token) && !text.includes(hashOf(token)));
  const { keys } = JSON.parse(text);
  assert.deepEqual(keys.map(key => key.name), ['ci-bot', 'zapier']);
  assert.ok(keys.every(key => typeof key.created === 'string' && 'lastUsed' in key));
  assert.ok(keys.find(key => key.name === 'ci-bot').lastUsed, 'a used key shows when');
});

test('revoking one key stops only that key', async () => {
  const { main, kv, env } = setup();
  const a = await (await create(env, main, 'agent-a')).json();
  const b = await (await create(env, main, 'agent-b')).json();
  const response = await call(env, '/api/keys/agent-a', { method: 'DELETE', token: main });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { revoked: true, name: 'agent-a' });
  assert.equal((await mcp(env, a.token)).status, 401);
  assert.ok(!kv.data.has(`token:${hashOf(a.token)}`));
  assert.equal((await mcp(env, b.token)).status, 200);
  assert.equal((await mcp(env, main)).status, 200);
  assert.equal((await create(env, main, 'agent-a')).status, 201, 'the name is free again');
});

test('revoking a name that does not exist answers 404', async () => {
  const { main, env } = setup();
  assert.equal((await call(env, '/api/keys/nobody', { method: 'DELETE', token: main })).status, 404);
  assert.equal((await call(env, '/api/keys/Bad%20Name', { method: 'DELETE', token: main })).status, 404);
});

test('logout with a named key revokes only that key', async () => {
  const { main, kv, env } = setup();
  const a = await (await create(env, main, 'agent-a')).json();
  const b = await (await create(env, main, 'agent-b')).json();
  const response = await call(env, '/api/logout', { method: 'POST', token: a.token });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).key, 'agent-a');
  assert.equal((await mcp(env, a.token)).status, 401);
  assert.equal((await mcp(env, b.token)).status, 200);
  assert.equal((await mcp(env, main)).status, 200);
  assert.ok(kv.data.has('user:7'));
});

test('logout with the sign-in key revokes every key and deletes the record', async () => {
  const { main, kv, env } = setup();
  const a = await (await create(env, main, 'agent-a')).json();
  assert.equal((await call(env, '/api/logout', { method: 'POST', token: main })).status, 200);
  assert.equal((await mcp(env, a.token)).status, 401);
  assert.equal((await mcp(env, main)).status, 401);
  assert.deepEqual([...kv.data.keys()], []);
});

test('a blocked account loses its named keys too', async () => {
  const { main, kv, env } = setup();
  const { token } = await (await create(env, main, 'ci-bot')).json();
  const user = JSON.parse(kv.data.get('user:7'));
  kv.data.set('user:7', JSON.stringify({ ...user, status: 'blocked' }));
  assert.equal((await mcp(env, token)).status, 403);
});

test('a named-key record that the user record no longer points at is refused', async () => {
  // A late "last used" write after a revoke, or two creates at once, leave such a record.
  const { main, kv, env } = setup();
  const { token } = await (await create(env, main, 'ci-bot')).json();
  const user = JSON.parse(kv.data.get('user:7'));
  user.keys['ci-bot'].hash = hashOf(personal());
  kv.data.set('user:7', JSON.stringify(user));
  assert.equal((await mcp(env, token)).status, 401);
});

test('a named key is not accepted as the sign-in key, and the reverse', async () => {
  const { main, kv, env } = setup();
  const { token } = await (await create(env, main, 'ci-bot')).json();
  const user = JSON.parse(kv.data.get('user:7'));
  // The user record names the named key's hash as its sign-in key; the token record still says ci-bot.
  kv.data.set('user:7', JSON.stringify({ ...user, tokenHash: hashOf(token), keys: {} }));
  assert.equal((await mcp(env, token)).status, 401);
});

test('signing in again replaces the sign-in key and keeps the named keys', async () => {
  // Simulate the issue step through the same KV shape that /api/login writes.
  const { issueToken } = await import('./hosted-auth.mjs');
  const { main, env } = setup();
  const { token } = await (await create(env, main, 'ci-bot')).json();
  const issued = await issueToken(env, { githubId: 7, login: 'seven' });
  assert.equal((await mcp(env, main)).status, 401, 'the old sign-in key stops');
  assert.equal((await mcp(env, issued.token)).status, 200);
  assert.equal((await mcp(env, token)).status, 200, 'the named key keeps working');
});

test('user records written before named keys existed keep working', async () => {
  const { main, env } = setup();
  assert.equal((await mcp(env, main)).status, 200);
  assert.deepEqual(await (await call(env, '/api/keys', { token: main })).json(), { keys: [] });
});
