// Check receipts let a host enforce the check loop: a small model in the 2026-10-07 run 3 delivered
// text that failed the check while reporting it clean. The host verifies the final text instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMcpHandler } from './skills-mcp.mjs';

const signed = createMcpHandler({ requireInitialize: false, hosted: true, receiptKey: 'server-only-receipt-key' });
const unsigned = createMcpHandler({ requireInitialize: false });
const call = (handle, name, args) => handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
const good = '---\nsubject: Stripe and HubSpot totals\npreheader: One question\n---\nHi Dana,\n\nLedgerline compares the two every night.\n\nWould a 15-minute look be useful?\n\nLedgerline, 100 Example Street, Springfield. To opt out, reply "stop".\n';
const bad = good.replace('Ledgerline compares', 'Unlock seamless growth: Ledgerline compares');
const check = (handle, text) => call(handle, 'conquistador_check', { text, channel: 'email' }).result.structuredContent;
const verify = (handle, text, receipt) => call(handle, 'conquistador_verify', { text, receipt });

test('a check result carries a receipt for the exact text it checked', () => {
  const result = check(signed, good);
  const normalized = good.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
  assert.equal(result.receipt.sha256, createHash('sha256').update(normalized).digest('hex'));
  assert.equal(result.receipt.clean, result.clean);
  assert.equal(result.receipt.blocking, result.blocking);
  assert.equal(result.receipt.channel, 'email');
  assert.match(result.receipt.signature, /^[0-9a-f]{64}$/);
  assert.equal(check(signed, good.replace(/\n/g, '\r\n').replace(/Hi Dana,/, 'Hi Dana,   ')).receipt.sha256, result.receipt.sha256);
});

test('verify accepts the checked text and rejects edited text', () => {
  const { receipt } = check(signed, good);
  const ok = verify(signed, good, receipt).result.structuredContent;
  assert.deepEqual([ok.valid, ok.clean, ok.signed], [true, true, true]);
  const edited = verify(signed, `${good}\nP.S. Teams love it.`, receipt).result.structuredContent;
  assert.equal(edited.valid, false);
  assert.match(edited.reason, /text changed/i);
});

test('a forged or flipped receipt fails the signature', () => {
  const { receipt } = check(signed, bad);
  assert.equal(receipt.clean, false);
  const flipped = verify(signed, bad, { ...receipt, clean: true, blocking: 0 }).result.structuredContent;
  assert.equal(flipped.valid, false);
  assert.match(flipped.reason, /signature/i);
  const forged = verify(signed, bad, { ...receipt, clean: true, signature: 'a'.repeat(64) }).result.structuredContent;
  assert.equal(forged.valid, false);
});

test('without a receipt key, receipts are unsigned and verify checks the hash only', () => {
  const { receipt } = check(unsigned, good);
  assert.equal(receipt.signature, null);
  const result = verify(unsigned, good, receipt).result.structuredContent;
  assert.deepEqual([result.valid, result.signed], [true, false]);
  assert.match(result.reason, /unsigned/i);
  assert.equal(verify(signed, good, receipt).result.structuredContent.valid, false, 'a signed server rejects unsigned receipts');
});

test('verify rejects malformed receipts as usage errors', () => {
  assert.equal(call(signed, 'conquistador_verify', { text: good, receipt: 'clean' }).error?.code, -32602);
  assert.equal(verify(signed, good, { sha256: 'x' }).result.isError, true);
});

test('invalid tool arguments name the arguments the tool takes, without echoing values', () => {
  const response = call(signed, 'conquistador_score', { text: 'secret-draft-xyz', rubric_key: 'ready' });
  assert.equal(response.error.code, -32602);
  assert.match(response.error.message, /conquistador_score/);
  assert.match(response.error.message, /rubric \(required\)/);
  assert.match(response.error.message, /scores \(required\)/);
  assert.match(response.error.message, /hardFails/);
  assert.doesNotMatch(response.error.message, /secret-draft-xyz|rubric_key/);
});
