import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPackageBoundary } from './package-boundary.mjs';

const file = text => ({ mode: '100644', bytes: Buffer.from(text) });
test('source-import guards reject book binaries, transcript dumps, private roots and provenance', () => {
  for (const path of ['book.epub', 'input/captions.vtt', 'knowledge/private.md', 'wiki/customer.md', 'data/knowledge-roots.json', 'raw-urls.md']) {
    assert.throws(() => checkPackageBoundary({ [path]: file('Synthetic input') }), /outside the product boundary/);
  }
});
test('a host-supplied synthetic fingerprint catches copied text under an ordinary method path', () => {
  const sentinel = 'SYNTHETIC_PRIVATE_' + 'SOURCE_FINGERPRINT_0123456789';
  assert.throws(() => checkPackageBoundary({ 'skills/write-copy/method.md': file(`Original heading\n${sentinel}`) }, [sentinel]), /Private source match/);
  assert.equal(checkPackageBoundary({ 'skills/write-copy/method.md': file('Original product method.') }, [sentinel]).semanticReviewRequired, true);
});
