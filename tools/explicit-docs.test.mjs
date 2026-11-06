import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrief } from './brief.mjs';
// Failure: an inferred article outranks the user's explicit docs command.
test('explicit docs leads when the requested guide also matches article', () => {
  const brief = createBrief('/conquistador docs Write a user guide for importing and reviewing contacts.', { playbooks: [], persistCache: false });
  assert.equal(brief.methods[0].name, 'docs');
});

test('plain product user guides route to docs', () => {
  assert.equal(createBrief('Write a product user guide', { playbooks: [], persistCache: false }).methods[0].name, 'docs');
});
test('full docs briefs omit historical pipelines', async () => {
  const { packBrief } = await import('./brief.mjs');
  const pack = packBrief(createBrief('/conquistador docs Write a user guide', { playbooks: [], persistCache: false }));
  assert.ok(!pack.structured.provenance.some(x => x.status === 'included' && x.path.endsWith('docs-writing-method.md')));
});
