import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrief } from './brief.mjs';
// Failure: an inferred article outranks the user's explicit docs command.
test('explicit docs leads when the requested guide also matches article', () => {
  const brief = createBrief('/conquistador docs Write a user guide for importing and reviewing contacts.', { playbooks: [], persistCache: false });
  assert.equal(brief.methods[0].name, 'docs');
});
