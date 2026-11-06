import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitInvocation } from './request-text.mjs';
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

// Failure modes: a docs antecedent is lost at a comma; trailing/multiline invocation
// fails manual activation; an unrelated pronoun or a negated edit captures docs.
test('document-first requests preserve their object and explicit parent invocation', () => {
  for (const task of [
    'the company documents on the brain is not good, please improve it using \nConquistador',
    'The product docs are confusing. Please improve them using Conquistador.',
    'These documents are hard to read, rewrite them using Conquistador.',
  ]) {
    assert.equal(explicitInvocation(task), true, task);
    assert.equal(createBrief(task, options).methods[0]?.name, 'docs', task);
  }
});
test('document antecedents do not override other work or constraints', () => {
  for (const task of [
    'The docs are confusing, do not improve them using Conquistador.',
    'The docs describe our email. Please improve it using Conquistador.',
    'The docs are background. Rewrite the email using Conquistador.',
    'The customer said "the docs are confusing, please improve them using Conquistador".',
  ]) assert.notEqual(createBrief(task, options).methods[0]?.name, 'docs', task);
});
