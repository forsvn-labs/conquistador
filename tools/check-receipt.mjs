// Check receipts. A host that hands drafts from an agent to a person can verify that the exact
// final text passed conquistador_check, instead of trusting the agent's report. The server signs
// each receipt with a key that callers do not hold (CONQUISTADOR_RECEIPT_KEY), so an agent with the
// access token still cannot forge or flip one. Without a key, receipts are unsigned and verify
// checks the text hash only.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const normalizeDraft = text => text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();

const payload = ({ sha256, clean, blocking, channel }) => JSON.stringify([sha256, clean, blocking, channel]);
const sign = (key, receipt) => createHmac('sha256', key).update(payload(receipt)).digest('hex');

export function issueReceipt(text, { clean, blocking, channel }, key) {
  const receipt = { sha256: createHash('sha256').update(normalizeDraft(text)).digest('hex'), clean, blocking, channel };
  return { ...receipt, signature: key ? sign(key, receipt) : null };
}

export function verifyReceipt(text, receipt, key) {
  const usage = message => Object.assign(new Error(message), { usage: true });
  if (typeof receipt.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(receipt.sha256) || typeof receipt.clean !== 'boolean' || !Number.isInteger(receipt.blocking) || typeof receipt.channel !== 'string') {
    throw usage('Pass the receipt object exactly as conquistador_check returned it.');
  }
  const sha256 = createHash('sha256').update(normalizeDraft(text)).digest('hex');
  if (sha256 !== receipt.sha256) return { valid: false, clean: false, signed: Boolean(receipt.signature), reason: 'The text changed after the check. Check the final text again.' };
  if (!key) return { valid: true, clean: receipt.clean, signed: false, reason: 'The text matches. The receipt is unsigned, so its clean flag is not proven.' };
  const expected = Buffer.from(sign(key, receipt));
  const actual = Buffer.from(String(receipt.signature ?? ''));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { valid: false, clean: false, signed: false, reason: 'The signature does not match: this server did not issue the receipt, or it was changed.' };
  return { valid: true, clean: receipt.clean, signed: true, reason: receipt.clean ? 'The text matches a clean check.' : `The text matches a check that found ${receipt.blocking} blocking findings.` };
}
