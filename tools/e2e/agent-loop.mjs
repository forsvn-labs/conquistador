#!/usr/bin/env node
// E2E for the deployed-agent loop over Streamable HTTP. Offline, no model, no key.
// Serves the same handler as the hosted function (token required) on loopback, then walks the
// loop a deployed agent follows: initialize, tools/list, brief with caller context, check a
// first draft, check the revision. The drafts are fixed fixtures, so every run is comparable.
// With --url and CONQUISTADOR_MCP_TOKEN it runs the same steps against a deployed server.
// Report: dist/e2e/agent-loop/report.json and report.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMcpRequestHandler } from '../mcp-http.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = resolve(option('--out') ?? join(root, 'dist/e2e/agent-loop'));

const task = 'Write the first cold email of a sequence to RevOps leads at mid-market B2B SaaS companies.';
const context = [
  'Product: Ledgerline (synthetic test product) reconciles Stripe and HubSpot revenue every night and flags mismatches.',
  'Buyer: RevOps lead at a 50-500 person B2B SaaS company.',
  'Proof: none supplied. Do not invent customers or numbers.',
  'Voice: plain, specific, no hype.',
].join('\n');
const firstDraft = `---
subject: Unlock seamless revenue ops!!
---
Hi {first_name},

In today's fast-paced world, RevOps teams are drowning. Ledgerline is a game-changer that will 10x your accuracy, guaranteed.

Click here to learn more.
`;
const revision = `---
subject: Stripe and HubSpot totals for last month
---
Hi Dana,

When Stripe and HubSpot disagree on last month's revenue, someone on RevOps usually rebuilds the numbers by hand.

Ledgerline compares the two every night and lists each mismatch with the records behind it.

Would a 15-minute look at one month of your data be useful?

Ledgerline, 100 Example Street, Springfield. To opt out, reply "stop" and I will not email you again.
`;

const steps = [];
async function main() {
  let url = option('--url');
  let token = process.env.CONQUISTADOR_MCP_TOKEN;
  let server;
  if (!url) {
    // Ignore this machine's own playbooks so every local run reads the same library.
    process.env.CONQUISTADOR_HOME = join(out, 'empty-home');
    delete process.env.CONQUISTADOR_PLAYBOOKS;
    token = randomBytes(24).toString('hex');
    server = createServer(createMcpRequestHandler({ token, requireToken: true }));
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    url = `http://127.0.0.1:${server.address().port}/mcp`;
  }
  if (!token) throw Error('Set CONQUISTADOR_MCP_TOKEN to run against --url.');
  let id = 0;
  const rpc = async (method, params) => {
    const started = performance.now();
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
    const body = await response.json();
    return { status: response.status, body, ms: Math.round(performance.now() - started) };
  };
  const record = (name, passed, detail) => { steps.push({ name, passed, ...detail }); };
  // A tool error returns plain text; record the step as failed instead of stopping the report.
  const parsed = response => { try { return response.body.result?.isError ? {} : JSON.parse(response.body.result?.content[0].text ?? '{}'); } catch { return {}; } };
  try {
    const unauthorized = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    record('request without a token is refused', unauthorized.status === 401, { status: unauthorized.status });

    const init = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'agent-loop-e2e', version: '1' } });
    record('initialize names the loop in its instructions', /conquistador_check/.test(init.body.result?.instructions ?? ''), { status: init.status, ms: init.ms });

    const list = await rpc('tools/list', {});
    const names = list.body.result?.tools.map(tool => tool.name) ?? [];
    record('tools/list offers brief and check', names.includes('conquistador_brief') && names.includes('conquistador_check'), { tools: names, ms: list.ms });

    const brief = await rpc('tools/call', { name: 'conquistador_brief', arguments: { task, context } });
    const text = brief.body.result?.content[0].text ?? '';
    const command = text.match(/^Commands: (.*)$/m)?.[1];
    const files = [...text.matchAll(/^File: (.*)$/gm)].map(match => match[1]);
    record('brief routes to outreach, carries the context, and requires the check', /\[outreach\]/.test(command ?? '') && text.includes('Ledgerline') && /conquistador_check/.test(text), { command, files, bytes: Buffer.byteLength(text), ms: brief.ms });

    // The library tools read the bundled files directly; a host without full node:fs fails here.
    const methods = await rpc('tools/call', { name: 'conquistador_methods', arguments: {} });
    const methodList = parsed(methods);
    const listing = await rpc('tools/call', { name: 'conquistador_files', arguments: { method: 'outreach' } });
    const fileList = parsed(listing).files ?? [];
    const read = await rpc('tools/call', { name: 'conquistador_read', arguments: { path: 'conquistador/commands/outreach/references/frameworks/ctas.md' } });
    const search = await rpc('tools/call', { name: 'conquistador_search', arguments: { query: 'cold email call to action' } });
    record('methods, files, read, and search answer from the bundled library', methodList.methods?.length > 30 && methodList.plays?.length > 10 && fileList.length > 10 && (read.body.result?.content[0].text ?? '').length > 500 && !read.body.result?.isError && !search.body.result?.isError,
      { commands: methodList.methods?.length, plays: methodList.plays?.length, outreachFiles: fileList.length, readBytes: (read.body.result?.content[0].text ?? '').length, ms: methods.ms + listing.ms + read.ms + search.ms });

    const first = await rpc('tools/call', { name: 'conquistador_check', arguments: { text: firstDraft, channel: 'email' } });
    const firstResult = parsed(first);
    const firstRules = [...new Set(firstResult.findings?.map(finding => finding.rule))].sort();
    record('the first draft fails the check', firstResult.clean === false && firstRules.includes('ai-unlock') && firstRules.includes('claim-guarantee'), { blocking: firstResult.blocking, rules: firstRules, ms: first.ms });

    const second = await rpc('tools/call', { name: 'conquistador_check', arguments: { text: revision, channel: 'email' } });
    const secondResult = parsed(second);
    const secondRules = [...new Set(secondResult.findings?.map(finding => `${finding.rule} (${finding.severity})`))].sort();
    record('the revision passes the check', secondResult.clean === true, { blocking: secondResult.blocking, rules: secondRules, ms: second.ms });
  } finally {
    server?.close();
  }
  const report = { schema: 'conquistador.e2e.agent-loop/v1', url: option('--url') ? url : 'loopback (hosted handler, token required)', date: new Date().toISOString(), passed: steps.every(step => step.passed), steps };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(out, 'report.md'), [`# Agent loop E2E`, '', `Target: ${report.url}`, `Date: ${report.date}`, `Result: ${report.passed ? 'pass' : 'FAIL'}`, '', '| Step | Result |', '|---|---|', ...steps.map(step => `| ${step.name} | ${step.passed ? 'pass' : 'FAIL'} |`), ''].join('\n'));
  for (const step of steps) process.stdout.write(`${step.passed ? 'pass' : 'FAIL'}  ${step.name}\n`);
  process.stdout.write(`Report: ${join(out, 'report.md')}\n`);
  if (!report.passed) process.exitCode = 1;
}

await main();
