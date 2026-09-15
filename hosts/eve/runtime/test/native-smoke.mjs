// Explicit operator check only: starts and stops one prepared app on loopback.
// Uses synthetic app tokens, strips all provider credentials, and submits no job.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { resolve } from 'node:path';
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
  for (const path of ['/eve/v1/task-input/anything', '/eve/v1/callback/anything']) {
    assert.equal((await fetch(host + path, { method: 'POST' })).status, 404);
  }
  console.log(JSON.stringify({ evidence: 'local native HTTP, synthetic access tokens, no model jobs', health: 'ready', info: 'authenticated via eve/client', callerApproval: 'denied', unknownSession: '409 without replacement', callbackRoutes: 'absent' }));
} finally {
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  if (child.exitCode === null) await Promise.race([once(child, 'exit'), setTimeout(3000)]);
  if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
}
