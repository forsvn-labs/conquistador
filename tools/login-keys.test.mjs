// `conquistador keys`: list, create, and revoke named keys for the hosted MCP server.
// The fetch double records each request; the server behavior is covered in hosted-keys.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runKeys } from './login.mjs';

const SIGN_IN = `cq_${'a'.repeat(43)}`;
const NAMED = `cq_${'b'.repeat(43)}`;

function harness({ token = SIGN_IN, reply = () => ({ status: 200, body: {} }) } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'cq-keys-'));
  if (token) { mkdirSync(home, { recursive: true }); writeFileSync(join(home, 'mcp-token'), `${token}\n`); }
  const requests = [];
  const out = { text: '', write(chunk) { this.text += chunk; } };
  const err = { text: '', write(chunk) { this.text += chunk; } };
  const fetch = async (url, init = {}) => {
    requests.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body });
    const { status, body } = reply({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  const run = args => runKeys(args, { env: { CONQUISTADOR_HOME: home, CONQUISTADOR_MCP_URL: 'https://mcp.example' }, stdout: out, stderr: err, fetch });
  return { run, requests, out, err, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

test('keys create sends the name with the saved sign-in token and prints the new key once', async t => {
  const h = harness({ reply: () => ({ status: 201, body: { token: NAMED, name: 'ci-bot', created: '2026-11-19T00:00:00.000Z' } }) });
  t.after(h.cleanup);
  assert.equal(await h.run(['create', 'ci-bot']), 0);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, 'https://mcp.example/api/keys');
  assert.equal(h.requests[0].method, 'POST');
  assert.equal(h.requests[0].headers.authorization, `Bearer ${SIGN_IN}`);
  assert.deepEqual(JSON.parse(h.requests[0].body), { name: 'ci-bot' });
  assert.equal(h.out.text.split(NAMED).length - 1, 1, 'the key appears exactly once');
  assert.match(h.out.text, /https:\/\/mcp\.example\/mcp/);
});

test('keys create --json prints one JSON object for scripts', async t => {
  const h = harness({ reply: () => ({ status: 201, body: { token: NAMED, name: 'ci-bot', created: '2026-11-19T00:00:00.000Z' } }) });
  t.after(h.cleanup);
  assert.equal(await h.run(['create', 'ci-bot', '--json']), 0);
  const parsed = JSON.parse(h.out.text);
  assert.deepEqual(parsed, { token: NAMED, name: 'ci-bot', created: '2026-11-19T00:00:00.000Z', url: 'https://mcp.example/mcp' });
});

test('keys create does not overwrite the saved sign-in token', async t => {
  const h = harness({ reply: () => ({ status: 201, body: { token: NAMED, name: 'ci-bot', created: 'now' } }) });
  t.after(h.cleanup);
  await h.run(['create', 'ci-bot']);
  await h.run(['list']);
  assert.equal(h.requests[1].headers.authorization, `Bearer ${SIGN_IN}`);
});

test('keys list prints each name with its dates', async t => {
  const h = harness({ reply: () => ({ status: 200, body: { keys: [{ name: 'ci-bot', created: '2026-11-19T00:00:00.000Z', lastUsed: null }, { name: 'zapier', created: '2026-11-18T00:00:00.000Z', lastUsed: '2026-11-19T01:00:00.000Z' }] } }) });
  t.after(h.cleanup);
  assert.equal(await h.run(['list']), 0);
  assert.equal(h.requests[0].method, 'GET');
  assert.match(h.out.text, /ci-bot.*never/);
  assert.match(h.out.text, /zapier.*2026-11-19T01:00/);
});

test('keys list says so when there are no keys', async t => {
  const h = harness({ reply: () => ({ status: 200, body: { keys: [] } }) });
  t.after(h.cleanup);
  assert.equal(await h.run(['list']), 0);
  assert.match(h.out.text, /No named keys/);
});

test('keys revoke sends DELETE with the name encoded in the path', async t => {
  const h = harness({ reply: () => ({ status: 200, body: { revoked: true, name: 'ci-bot' } }) });
  t.after(h.cleanup);
  assert.equal(await h.run(['revoke', 'ci-bot']), 0);
  assert.equal(h.requests[0].method, 'DELETE');
  assert.equal(h.requests[0].url, 'https://mcp.example/api/keys/ci-bot');
  await h.run(['revoke', '../x']);
  assert.equal(h.requests[1].url, 'https://mcp.example/api/keys/..%2Fx');
});

test('keys needs a saved sign-in token', async t => {
  const h = harness({ token: null });
  t.after(h.cleanup);
  assert.equal(await h.run(['list']), 1);
  assert.match(h.err.text, /conquistador login/);
  assert.equal(h.requests.length, 0);
});

test('keys reports the server error and fails', async t => {
  const h = harness({ reply: () => ({ status: 409, body: { error: 'A key named "ci-bot" exists. Revoke it first, or choose another name.' } }) });
  t.after(h.cleanup);
  assert.equal(await h.run(['create', 'ci-bot']), 1);
  assert.match(h.err.text, /exists/);
});

test('keys fails cleanly when the server cannot be reached', async t => {
  const h = harness();
  t.after(h.cleanup);
  const code = await runKeys(['list'], { env: { CONQUISTADOR_HOME: mkdtempSync(join(tmpdir(), 'cq-keys-')), CONQUISTADOR_MCP_URL: 'https://mcp.example' }, stdout: h.out, stderr: h.err, fetch: async () => { throw new TypeError('offline'); } });
  assert.equal(code, 1);
});

test('keys rejects a missing name, an unknown action, or an unknown option before any request', async t => {
  const h = harness();
  t.after(h.cleanup);
  assert.equal(await h.run(['create']), 2);
  assert.equal(await h.run(['revoke']), 2);
  assert.equal(await h.run(['rotate', 'x']), 2);
  assert.equal(await h.run(['list', '--bogus']), 2);
  assert.equal(await h.run([]), 2);
  assert.equal(h.requests.length, 0);
});

test('keys --help prints usage and succeeds', async t => {
  const h = harness();
  t.after(h.cleanup);
  assert.equal(await h.run(['--help']), 0);
  assert.match(h.out.text, /conquistador keys create <name>/);
});
