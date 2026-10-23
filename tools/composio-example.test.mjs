// Failure modes recorded before implementation: unwanted remote writes, local/credential URLs,
// missing secrets, wrong OAuth discovery, shared account selection, and arbitrary tool execution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const script = new URL('../examples/composio/setup.mjs', import.meta.url);
const run = (args = [], extra = {}) => spawnSync(process.execPath, [script.pathname, ...args], {
  env: { PATH: process.env.PATH, ...extra }, encoding: 'utf8', timeout: 10000,
});
test('Composio registration defaults to an offline OAuth request preview', () => {
  const result = run(); assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout); assert.equal(plan.mode, 'preview');
  assert.equal(plan.request.url, 'https://backend.composio.dev/api/v3.1/custom/toolkits/upsert');
  assert.deepEqual(plan.request.body.toolkit_config.auth_schemes, [{ mode: 'DCR_OAUTH', discovery_url: 'https://mcp.forsvn.com/.well-known/oauth-authorization-server' }]);
});
test('API key mode uses a credential template, never a supplied token', () => {
  const result = run(['register'], { CONQUISTADOR_AUTH: 'api-key', COMPOSIO_API_KEY: 'not-a-real-key' });
  assert.equal(result.status, 0); assert.ok(!result.stdout.includes('not-a-real-key'));
  assert.deepEqual(JSON.parse(result.stdout).request.body.toolkit_config.auth_schemes, [{ mode: 'API_KEY', headers: { Authorization: 'Bearer {{generic_api_key}}' } }]);
});
test('unsafe endpoints and unknown options fail before remote calls', () => {
  for (const url of ['http://example.com/mcp', 'https://localhost/mcp', 'https://127.0.0.1/mcp', 'https://u:password@example.com/mcp', 'https://example.com/mcp?key=secret']) assert.notEqual(run([], { CONQUISTADOR_MCP_URL: url }).status, 0, url);
  assert.notEqual(run(['register', '--yes']).status, 0);
});
test('apply requires a project key; account operations require explicit identity', () => {
  assert.notEqual(run(['register', '--apply']).status, 0);
  assert.notEqual(run(['connect']).status, 0);
  assert.notEqual(run(['sync']).status, 0);
  assert.notEqual(run(['verify'], { COMPOSIO_USER_ID: 'example', COMPOSIO_ACCOUNT_ID: 'ca_example', COMPOSIO_METHODS_TOOL: 'GMAIL_SEND_EMAIL' }).status, 0);
});
test('session previews select only the intended toolkit and account', () => {
  const result = run(['discover'], { COMPOSIO_USER_ID: 'example', COMPOSIO_ACCOUNT_ID: 'ca_example', COMPOSIO_TOOLKIT: 'CUSTOM_CONQUISTADOR' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).session, { userId: 'example', toolkits: ['CUSTOM_CONQUISTADOR'], connectedAccounts: { CUSTOM_CONQUISTADOR: ['ca_example'] } });
});
