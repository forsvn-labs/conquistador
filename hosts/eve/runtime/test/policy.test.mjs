import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, executorSettings, safeOrigin } from '../agent/lib/policy.mjs';

// Synthetic policy inputs only. These are not real credentials or live evidence.
const identity = { schemaVersion: 'conquistador.eve-app/v1', owner: 'test-owner', instance: 'a'.repeat(32) };
const env = { CONQUISTADOR_EVE_CALLER_TOKEN: 'test-caller-'.repeat(4), CONQUISTADOR_EVE_OPERATOR_TOKEN: 'test-operator-'.repeat(4) };
function request(role, body, path = '/eve/v1/session', method = 'POST') {
  return new Request(`https://eve.example${path}`, { method, headers: { authorization: `Bearer ${env[role === 'operator' ? 'CONQUISTADOR_EVE_OPERATOR_TOKEN' : 'CONQUISTADOR_EVE_CALLER_TOKEN']}` }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
}

test('missing, reused or incorrect credentials fail closed', async () => {
  assert.equal(await authenticate(request('caller', { message: 'draft' }), identity, {}), null);
  assert.equal(await authenticate(request('caller', { message: 'draft' }), identity, { ...env, CONQUISTADOR_EVE_OPERATOR_TOKEN: env.CONQUISTADOR_EVE_CALLER_TOKEN }), null);
  assert.equal(await authenticate(new Request('https://eve.example/eve/v1/info'), identity, env), null);
});
test('caller can submit and queue a message, never respond or assert identity', async () => {
  const principal = await authenticate(request('caller', { message: 'draft' }), identity, env);
  assert.equal(principal.principalId, identity.owner);
  assert.equal(principal.issuer, `urn:conquistador:eve:${identity.instance}`);
  assert.ok(await authenticate(request('caller', { message: 'continue', turnPolicy: 'queue' }, '/eve/v1/session/wrun_test'), identity, env));
  for (const body of [
    { inputResponses: [{ requestId: 'r', optionId: 'approve' }] },
    { message: 'draft', forwardedPrincipal: { principalId: 'admin' } },
    { message: 'draft', callback: 'https://other.example' },
    { message: 'draft', turnPolicy: 'steer' },
    { message: [{ type: 'file', data: 'private' }] },
  ]) assert.equal(await authenticate(request('caller', body), identity, env), null);
});
test('operator can answer a pending request but cannot dispatch arbitrary messages', async () => {
  assert.ok(await authenticate(request('operator', { inputResponses: [{ requestId: 'r', optionId: 'approve' }] }, '/eve/v1/session/wrun_test'), identity, env));
  assert.equal(await authenticate(request('operator', { message: 'draft' }), identity, env), null);
  assert.equal(await authenticate(request('caller', {}, '/eve/v1/callback'), identity, env), null);
  assert.equal(await authenticate(request('caller', {}, '/eve/v1/session/wrun_test/reset'), identity, env), null);
});
test('both roles can inspect the owner app; unknown routes fail closed', async () => {
  for (const role of ['caller', 'operator']) {
    assert.ok(await authenticate(request(role, null, '/eve/v1/info', 'GET'), identity, env));
    assert.ok(await authenticate(request(role, null, '/eve/v1/session/wrun_test/stream', 'GET'), identity, env));
    assert.equal(await authenticate(request(role, null, '/eve/v1/task', 'GET'), identity, env), null);
  }
});
test('Executor requires current and initiating owner; configuration never grants another owner', async () => {
  const principal = await authenticate(request('caller', { message: 'draft' }), identity, env);
  const session = { auth: { current: principal, initiator: principal } };
  assert.equal(executorSettings(identity, session, {}), null);
  const configured = { CONQUISTADOR_EXECUTOR_ACCOUNT: 'test-account', CONQUISTADOR_EXECUTOR_MCP_URL: 'https://executor.example/mcp', CONQUISTADOR_EXECUTOR_TOKEN: 'test-executor-'.repeat(4), CONQUISTADOR_EXECUTOR_TOOLS: 'search,execute' };
  assert.deepEqual(executorSettings(identity, session, configured).tools, ['search', 'execute']);
  assert.notEqual(executorSettings(identity, session, configured).credentialFingerprint, executorSettings(identity, session, { ...configured, CONQUISTADOR_EXECUTOR_TOKEN: 'rotated-test-'.repeat(4) }).credentialFingerprint);
  for (const slot of ['current', 'initiator']) {
    assert.throws(() => executorSettings(identity, { auth: { ...session.auth, [slot]: { ...principal, principalId: 'someone-else' } } }, configured), /owner/);
  }
  assert.throws(() => executorSettings(identity, session, { ...configured, CONQUISTADOR_EXECUTOR_MCP_URL: 'http://executor.example' }), /HTTPS/);
  assert.throws(() => executorSettings(identity, session, { ...configured, CONQUISTADOR_EXECUTOR_TOOLS: '*' }), /exact tool/);
  assert.throws(() => executorSettings(identity, session, { CONQUISTADOR_EXECUTOR_TOKEN: configured.CONQUISTADOR_EXECUTOR_TOKEN }), /requires/);
});
test('client refuses credential-bearing, redirected-path and insecure non-loopback origins', () => {
  for (const value of ['https://user:password@example.com', 'http://example.com', 'https://example.com/path', 'https://example.com?token=x']) assert.throws(() => safeOrigin(value));
  assert.equal(safeOrigin('http://127.0.0.1:2000'), 'http://127.0.0.1:2000');
});
