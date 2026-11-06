import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrief, packBrief } from './brief.mjs';
import { loadRoutingContract } from './routing-contract.mjs';
import { explicitInvocation, invokedCommand } from './request-text.mjs';
const options = { playbooks: [], persistCache: false };
const contract = loadRoutingContract(process.cwd());
const prefixes = ['conquistador ', '/conquistador ', 'Use Conquistador ', '$conquistador:conquistador '];
// Failure modes: prefix-dependent command/workflow selection, lost aliases, empty parent
// falls through, management becomes marketing, explicit choices lose to context, negation ignored.
test('every command and workflow is reachable through each parent invocation', () => {
  for (const name of [...Object.keys(contract.methods), ...contract.plays.map(p => p.name)]) {
    for (const prefix of prefixes) {
      const task = prefix + name, b = createBrief(task, options);
      assert.ok(b.methods?.[0]?.name === name || b.play?.name === name, task);
      if (b.play) assert.ok(b.play.steps.some(step => step.now), task);
    }
  }
});
test('legacy command and play names remain reachable', () => {
  for (const item of [...Object.values(contract.methods), ...contract.plays])
    for (const legacy of item.legacy ?? []) {
      const b = createBrief(`Use Conquistador ${legacy}`, options);
      assert.ok(b.methods?.[0]?.name === item.name || b.play?.name === item.name, legacy);
    }
});
test('plain parent, management and unrecognized explicit requests return bounded parent guidance', () => {
  for (const task of ['Conquistador', '/conquistador', '$conquistador:conquistador', 'Use Conquistador',
    'Conquistador help', 'Conquistador hooks off', 'Conquistador update', 'Conquistador status',
    'Conquistador remove', 'Conquistador unpin docs', 'Conquistador frobnicate']) {
    const brief = createBrief(task, options);
    assert.equal(brief.action, 'brief', task);
    const pack = packBrief(brief);
    assert.equal(pack.structured.action, 'brief', task);
    assert.match(pack.text, /conquistador_methods/);
    assert.match(pack.text, /conquistador --help/);
    assert.doesNotMatch(pack.text, /Continue with the user request without marketing guidance/);
    assert.ok(Buffer.byteLength(JSON.stringify({content:[{type:'text',text:pack.text}],structuredContent:pack.structured})) <= 4000);
  }
});
test('plain invocation activates intentionally; quoted, negated and incidental mentions do not', () => {
  assert.equal(explicitInvocation('Conquistador docs'), true);
  for (const task of ['Do not use Conquistador docs.', 'The example says "Conquistador docs".', 'We compared Conquistador yesterday.']) {
    assert.equal(explicitInvocation(task), false, task);
    assert.equal(invokedCommand(task), null, task);
  }
  for (const prefix of prefixes) {
    const b = createBrief(`${prefix}docs Write a guide to email marketing.`, options);
    assert.equal(b.methods[0]?.name, 'docs');
  }
});

test('natural purpose wording does not become an explicit command, and an opt-out suppresses routing', () => {
  const natural = createBrief('plan a launch', options);
  const invoked = createBrief('Use Conquistador to plan a launch', options);
  assert.equal(invoked.play?.name, natural.play?.name);
  assert.equal(invoked.methods[0]?.name, natural.methods[0]?.name);
  assert.equal(createBrief('Do not use Conquistador. Update the docs.', options).action, 'none');
});
