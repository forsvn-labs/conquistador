// The rubric gate check, the compact brief, and the custom domain (ROADMAP item 0, 2026-10-07).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMcpHandler } from './skills-mcp.mjs';
import { evaluateGate } from './rubric-gate.mjs';

const handle = createMcpHandler({ requireInitialize: false, hosted: true });
const call = (name, args) => handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
const rubric = 'conquistador/commands/outreach/references/copy-validation-rubric.md';
const all = value => ({ 'Peer voice': value, 'Signal connection': value, 'CTA friction': value, 'Recipient relevance': value, Specificity: value });
const score = args => call('conquistador_score', { rubric, ...args }).result;

test('the score tool is listed as read-only with a closed schema and an output schema', () => {
  const tool = handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools.find(item => item.name === 'conquistador_score');
  assert.ok(tool);
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.deepEqual(tool.inputSchema.required, ['rubric', 'scores']);
  for (const key of ['verdict', 'total', 'max', 'failures', 'missing']) assert.ok(key in tool.outputSchema.properties, key);
});

test('a rubric without a gate, or a missing rubric, is a clear error', () => {
  const none = score({ rubric: 'conquistador/commands/outreach/references/anti-patterns.md', variant: 'ready', scores: all(7) });
  assert.equal(none.isError, true);
  assert.match(none.content[0].text, /no machine-readable gate/i);
  const missing = score({ rubric: 'conquistador/commands/outreach/references/nope-xyz.md', scores: all(7) });
  assert.equal(missing.isError, true);
  assert.doesNotMatch(missing.content[0].text, /nope-xyz/);
});

test('a rubric with variants needs one, and the error lists them', () => {
  const result = score({ scores: all(7) });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /ready/);
  assert.match(result.content[0].text, /needs-signal/);
});

test('floors, totals, and the concerns band decide the verdict', () => {
  assert.equal(score({ variant: 'ready', scores: all(9) }).structuredContent.verdict, 'pass');
  const concerns = score({ variant: 'ready', scores: { ...all(7), Specificity: 8 } }).structuredContent;
  assert.equal(concerns.total, 36);
  assert.equal(concerns.verdict, 'pass_with_concerns');
  const low = score({ variant: 'ready', scores: { ...all(9), 'CTA friction': 5 } }).structuredContent;
  assert.equal(low.verdict, 'fail');
  assert.ok(low.failures.some(item => /CTA friction/.test(item)));
  assert.equal(score({ variant: 'ready', scores: all(6) }).structuredContent.verdict, 'fail');
});

test('a missing dimension makes the result incomplete', () => {
  const { 'Peer voice': _, ...rest } = all(8);
  const result = score({ variant: 'ready', scores: rest }).structuredContent;
  assert.equal(result.verdict, 'incomplete');
  assert.deepEqual(result.missing, ['Peer voice']);
});

test('unknown names, out-of-scale values, and misplaced N/A are usage errors', () => {
  assert.match(score({ variant: 'ready', scores: { ...all(8), Vibes: 9 } }).content[0].text, /Peer voice/);
  assert.equal(score({ variant: 'ready', scores: { ...all(8), Specificity: 11 } }).isError, true);
  assert.equal(score({ variant: 'ready', scores: { ...all(8), Specificity: 'great' } }).isError, true);
  assert.equal(score({ variant: 'ready', scores: { ...all(8), Specificity: 'N/A' } }).isError, true);
  const template = score({ variant: 'needs-signal', scores: { ...all(7), 'Signal connection': 'N/A' } }).structuredContent;
  assert.equal(template.max, 40);
  assert.equal(template.total, 28);
  assert.equal(template.verdict, 'pass');
  assert.equal(call('conquistador_score', { rubric, scores: 'all good' }).error?.code, -32602);
});

test('a hard fail fails the draft whatever the total, and unknown hard-fail ids are errors', () => {
  const failed = score({ variant: 'ready', scores: all(10), hardFails: ['fabricated-observation'] }).structuredContent;
  assert.equal(failed.verdict, 'fail');
  assert.ok(failed.failures.some(item => /fabricated-observation/.test(item)));
  assert.match(score({ variant: 'ready', scores: all(10), hardFails: ['bad-vibes'] }).content[0].text, /unsupported-claim/);
});

test('level scales (pass, weak, fail) are evaluated by the same gate', () => {
  const gate = { scale: { levels: ['fail', 'weak', 'pass'] }, dimensions: ['A', 'B', 'C'], variants: { default: { minEach: 'weak', maxAtLevel: { weak: 1 } } } };
  assert.equal(evaluateGate(gate, { scores: { A: 'pass', B: 'pass', C: 'weak' } }).verdict, 'pass');
  assert.equal(evaluateGate(gate, { scores: { A: 'weak', B: 'pass', C: 'weak' } }).verdict, 'fail');
  assert.equal(evaluateGate(gate, { scores: { A: 'fail', B: 'pass', C: 'pass' } }).verdict, 'fail');
});

test('a compact brief inlines only the command and its core files, and keeps the rules', () => {
  const task = 'Draft a 3-email cold sequence to RevOps leads at B2B SaaS companies';
  const full = call('conquistador_brief', { task });
  const compact = call('conquistador_brief', { task, size: 'compact', context: 'Product: Ledgerline.' });
  const fullText = full.result.content[0].text;
  const text = compact.result.content[0].text;
  assert.ok(Buffer.byteLength(text) < Buffer.byteLength(fullText) * 0.4, `${Buffer.byteLength(text)} vs ${Buffer.byteLength(fullText)}`);
  for (const marker of ['Start here:', 'Caller context', 'Rules for this task:', 'conquistador_check']) assert.ok(text.includes(marker), marker);
  const structured = compact.result.structuredContent;
  assert.ok(structured.inlined.some(item => item.path.endsWith('outreach/COMMAND.md')));
  assert.ok(structured.situational.length > full.result.structuredContent.situational.length);
  assert.ok(structured.readNow.some(path => path.endsWith('copy-validation-rubric.md')), 'core files become required reads');
  assert.match(text, /Read now, one file per conquistador_read call/);
  assert.equal(call('conquistador_brief', { task, size: 'tiny' }).result.isError, true);
});

test('the Worker serves mcp.forsvn.com as a custom domain and keeps workers.dev', () => {
  const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.match(config, /pattern = "mcp\.forsvn\.com", custom_domain = true/);
  assert.doesNotMatch(config, /^workers_dev = false/m);
});
