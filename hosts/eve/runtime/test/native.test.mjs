import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Client } from 'eve/client';
import { always } from 'eve/tools/approval';
import agent from '../agent/agent.ts';
import channel from '../agent/channels/eve.ts';
import connection from '../agent/connections/executor.ts';
import readSkillFile from '../agent/tools/read_skill_file.ts';

test('actual pinned Eve imports build native agent, connection, channel, and client definitions', async () => {
  const require = createRequire(import.meta.url);
  assert.equal(JSON.parse(await readFile(require.resolve('eve/package.json'), 'utf8')).version, '0.55.0');
  assert.equal(agent.defaultTools, false);
  assert.equal(connection.kind, 'eve:dynamic');
  assert.equal(typeof connection.events['turn.started'], 'function');
  assert.equal(typeof agent.model.events['session.started'], 'function');
  const client = new Client({ host: 'http://127.0.0.1:1', redirect: 'error' });
  const session = client.sessions.attach('wrun_native_import_only');
  assert.equal(session.state.sessionId, 'wrun_native_import_only');
  assert.equal(typeof session.respond, 'function');
  assert.equal(typeof session.stream, 'function');
});
test('native channel exposes no capability-token approval, callback, or delegation bypass', () => {
  assert.deepEqual(channel.routes.map(r => [r.method, r.path]), [
    ['GET', '/eve/v1/health'], ['HEAD', '/eve/v1/health'], ['GET', '/eve/v1/info'],
    ['POST', '/eve/v1/session'], ['POST', '/eve/v1/session/:sessionId'],
    ['GET', '/eve/v1/session/:sessionId/stream'],
  ]);
});
test('published always policy requires a person even after another approval', async () => {
  assert.equal(await always()({ toolName: 'executor__execute', approvedTools: new Set(['executor__execute']) }), 'user-approval');
});
test('skill reference tool rejects traversal and absolute paths before sandbox access', async () => {
  const context = { getSkill: () => { throw new Error('Unexpected sandbox access'); } };
  for (const path of ['../secret.md', '/secret.md', 'a/../../secret.md', 'a//b.md', '.env', 'script.sh']) {
    await assert.rejects(readSkillFile.execute({ skill: 'conquistador', path }, context), /contained text/);
  }
});

test('all client actions deny unbound or mismatched origins before any fetch', async t => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { jobRequest } = await import('../client.mjs');
  const app = await mkdtemp(join(tmpdir(), 'eve-origin-test-'));
  t.after(() => rm(app, { recursive: true, force: true }));
  await writeFile(join(app, 'identity.json'), JSON.stringify({ schemaVersion: 'conquistador.eve-app/v1', owner: 'test-owner', instance: 'a'.repeat(32) }));
  await writeFile(join(app, 'message.txt'), 'Synthetic request, never sent.');
  await writeFile(join(app, 'responses.json'), '[{"requestId":"test","optionId":"approve"}]');
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network request'); });
  const tokens = { CONQUISTADOR_EVE_CALLER_TOKEN: 'synthetic-caller-'.repeat(3), CONQUISTADOR_EVE_OPERATOR_TOKEN: 'synthetic-operator-'.repeat(3) };
  for (const action of ['submit', 'status', 'resume', 'respond']) {
    for (const binding of [undefined, '', 'https://expected.example', 'https://requested.example:8443', 'http://requested.example', 'https://requested.example/path']) {
      await assert.rejects(jobRequest({ action, app, url: 'https://requested.example', session: 'wrun_test',
        messageFile: join(app, 'message.txt'), responsesFile: join(app, 'responses.json') },
      { ...tokens, CONQUISTADOR_EVE_ORIGIN: binding }), /not confirmed/);
    }
  }
  assert.equal(fetch.mock.callCount(), 0);
});
