// Distilled AI-writing tells for the deterministic checker, written before the rules.
// Failure modes:
// 1. A tell that a fixed pattern can catch passes unflagged (each rule has two invented tells).
// 2. A sentence that looks similar but is fine gets flagged (each rule has a fine twin).
// 3. A social-only rule fires on a landing page or an email.
// 4. A count rule (bullets, intensifiers) fires on one or two instances.
// 5. A new rule is missing from the public catalog in docs-site/check.mdx.
// 6. A claim with a source marker is still flagged as crowd proof (extends claim-vague-proof, no duplicate rule).
// 7. Two rules report the same phrase.
// 8. A post-draft rule leaks into the drafting guide, whose content passed human blind tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkText } from './check/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hits = (text, id, options = {}) => checkText(text, { file: 'page.md', ...options }).filter(finding => finding.rule === id);

const cases = [
  { id: 'ai-negation-list', tells: ['No spreadsheets, no manual matching, no month-end panic.', 'No install. No meetings. Just books that balance.'],
    fine: ['Free for 14 days. No card required.', 'There is no setup fee and no minimum term.'] },
  { id: 'ai-stock-transformation', tells: ['Say goodbye to spreadsheets and hello to clarity.', 'Bookkeeping, reimagined for small clinics.', 'It will transform the way you run payroll.'],
    fine: ['Say goodbye to Ana at Friday lunch; she starts in Lisbon on Monday.', 'We changed how payroll exports work in version 4.'] },
  { id: 'claim-vague-proof', tells: ['Trusted by industry leaders worldwide.', 'Teams around the world trust Fernway for payroll.'],
    fine: ['Used by 212 dental clinics in Ontario (customer count, March 2026).', 'Join the waitlist for early access.'] },
  { id: 'ai-effortless', tells: ['Effortless reconciliation for every account.', 'Book a room in just a few clicks.', 'Set it and forget it.'],
    fine: ['Setup takes 3 steps and about 4 minutes.', 'Click Export, then choose CSV.'] },
  { id: 'ai-hook-slop', tells: ['Stop scrolling. You need to hear this.', "Here's what nobody tells you about invoicing."],
    fine: ['Stop the sync before you rename the folder.', 'Most clinics bill on the first of the month.'] },
  { id: 'ai-stock-email-opener', tells: ['I hope this email finds you well.', 'Just following up on my previous note.', 'Touching base about the renewal.'],
    fine: ['Following up with the CSV you asked for on Tuesday; it is attached.', 'I hope the move to Austin went smoothly, Priya.'] },
  { id: 'ai-math-letters', tells: ["𝗛𝗲𝗿𝗲'𝘀 𝘄𝗵𝗮𝘁 𝘄𝗲 𝗹𝗲𝗮𝗿𝗻𝗲𝗱.", 'Read the 𝘧𝘶𝘭𝘭 story below.'],
    fine: ['Here is what we learned.', 'Open Settings → Billing → Export.'] },
  { id: 'ai-performed-cleverness', tells: ['Your inbox, minus the noise.', 'Spreadsheets on steroids.'],
    fine: ['Your inbox, sorted by sender.', 'Spreadsheet formulas, checked against last month\'s bank file.'] },
];

for (const item of cases) {
  test(`${item.id} flags its tells`, () => {
    for (const tell of item.tells) assert.ok(hits(tell, item.id).length, `expected ${item.id} on: ${tell}`);
  });
  test(`${item.id} leaves its fine twins alone`, () => {
    for (const fine of item.fine) assert.deepEqual(hits(fine, item.id), [], `unexpected ${item.id} on: ${fine}`);
  });
}

test('ai-engagement-bait flags a social post that ends by fishing for reactions', () => {
  for (const ending of ['Agree?', 'Thoughts?', 'Repost if this helped someone on your team.']) {
    const post = `We cut our close from 9 days to 4 by moving approvals into one queue.\n\n${ending}`;
    assert.ok(hits(post, 'ai-engagement-bait', { channel: 'linkedin' }).length, ending);
  }
  const real = 'We cut our close from 9 days to 4.\n\nWhich format do your auditors ask for, CSV or PDF?';
  assert.deepEqual(hits(real, 'ai-engagement-bait', { channel: 'linkedin' }), []);
  assert.deepEqual(hits('Our plan is simple.\n\nThoughts?', 'ai-engagement-bait', { channel: 'landing' }), [], 'social only');
});

test('ai-empty-comment flags a social reply with no information', () => {
  for (const comment of ['Great post! 🙌', 'This is gold 🔥', 'So true.']) assert.ok(hits(comment, 'ai-empty-comment', { channel: 'linkedin' }).length, comment);
  assert.deepEqual(hits('Great post. We cut our pager rotation to two people and handoffs got worse.', 'ai-empty-comment', { channel: 'linkedin' }), []);
  assert.deepEqual(hits('Great post!', 'ai-empty-comment', { channel: 'email' }), [], 'social only');
});

test('ai-verb-bullets needs three bullets in a row that open with a product verb', () => {
  const tell = '- Ensures data accuracy\n- Provides real-time insight\n- Enables faster decisions\n';
  assert.ok(hits(tell, 'ai-verb-bullets').length);
  assert.deepEqual(hits('- Ensures data accuracy\n- Provides real-time insight\n', 'ai-verb-bullets'), []);
  assert.deepEqual(hits('- Matches receipts to bank lines\n- Flags duplicates\n- Exports to CSV\n', 'ai-verb-bullets'), []);
});

test('ai-intensifiers needs a cluster, not one word', () => {
  assert.ok(hits('This is truly useful. It is genuinely fast. The team is incredibly happy.', 'ai-intensifiers').length);
  assert.deepEqual(hits('This is truly useful. It exports to CSV.', 'ai-intensifiers'), []);
});

test('no two rules report the same tell', () => {
  for (const tell of cases.flatMap(item => item.tells)) {
    const ids = checkText(tell, { file: 'page.md' }).filter(finding => finding.family === 'ai-tells' || finding.rule === 'claim-vague-proof').map(finding => finding.rule);
    assert.equal(new Set(ids).size, ids.length, `${tell}: ${ids.join(', ')}`);
    const distilled = ids.filter(id => cases.some(item => item.id === id));
    assert.ok(distilled.length <= 1, `${tell}: ${ids.join(', ')}`);
  }
});

test('post-draft rules stay out of the drafting guide', async () => {
  const { rules } = await import('./check/rules.mjs');
  const guide = readFileSync(`${root}skills/conquistador/references/writing-guide.md`, 'utf8');
  const distilled = [...cases.map(item => item.id), 'ai-engagement-bait', 'ai-empty-comment', 'ai-verb-bullets', 'ai-intensifiers'].filter(id => id.startsWith('ai-'));
  for (const id of distilled) {
    assert.equal(rules.find(rule => rule.id === id)?.postDraft, true, `${id} is post-draft`);
    assert.ok(!guide.includes(`\`${id}\``), `${id} is in the drafting guide`);
  }
});

test('every distilled rule is in the public catalog', () => {
  const catalog = readFileSync(`${root}docs-site/check.mdx`, 'utf8');
  for (const id of [...cases.map(item => item.id), 'ai-engagement-bait', 'ai-empty-comment', 'ai-verb-bullets', 'ai-intensifiers']) {
    assert.match(catalog, new RegExp(`\`${id}\``), `${id} missing from docs-site/check.mdx`);
  }
});
