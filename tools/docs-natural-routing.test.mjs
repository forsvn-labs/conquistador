import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrief, packBrief } from './brief.mjs';
// Failure modes: natural docs updates abstain; explicit parent use still abstains;
// a multi-document request gets cleanup instead of docs; background mentions hijack other work.
const options = { playbooks: [], persistCache: false };
test('natural documentation updates load the visual docs entry', () => {
  for (const task of ['update the docs', 'Use Conquistador to update the docs',
    'Update the documentation', 'Improve our existing docs', 'Rewrite these five documents',
    'Update these five documents and the Drive guide', 'Refresh the user guide']) {
    const brief = createBrief(task, options);
    assert.equal(brief.methods[0]?.name, 'docs', task);
    const pack = packBrief(brief);
    assert.ok(pack.structured.provenance.some(x => x.status === 'included' && x.path.endsWith('/docs/ENTRY.md')), task);
    assert.match(pack.text, /Cap/);
    assert.match(pack.text, /Pele/);
  }
});
test('background, quoted and negated docs mentions do not hijack routing', () => {
  for (const task of ['Do not update the docs.', 'The customer said "update the docs".',
    'Fix the Python script that updates the docs.', 'Move these documents to another Drive folder.',
    'Write a launch email using the docs as background.']) {
    assert.notEqual(createBrief(task, options).methods[0]?.name, 'docs', task);
  }
});
