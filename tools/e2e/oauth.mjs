#!/usr/bin/env node
// Real workerd + OAuth provider + KV + HTTP MCP. GitHub identity is an explicit local fixture.
// Failure contract: docs/INSTALLATION-ACCEPTANCE.md. No live credentials are used or recorded.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const out = resolve(option('--out') ?? join(root, 'dist/e2e/oauth'));
const state = mkdtempSync(join(tmpdir(), 'cq-oauth-'));
mkdirSync(out, { recursive: true });
const steps = [];
let child, log = '';
const pause = ms => new Promise(done => setTimeout(done, ms));
const port = async () => {
  const server = createServer(); await new Promise(done => server.listen(0, '127.0.0.1', done));
  const value = server.address().port; await new Promise(done => server.close(done)); return value;
};
const json = (response, body) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
const fixture = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://fixture');
  if (url.pathname === '/login/oauth/authorize') {
    const target = new URL(url.searchParams.get('redirect_uri'));
    target.searchParams.set('code', 'fixture-code'); target.searchParams.set('state', url.searchParams.get('state'));
    response.writeHead(302, { location: target.href }); response.end();
  } else if (url.pathname === '/login/oauth/access_token') json(response, { access_token: 'fixture-github-token' });
  else if (request.method === 'POST' && url.pathname === '/applications/fixture-client/token') json(response, { user: { id: 73, login: 'fixture-user' } });
  else if (request.method === 'DELETE') { response.writeHead(204); response.end(); }
  else { response.writeHead(404); response.end(); }
});
const check = async (name, run) => { await run(); steps.push({ name, passed: true }); console.log(`pass ${name}`); };
const cookieJar = new Map();
function cookies(response) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';'); const split = pair.indexOf('='); cookieJar.set(pair.slice(0, split), pair.slice(split + 1));
  }
}
const cookieHeader = () => [...cookieJar].map(([key, value]) => `${key}=${value}`).join('; ');
try {
  await new Promise(done => fixture.listen(0, '127.0.0.1', done));
  const gh = `http://127.0.0.1:${fixture.address().port}`;
  const base = `http://127.0.0.1:${await port()}`;
  const vars = { OAUTH_ISSUER: base, GITHUB_CLIENT_ID: 'fixture-client', GITHUB_CLIENT_SECRET: 'fixture-secret', GITHUB_URL: gh, GITHUB_API_URL: gh, CONQUISTADOR_MCP_TOKEN: 'fixture-api-key', CONQUISTADOR_RECEIPT_KEY: 'fixture-receipt-key' };
  const args = ['dev', '--port', new URL(base).port, '--ip', '127.0.0.1', '--local-upstream', base.slice(7), '--persist-to', state, '--show-interactive-dev-session=false', ...Object.entries(vars).flatMap(([key, value]) => ['--var', `${key}:${value}`])];
  child = spawn(process.env.WRANGLER_BIN ?? 'npx', process.env.WRANGLER_BIN ? args : ['--yes', 'wrangler@4.148.0', ...args], { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) break;
    try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch { /* Starting. */ }
    await pause(400);
  }
  assert.ok(ready, 'Worker must start; see worker.log');
  const req = (path, init = {}) => fetch(new URL(path, base), { redirect: 'manual', ...init, headers: { 'cf-connecting-ip': '192.0.2.1', ...init.headers } });
  const form = body => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const mcp = (token, message = { method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'oauth-e2e', version: '1' } } }) => req('/mcp', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...message }) });
  await check('anonymous initialize advertises protected resource metadata', async () => {
    const response = await mcp(); assert.equal(response.status, 401); assert.match(response.headers.get('www-authenticate'), /resource_metadata=/);
  });
  await check('both RFC 9728 discovery paths expose the canonical MCP resource', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const response = await req(path); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.resource, `${base}/mcp`); assert.deepEqual(body.authorization_servers, [base]);
    }
  });
  let metadata;
  await check('authorization metadata advertises S256, registration and token endpoints', async () => {
    metadata = await (await req('/.well-known/oauth-authorization-server')).json();
    assert.ok(metadata.code_challenge_methods_supported.includes('S256')); assert.ok(metadata.registration_endpoint); assert.ok(metadata.token_endpoint); assert.equal(metadata.client_id_metadata_document_supported, true);
  });
  const redirect = 'https://client.example/callback';
  const registration = await req(metadata.registration_endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'E2E client', redirect_uris: [redirect], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }) });
  assert.equal(registration.status, 201); const client = await registration.json();
  steps.push({ name: 'public MCP client registers without an API key', passed: true });
  const verifier = 'a'.repeat(64);
  const authorize = changes => {
    const url = new URL('/authorize', base); url.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code', state: 'client-state', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', resource: `${base}/mcp`, scope: 'mcp:read', ...changes }); return url.href;
  };
  await check('clients that omit scope receive explicit read consent', async () => {
    const response = await req(authorize({ scope: '' })); assert.equal(response.status, 200); assert.match(await response.text(), /E2E client/);
  });
  await check('native clients can use an exactly registered private URI scheme', async () => {
    const response = await req(metadata.registration_endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Native E2E', redirect_uris: ['conquistador-test:/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code'], response_types: ['code'] }) });
    assert.equal(response.status, 201); const native = await response.json();
    const consent = await req(authorize({ client_id: native.client_id, redirect_uri: 'conquistador-test:/callback' })); assert.equal(consent.status, 200); assert.match(await consent.text(), /conquistador-test:/);
  });
  for (const [name, changes] of [['unregistered redirect', { redirect_uri: 'https://attacker.example/callback' }], ['missing PKCE', { code_challenge: '' }], ['plain PKCE', { code_challenge_method: 'plain' }], ['wrong resource', { resource: 'https://attacker.example/mcp' }], ['unknown scope', { scope: 'admin' }], ['private-network client metadata', { client_id: 'https://127.0.0.1/client.json' }]]) {
    await check(`authorization refuses ${name}`, async () => { const response = await req(authorize(changes)); assert.ok(response.status >= 400); assert.equal(response.headers.get('location'), null); });
  }
  async function begin() {
    const page = await req(authorize()); assert.equal(page.status, 200); cookies(page); const html = await page.text();
    assert.match(html, /client\.example/); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    return /name="handle" value="([^"]+)"/.exec(html)?.[1];
  }
  let handle = await begin(); assert.ok(handle);
  await check('forged consent without its browser cookie is refused', async () => { const response = await req('/authorize', form({ handle, action: 'allow' })); assert.ok(response.status >= 400); });
  handle = await begin();
  await check('deny returns the client state and creates no grant', async () => {
    const init = form({ handle, action: 'deny' }); init.headers.cookie = cookieHeader();
    const response = await req('/authorize', init); assert.equal(response.status, 302); assert.equal(new URL(response.headers.get('location')).searchParams.get('error'), 'access_denied');
  });
  async function grant() {
    const handle = await begin(); const init = form({ handle, action: 'allow' }); init.headers.cookie = cookieHeader();
    const upstream = await req('/authorize', init); assert.equal(upstream.status, 302); cookies(upstream);
    const github = await req(upstream.headers.get('location')); const callback = github.headers.get('location');
    const forged = await req(callback); assert.ok(forged.status >= 400);
    const completed = await req(callback, { headers: { cookie: cookieHeader() } }); assert.equal(completed.status, 302); cookies(completed);
    const target = new URL(completed.headers.get('location')); assert.equal(target.origin, 'https://client.example'); assert.equal(target.searchParams.get('state'), 'client-state');
    return target.searchParams.get('code');
  }
  const exchange = (code, changes = {}) => req(metadata.token_endpoint, form({ grant_type: 'authorization_code', client_id: client.client_id, redirect_uri: redirect, code, code_verifier: verifier, resource: `${base}/mcp`, ...changes }));
  await check('wrong verifier cannot exchange an authorization code', async () => { const response = await exchange(await grant(), { code_verifier: 'b'.repeat(64) }); assert.equal(response.status, 400); });
  const code = await grant(); let token;
  await check('consent and browser-bound GitHub callback exchange into MCP tokens', async () => {
    const response = await exchange(code); assert.equal(response.status, 200); token = await response.json(); assert.ok(token.access_token); assert.ok(token.refresh_token); assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  await check('OAuth access token initializes the real MCP server', async () => { const response = await mcp(token.access_token); assert.equal(response.status, 200); assert.ok((await response.json()).result.serverInfo); });
  await check('API keys continue to initialize beside OAuth', async () => { assert.equal((await mcp('fixture-api-key')).status, 200); });
  await check('OAuth serves the real library and verifies signed check receipts across auth methods', async () => {
    const tool = async (access, name, args) => {
      const response = await mcp(access, { method: 'tools/call', params: { name, arguments: args } }); assert.equal(response.status, 200);
      const body = await response.json(); assert.ok(!body.result.isError); return body.result;
    };
    const brief = await tool(token.access_token, 'conquistador_brief', { task: 'Write a LinkedIn post about our launch.' }); assert.match(brief.content[0].text, /# Conquistador brief/);
    const text = 'Reply with a time for a ten-minute demo.';
    const check = await tool(token.access_token, 'conquistador_check', { text, channel: 'email' }); assert.ok(check.structuredContent.receipt.signature);
    for (const access of [token.access_token, 'fixture-api-key']) {
      const verified = await tool(access, 'conquistador_verify', { text, receipt: check.structuredContent.receipt }); assert.equal(verified.structuredContent.valid, true); assert.equal(verified.structuredContent.signed, true);
    }
  });
  await check('wrong resource is refused on refresh', async () => {
    const response = await req(metadata.token_endpoint, form({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: token.refresh_token, resource: 'https://other.example/mcp' })); assert.equal(response.status, 400);
  });
  await check('refresh rotates credentials and retains MCP access', async () => {
    const response = await req(metadata.token_endpoint, form({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: token.refresh_token, resource: `${base}/mcp` })); assert.equal(response.status, 200); const next = await response.json(); assert.notEqual(next.refresh_token, token.refresh_token); token = next; assert.equal((await mcp(token.access_token)).status, 200);
  });
  await check('revocation removes MCP access', async () => {
    assert.ok(metadata.revocation_endpoint); const response = await req(metadata.revocation_endpoint, form({ client_id: client.client_id, token: token.refresh_token })); assert.equal(response.status, 200); assert.equal((await mcp(token.access_token)).status, 401);
  });
  await check('a used authorization code cannot be exchanged again', async () => { assert.equal((await exchange(code)).status, 400); });
  await check('sign-in endpoints enforce their configured rate limit', async () => {
    let limited;
    for (let index = 0; index < 35; index++) {
      limited = await req('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.254' }, body: '{}' });
      if (limited.status === 429) break;
    }
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
  });
} catch (error) {
  steps.push({ name: 'E2E completion', passed: false, error: error.message }); console.error(error.stack);
} finally {
  child?.kill('SIGTERM'); await new Promise(done => fixture.close(done));
  writeFileSync(join(out, 'worker.log'), log.replace(/fixture-(?:secret|api-key|github-token|receipt-key)/g, '<fixture-secret>'));
  const source = ['worker.mjs', 'tools/hosted-oauth.mjs', 'tools/vendor/oauth-provider.mjs'].map(path => { try { return { path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') }; } catch { return { path, sha256: null }; } });
  const report = { mode: 'workerd, real OAuth provider and MCP; local GitHub identity fixture', source, passed: steps.filter(s => s.passed).length, steps };
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  rmSync(state, { recursive: true, force: true }); console.log(`${report.passed}/${steps.length} passed. ${join(out, 'report.json')}`);
  if (steps.some(s => !s.passed)) process.exitCode = 1;
}
