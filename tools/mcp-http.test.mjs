// Streamable HTTP transport: the same handler serves `--http` and the hosted function.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createMcpRequestHandler } from './mcp-http.mjs';

async function serve(t, options) {
  const server = createServer(createMcpRequestHandler(options));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, { method = 'POST', body, token, raw } = {}) => fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: method === 'POST' ? raw ?? JSON.stringify(body) : undefined,
  });
}
const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

test('a hosted handler without a configured token fails closed', async t => {
  const request = await serve(t, { token: '', requireToken: true });
  const response = await request('/mcp', { body: list });
  assert.equal(response.status, 503);
  assert.equal((await request('/health', { method: 'GET' })).status, 200);
});

test('a wrong or missing bearer token is refused', async t => {
  const request = await serve(t, { token: 's3cret-token', requireToken: true });
  assert.equal((await request('/mcp', { body: list })).status, 401);
  assert.equal((await request('/mcp', { body: list, token: 'wrong-token!' })).status, 401);
  const ok = await request('/mcp', { body: list, token: 's3cret-token' });
  assert.equal(ok.status, 200);
  assert.ok((await ok.json()).result.tools.some(tool => tool.name === 'conquistador_check'));
});

test('bad methods, bad JSON, and oversized bodies get bounded errors', async t => {
  const request = await serve(t, { token: 'tok', requireToken: true });
  assert.equal((await request('/mcp', { method: 'GET', token: 'tok' })).status, 405);
  assert.equal((await request('/mcp', { raw: '{nope', token: 'tok' })).status, 400);
  assert.equal((await request('/mcp', { raw: 'x'.repeat(70_000), token: 'tok' })).status, 413);
});

test('a rewritten function path serves MCP, and health needs no token', async t => {
  const request = await serve(t, { token: 'tok', requireToken: true });
  const response = await request('/api/mcp', { body: list, token: 'tok' });
  assert.equal(response.status, 200);
  const health = await request('/api/health', { method: 'GET' });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, server: 'conquistador' });
  assert.equal((await request('/elsewhere', { body: list, token: 'tok' })).status, 404);
});

test('a brief and a check work end to end over HTTP', async t => {
  const request = await serve(t, { token: 'tok', requireToken: true });
  const call = (id, name, args) => request('/mcp', { token: 'tok', body: { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } } }).then(response => response.json());
  const brief = await call(2, 'conquistador_brief', { task: 'Write a LinkedIn post about our launch' });
  assert.match(brief.result.content[0].text, /# Conquistador brief/);
  const check = await call(3, 'conquistador_check', { text: 'Unlock seamless growth.', channel: 'linkedin' });
  assert.ok(JSON.parse(check.result.content[0].text).findings.length > 0);
});
