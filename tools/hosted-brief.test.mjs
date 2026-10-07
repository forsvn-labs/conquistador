// Gaps a deployed agent found on 2026-10-07: a brief that leads with the route and knows it is
// hosted, structured brief output, distinct read errors with relative links, and a check that
// compares claims with the caller's context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpHandler } from './skills-mcp.mjs';
import { packBrief } from './brief.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Read only the bundled library, never this machine's own playbooks; userPlaybookRoots reads these at call time.
process.env.CONQUISTADOR_HOME = mkdtempSync(join(tmpdir(), 'conquistador-home-'));
delete process.env.CONQUISTADOR_PLAYBOOKS;

const hosted = createMcpHandler({ requireInitialize: false, hosted: true });
const local = createMcpHandler({ requireInitialize: false });
const call = (handle, name, args) => handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
const task = 'Draft a 3-email cold sequence to RevOps leads at B2B SaaS companies';

test('a hosted brief says there is no repository; a local brief does not', () => {
  const remote = call(hosted, 'conquistador_brief', { task }).result.content[0].text;
  const stdio = call(local, 'conquistador_brief', { task }).result.content[0].text;
  assert.match(remote, /no repository/i);
  assert.match(remote, /\.forsvn\//);
  assert.doesNotMatch(stdio, /no repository/i);
});

test('a brief leads with the route and asks for the requested deliverable first', () => {
  const text = call(local, 'conquistador_brief', { task }).result.content[0].text;
  const start = text.indexOf('Start here:');
  assert.ok(start > 0 && start < text.indexOf('Rules for this task:'));
  assert.match(text.slice(start, start + 300), /outreach/);
  assert.match(text, /Lead with the deliverable the user asked for/);
});

test('the brief returns structured lists that match the pack text', () => {
  const response = call(local, 'conquistador_brief', { task });
  const brief = response.result.structuredContent;
  const text = response.result.content[0].text;
  assert.equal(brief.action, 'brief');
  assert.equal(brief.command, 'outreach');
  assert.ok(brief.inlined.length >= 5);
  for (const item of brief.inlined) assert.ok(text.includes(`File: ${item.path}`), item.path);
  for (const path of brief.readNow) assert.ok(!text.includes(`File: ${path}`), path);
  assert.ok(Array.isArray(brief.situational) && Array.isArray(brief.readAtStep));
  const tool = local({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).result.tools.find(item => item.name === 'conquistador_brief');
  for (const key of ['action', 'inlined', 'readNow', 'readAtStep', 'situational']) assert.ok(key in tool.outputSchema.properties, key);
  const none = packBrief({ action: 'none' });
  assert.equal(none.structured.action, 'none');
  assert.match(none.text, /No Conquistador method matches/);
});

test('read errors name their cause without echoing the supplied path', () => {
  const read = args => call(local, 'conquistador_read', args).result;
  const missing = read({ path: 'conquistador/commands/outreach/references/secret-plan-xyz.md' });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /not found/i);
  assert.doesNotMatch(missing.content[0].text, /secret-plan-xyz/);
  const invalid = read({ path: '../../etc/passwd.md' });
  assert.match(invalid.content[0].text, /invalid path/i);
  const unsupported = read({ path: 'conquistador/commands/outreach/COMMAND.exe' });
  assert.match(unsupported.content[0].text, /invalid path|unsupported/i);
});

test('read resolves a relative link from the file that contains it, inside the library only', () => {
  const read = args => call(local, 'conquistador_read', args).result;
  const ok = read({ path: '../agents/critic.md', from: 'conquistador/commands/outreach/references/method.md' });
  assert.ok(!ok.isError, ok.content[0].text);
  assert.ok(ok.content[0].text.length > 200);
  const prefixed = read({ path: '../agents/critic.md', from: 'skills/conquistador/commands/outreach/references/method.md' });
  assert.ok(!prefixed.isError);
  const escape = read({ path: '../../../../../outside.md', from: 'conquistador/commands/outreach/references/method.md' });
  assert.equal(escape.isError, true);
  assert.match(escape.content[0].text, /invalid path/i);
  assert.equal(call(local, 'conquistador_read', { path: 'x.md', from: 7 }).error?.code, -32602);
});

const email = body => `---\nsubject: Stripe and HubSpot totals\n---\nHi Dana,\n\n${body}\n\nWould a 15-minute look at one month of your data be useful?\n\nLedgerline, {{company_address}}. To opt out, reply "stop".\n`;
const rules = (text, context) => {
  const result = call(local, 'conquistador_check', { text, channel: 'email', ...(context === undefined ? {} : { context }) }).result.structuredContent;
  return result.findings.filter(finding => finding.rule === 'claim-not-in-context');
};
const context = 'Product: Ledgerline compares Stripe and HubSpot revenue nightly. Proof: 41 paying teams. No case studies.';

test('with context, a number the context lacks is flagged and a number it has is not', () => {
  const flagged = rules(email('Teams cut month-end close by 40% with Ledgerline.'), context);
  assert.equal(flagged.length, 1);
  assert.match(flagged[0].snippet, /40%/);
  assert.equal(flagged[0].severity, 'warning');
  assert.equal(rules(email('41 paying teams use Ledgerline every night.'), context).length, 0);
});

test('with context, a named customer the context lacks is flagged', () => {
  const flagged = rules(email('Teams like Acme and Northwind already use Ledgerline.'), context);
  assert.ok(flagged.some(finding => /Acme/.test(finding.snippet)));
  assert.ok(flagged.some(finding => /Northwind/.test(finding.snippet)));
  assert.equal(rules(email('Ledgerline compares Stripe and HubSpot every night.'), context).length, 0);
});

test('the ask line, merge tags, and checks without context are not flagged', () => {
  assert.equal(rules(email('Ledgerline lists each mismatch with its records.'), context).length, 0);
  assert.equal(rules(email('Teams cut month-end close by 40%.')).length, 0);
  assert.equal(call(local, 'conquistador_check', { text: 'Hi', context: 5 }).error?.code, -32602);
});

test('a number keeps its unit when compared, and hyphenated words are not claims', () => {
  const percent = 'Product: Ledgerline. Proof: 10% fewer manual checks in one pilot.';
  assert.ok(rules(email('Ledgerline makes reconciliation 10x faster.'), percent).some(finding => finding.snippet === '10x'));
  assert.equal(rules(email('In one pilot, Ledgerline led to 10% fewer manual checks.'), percent).length, 0);
  assert.equal(rules(email('This is the second note in a 3-email series about month-end.'), context).length, 0);
});

// Findings from the second deployed-agent run (2026-10-07, live endpoint).
const checkEmail = (body, extra = {}) => call(local, 'conquistador_check', { text: email(body), channel: 'email', ...extra }).result.structuredContent.findings;

test('a range in the context covers the same numbers written another way', () => {
  const ranged = 'Buyer: RevOps leads at 50-500 person B2B SaaS companies.';
  assert.equal(rules(email('I write to RevOps leads at companies with 50 to 500 people.'), ranged).length, 0);
});

test('pronouns, weekdays, and words after the clause are not customer names', () => {
  const flagged = rules(email('It is built for teams like yours. We can talk Friday. Our pilot is small.'), context).map(finding => finding.snippet);
  for (const word of ['We', 'Friday', 'Our']) assert.ok(!flagged.includes(word), word);
  assert.ok(rules(email('Used by Acme, Northwind, and Initech today.'), context).some(finding => finding.snippet === 'Initech'));
});

test('presumed pain and relative send timing in email are flagged', () => {
  assert.ok(checkEmail('I noticed your team is struggling with month-end.').some(finding => finding.rule === 'email-presumed-pain'));
  assert.ok(checkEmail('I wrote last week about the mismatch list.').some(finding => finding.rule === 'email-relative-time'));
  assert.ok(!checkEmail('Ledgerline lists each mismatch with its records.').some(finding => ['email-presumed-pain', 'email-relative-time'].includes(finding.rule)));
});

test('merge tags that stand in for required facts are flagged as unresolved', () => {
  const finding = checkEmail('Ledgerline lists each mismatch.').find(item => item.rule === 'email-merge-tag');
  assert.equal(finding?.severity, 'advisory');
  assert.match(finding.snippet, /company_address/);
});

test('a hosted brief points single agents to the sequential fallback, and cold email brings the email guide', () => {
  const text = call(hosted, 'conquistador_brief', { task: 'Write a cold email to RevOps leads' }).result;
  assert.match(text.content[0].text, /fallbacks\/sequential\.md/);
  const brief = text.structuredContent;
  assert.ok(brief.inlined.some(item => item.path.endsWith('outreach/references/channels/email.md')), JSON.stringify(brief.inlined.map(item => item.path)));
  assert.ok(![...brief.situational, ...brief.inlined.map(item => item.path)].some(path => path.endsWith('conquistador/welcome.md')));
});
