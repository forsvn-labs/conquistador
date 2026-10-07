// Gaps a deployed agent found on 2026-10-07: a brief that leads with the route and knows it is
// hosted, structured brief output, distinct read errors with relative links, and a check that
// compares claims with the caller's context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpHandler } from './skills-mcp.mjs';
import { packBrief } from './brief.mjs';

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
