// Explicit operator check only: starts and stops one prepared app on loopback.
// Uses synthetic app tokens, strips all provider credentials, and submits no job.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve, join } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { jobRequest } from '../client.mjs';
import { setTimeout } from 'node:timers/promises';
import { Client } from 'eve/client';

const app = resolve(process.argv[2]);
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const callerToken = 'synthetic-native-caller-'.repeat(3);
const operatorToken = 'synthetic-native-operator-'.repeat(3);
const child = spawn(process.execPath, ['node_modules/eve/bin/eve.js', 'start', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: app, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { PATH: process.env.PATH, NODE_ENV: 'production',
    CONQUISTADOR_EVE_CALLER_TOKEN: callerToken, CONQUISTADOR_EVE_OPERATOR_TOKEN: operatorToken },
});
let logs = '';
child.stdout.on('data', bytes => { logs = (logs + bytes).slice(-8000); });
child.stderr.on('data', bytes => { logs = (logs + bytes).slice(-8000); });
const host = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Native host exited: ${logs}`);
    try { ready = (await fetch(`${host}/eve/v1/health`)).ok; } catch {}
    if (ready) break;
    await setTimeout(100);
  }
  assert.ok(ready, 'native health ready');
  const caller = new Client({ host, auth: { bearer: callerToken }, redirect: 'error' });
  const operator = new Client({ host, auth: { bearer: operatorToken }, redirect: 'error' });
  assert.equal((await fetch(`${host}/eve/v1/info`)).status, 401);
  const info = await caller.info();
  assert.ok(info.agent);
  assert.ok((await operator.info()).agent);
  const missing = 'wrun_native_nonexistent';
  await assert.rejects(caller.sessions.attach(missing).send('No session exists; do not create one.', { turnPolicy: 'queue' }), error => error.status === 409);
  await assert.rejects(caller.sessions.attach(missing).respond([{ requestId: 'none', optionId: 'approve' }]), error => error.status === 401);
  await assert.rejects(operator.sessions.attach(missing).respond([{ requestId: 'none', optionId: 'approve' }]), error => error.status === 409);
  assert.equal((await fetch(`${host}/eve/v1/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"message":"denied"}' })).status, 401);
  // Pass through to the real native server; record only status and role matches.
  const inputs = await mkdtemp(join(tmpdir(), 'eve-bound-client-'));
  const nativeFetch = globalThis.fetch;
  const observed = [];
  try {
    const messageFile = join(inputs, 'message.txt');
    const responsesFile = join(inputs, 'responses.json');
    await writeFile(messageFile, 'Missing session; never create a replacement.');
    await writeFile(responsesFile, '[{"requestId":"none","optionId":"approve"}]');
    globalThis.fetch = async (input, init) => {
      const response = await nativeFetch(input, init);
      const auth = new Headers(init?.headers).get('authorization');
      observed.push({ status: response.status, caller: auth === `Bearer ${callerToken}`, operator: auth === `Bearer ${operatorToken}` });
      return response;
    };
    const env = { CONQUISTADOR_EVE_ORIGIN: host + '/', CONQUISTADOR_EVE_CALLER_TOKEN: callerToken, CONQUISTADOR_EVE_OPERATOR_TOKEN: operatorToken };
    await assert.rejects(jobRequest({ action: 'resume', app, url: host, session: missing, messageFile }, env), /not confirmed/);
    await assert.rejects(jobRequest({ action: 'respond', app, url: host, session: missing, responsesFile }, env), /not confirmed/);
    assert.ok(observed.some(result => result.caller && result.status === 409));
    assert.ok(observed.some(result => result.operator && result.status === 409));
    assert.ok(observed.every(result => result.status === 409));
  } finally {
    globalThis.fetch = nativeFetch;
    await rm(inputs, { recursive: true, force: true });
  }

  for (const path of ['/eve/v1/task-input/anything', '/eve/v1/callback/anything']) {
    assert.equal((await fetch(host + path, { method: 'POST' })).status, 404);
  }
  console.log(JSON.stringify({ evidence: 'local native HTTP, synthetic access tokens, no model jobs', health: 'ready', info: 'authenticated via eve/client', callerApproval: 'denied', unknownSession: '409 without replacement', callbackRoutes: 'absent', boundWrapper: 'caller and operator reached native 409 with normalized origin' }));
} finally {
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  if (child.exitCode === null) await Promise.race([once(child, 'exit'), setTimeout(3000)]);
  if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
}
