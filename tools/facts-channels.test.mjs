// Facts-only channel files on thin routes. Failure modes, written before the change:
// 1. A thin route whose request names SMS or WhatsApp does not read the SMS facts file, so a draft can
//    recommend a send that breaks consent, opt-out, or quiet-hour rules.
// 2. A thin route reads a craft channel file (for example LinkedIn) because it names that platform;
//    craft without a blind-test win must stay out of thin routes.
// 3. A request that names no messaging platform reads the SMS facts file.
// 4. The SMS facts file grows drafting rules instead of dated facts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createBrief } from './brief.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = task => createBrief(task, { root, playbooks: [], persistCache: false }).must.map(item => item.path);
const sms = 'skills/conquistador/channels/sms.md';

test('a thin route that names text messaging reads the SMS facts', () => {
  for (const task of ['Is our SMS opt-in checkbox TCPA compliant?', 'Write an abandoned cart SMS sequence.', 'Write WhatsApp templates for order updates and win-back.']) {
    assert.ok(files(task).includes(sms), `${task}: ${files(task).join(', ')}`);
  }
});

test('a thin route does not read a craft channel file', () => {
  const read = files('Plan a launch campaign for our LinkedIn audience.');
  assert.ok(!read.some(path => path.endsWith('channels/linkedin.md')), read.join(', '));
});

test('a request that names no messaging platform does not read the SMS facts', () => {
  for (const task of ['Plan a win back campaign for lapsed customers.', 'Which channel should we test first for a B2B analytics tool?']) {
    assert.ok(!files(task).includes(sms), `${task}: ${files(task).join(', ')}`);
  }
});

test('the SMS file holds dated facts and the approval boundary, not drafting rules', () => {
  const text = readFileSync(`${root}${sms}`, 'utf8');
  assert.match(text, /## Platform facts \(checked [A-Z][a-z]{2} \d{4}/);
  assert.match(text, /Nothing is sent, published, spent, uploaded, or changed in an account\s+without the user's approval/);
  assert.doesNotMatch(text, /^## (?:Write|Draft|Hook|Structure|Craft)/m);
  assert.ok(Buffer.byteLength(text) <= 2600, `${Buffer.byteLength(text)} bytes`);
});
