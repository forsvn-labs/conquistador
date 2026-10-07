// Check receipts. A host that hands drafts from an agent to a person can verify that the exact
// final text passed conquistador_check, instead of trusting the agent's report. The server signs
// each receipt with a key that callers do not hold (CONQUISTADOR_RECEIPT_KEY), so an agent with the
// access token still cannot forge or flip one. Without a key, receipts are unsigned and prove only
// the text match; a host that relies on receipts must require signed ones.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Only line endings are normalized: indentation and trailing spaces change Markdown meaning.
export const normalizeDraft = text => text.replace(/\r\n/g, '\n');
const digest = text => createHash('sha256').update(text).digest('hex');

// The signature covers the text, the result, and the inputs that decided it (channel, format, context).
const payload = ({ sha256, clean, blocking, channel, format, contextSha256 }) => JSON.stringify([sha256, clean, blocking, channel, format, contextSha256]);
const sign = (key, receipt) => createHmac('sha256', key).update(payload(receipt)).digest('hex');

export function issueReceipt(text, { clean, blocking, channel, format, context }, key) {
  const receipt = { sha256: digest(normalizeDraft(text)), clean, blocking, channel, format, contextSha256: context?.trim() ? digest(context.trim()) : null };
  return { ...receipt, signature: key ? sign(key, receipt) : null };
}

export function verifyReceipt(text, receipt, key, expected = {}) {
  const usage = message => Object.assign(new Error(message), { usage: true });
  if (typeof receipt.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(receipt.sha256) || typeof receipt.clean !== 'boolean' || !Number.isInteger(receipt.blocking) || typeof receipt.channel !== 'string' || typeof receipt.format !== 'string' || !(receipt.contextSha256 === null || /^[0-9a-f]{64}$/.test(receipt.contextSha256 ?? ''))) {
    throw usage('Pass the receipt object exactly as conquistador_check returned it.');
  }
  const sha256 = digest(normalizeDraft(text));
  if (sha256 !== receipt.sha256) return { valid: false, clean: false, signed: Boolean(receipt.signature), reason: 'The text changed after the check. Check the final text again.' };
  // The host states what the check had to use; a check run without it does not count.
  if (expected.channel !== undefined && expected.channel !== receipt.channel) return { valid: false, clean: false, signed: Boolean(receipt.signature), reason: `The check used channel ${receipt.channel}, not ${expected.channel}.` };
  if (expected.context !== undefined && (expected.context.trim() ? digest(expected.context.trim()) : null) !== receipt.contextSha256) return { valid: false, clean: false, signed: Boolean(receipt.signature), reason: 'The check did not use the expected context. Check the text again with that context.' };
  if (!key) return { valid: true, clean: receipt.clean, signed: false, reason: 'The text matches. The receipt is unsigned, so its clean flag is not proven.' };
  const signature = Buffer.from(sign(key, receipt));
  const actual = Buffer.from(String(receipt.signature ?? ''));
  if (actual.length !== signature.length || !timingSafeEqual(actual, signature)) return { valid: false, clean: false, signed: false, reason: 'The signature does not match: this server did not issue the receipt, or it was changed.' };
  return { valid: true, clean: receipt.clean, signed: true, reason: receipt.clean ? 'The text matches a clean check.' : `The text matches a check that found ${receipt.blocking} blocking findings.` };
}
