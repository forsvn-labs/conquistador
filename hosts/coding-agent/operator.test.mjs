import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  admitRequest, defaultInstalledProfile, loadOperatorProfile, operatorStatus,
  resolveActivation, validateOperatorProfile,
} from './operator.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const profile = () => JSON.parse(readFileSync(join(root, 'skills/conquistador/operator-profile.json'), 'utf8'));

test('installed operator profile is valid, manual, and never watches in the background', () => {
  const installed = validateOperatorProfile(profile());
  assert.equal(installed.activation, 'manual');
  assert.equal(installed.backgroundWatch, false);
  assert.deepEqual(installed.admittedDomains, [
    'product', 'marketing', 'growth', 'sales', 'research', 'creative', 'product-engineering',
  ]);
  assert.throws(() => validateOperatorProfile({ ...installed, backgroundWatch: true }), /backgroundWatch/);
  assert.throws(() => validateOperatorProfile({ ...installed, extra: true }), /Unknown field/);
});

test('older packages without a profile degrade to explicit-invocation-only', () => {
  const missing = loadOperatorProfile(join(root, 'agents'));
  assert.deepEqual(missing, defaultInstalledProfile());
  assert.equal(loadOperatorProfile(root).activation, 'manual');
  assert.throws(() => validateOperatorProfile({ ...profile(), extra: true }));
  assert.throws(() => validateOperatorProfile({ ...profile(), activation: 'watch' }));
});

test('host settings may select project or off without editing the package', () => {
  const installed = profile();
  assert.equal(resolveActivation(installed, {}), 'manual');
  assert.equal(resolveActivation(installed, { activation: 'project' }), 'project');
  assert.equal(resolveActivation(installed, { activation: 'off' }), 'off');
  assert.equal(resolveActivation(installed, { activation: 'always' }), 'manual');
  const status = operatorStatus(installed, { activation: 'project' });
  assert.equal(status.installedActivation, 'manual');
  assert.equal(status.activation, 'project');
  assert.equal(status.backgroundWatch, false);
  assert.equal(status.hostActivationVerified, false);
});

test('manual admits only explicit invocation; off never routes; project admits listed outcomes', () => {
  const installed = profile();
  const ask = text => ({ text });
  assert.equal(admitRequest(installed, ask('/conquistador prepare a campaign plan')).action, 'admit');
  assert.equal(admitRequest(installed, ask('prepare a campaign plan')).reason, 'manual-requires-explicit');
  assert.equal(admitRequest(installed, ask('prepare a campaign plan'), { activation: 'off' }).reason, 'activation-off');
  const project = { activation: 'project' };
  assert.equal(admitRequest(installed, ask('Deliver landing-page copy and a launch email.'), project).action, 'admit');
  assert.equal(admitRequest(installed, ask('Write an outreach sequence for qualified leads.'), project).action, 'admit');
  assert.equal(admitRequest(installed, ask('Map the user flow and write technical documentation.'), project).action, 'admit');
  assert.ok(admitRequest(installed, ask('Prepare a measurement plan for the funnel.'), project).domains.includes('growth'));
  assert.equal(admitRequest(installed, ask('Refactor the parser and add unit tests.'), project).reason, 'unrelated-coding');
  assert.equal(admitRequest(installed, ask('Fix the TypeScript error in landing-page.tsx'), project).reason, 'unrelated-coding');
  assert.equal(admitRequest(installed, ask('Add a CSS tweak to ads.module.css'), project).reason, 'outside-admitted-domains');
});

test('malformed or recursive host input abstains without throwing', () => {
  const installed = profile();
  assert.equal(admitRequest(installed, null).reason, 'malformed-input');
  assert.equal(admitRequest(installed, 'prepare a campaign plan').reason, 'malformed-input');
  assert.equal(admitRequest(installed, { recursive: true, text: '/conquistador hi' }).reason, 'recursive');
  assert.equal(admitRequest(installed, { source: 'conquistador', text: 'campaign plan' }).reason, 'recursive');
  assert.equal(admitRequest(installed, { text: 'x'.repeat(33000) }).reason, 'malformed-input');
  assert.equal(admitRequest(installed, JSON.parse('{"text":"/conquistador hi","__proto__":{"admin":true}}')).reason, 'malformed-input');
});
