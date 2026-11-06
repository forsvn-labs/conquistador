// Real local stdio transport; synthetic facts, no account or model calls.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(process.argv[2] ?? join(root, 'dist/e2e/context-footprint'));
const work = mkdtempSync(join(tmpdir(), 'cq-context-'));
const bytes = value => Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value));
const fixtures = [
  ['docs-update', 'update the docs', 'docs'],
  ['docs-parent', 'Use Conquistador to update the docs', 'docs'],
  ['docs-multiple', 'Update these five documents and the Drive guide', 'docs'],
  ['email', 'Write a launch email for a contact import feature.', 'copy'],
  ['strategy', 'Develop positioning for a contact review product for marketing teams.', 'position'],
  ['docs', '/conquistador docs Write a user guide for importing and reviewing contacts.', 'docs'],
];
const context = 'Synthetic evaluation facts: The product imports CSV contacts into a review queue. Users fix invalid rows before retrying. Import does not send emails.';
const rpc = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });
const requests = [rpc(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'context-footprint', version: '1' } }), { jsonrpc: '2.0', method: 'notifications/initialized' }, rpc(2, 'tools/list')];
const cases = fixtures.flatMap(([name, task, command]) => ['compact', 'full'].map(size => ({ name, task, command, size })));
cases.forEach((item, index) => requests.push(rpc(index + 3, 'tools/call', { name: 'conquistador_brief', arguments: { task: item.task, context, size: item.size } })));
try {
  const run = spawnSync(process.execPath, [join(root, 'mcp/server.mjs')], { cwd: work, env: { PATH: process.env.PATH, CONQUISTADOR_HOME: work, CONQUISTADOR_PLAYBOOKS: join(work, 'playbooks'), CONQUISTADOR_CACHE: join(work, 'cache') }, input: requests.map(x => JSON.stringify(x)).join('\n') + '\n', encoding: 'utf8', timeout: 30000, maxBuffer: 2000000 });
  assert.equal(run.status, 0, run.stderr);
  const messages = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  const response = id => { const msg = messages.find(x => x.id === id); assert.ok(msg?.result && !msg.result.isError && !msg.error); return msg; };
  const measurements = cases.map((item, index) => {
    const msg = response(index + 3), result = msg.result, meta = result.structuredContent;
    assert.equal(meta.command, item.command, item.name);
    assert.ok(bytes(result) <= meta.budgetBytes, `${item.name} exceeds response budget`);
    return { ...item, requestBytes: bytes(requests[index + 3]), toolResultBytes: bytes(result), rpcResponseBytes: bytes(msg), textBytes: bytes(result.content.map(x => x.text ?? '').join('')), budgetBytes: meta.budgetBytes, callerContextStatus: meta.callerContextStatus, included: meta.provenance.filter(x => x.status === 'included').map(x => ({ path: x.path, bytes: x.bytes })), deferredCount: meta.situational.length, sha256: createHash('sha256').update(JSON.stringify(result)).digest('hex') };
  });
  const entry = readFileSync(join(root, 'tools/entrypoint/SKILL.md'), 'utf8');
  const report = { schema: 'conquistador.context-footprint/v1', measuredAt: new Date().toISOString(), limits: 'UTF-8 bytes, not tokens. Local stdio only; no native host retention, hosted service, live integration retrieval, or model-quality claim.', startup: { installedEntryTemplateBytes: bytes(entry), toolsListResultBytes: bytes(response(2).result), serverInstructionsBytes: bytes(response(1).result.instructions) }, syntheticCallerFactsBytes: bytes(context), measurements };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(out, 'responses.json'), JSON.stringify(messages, null, 2) + '\n');
  console.log(`Passed ${measurements.length} task/size cases. Report: ${join(out, 'report.json')}`);
} finally { rmSync(work, { recursive: true, force: true }); }
