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
