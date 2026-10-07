#!/usr/bin/env node
// E2E for the host-side handover gate in examples/verify-gate. Offline, no model, no key.
// Serves the hosted MCP handler on loopback (one server signs receipts, one does not), connects
// with the official MCP client, and submits fixed deliveries that cover each failure mode: no
// receipt, edited text, wrong context or channel, a failed check, a forged receipt, a reused
// receipt, a malformed receipt, an unsigned server, and an unreachable or refusing server. It then
// drives the Claude Agent SDK session's deliver tool and Stop hook without a model.
// Needs `bun install` in examples/verify-gate. Report: dist/e2e/verify-gate/report.json and report.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMcpRequestHandler } from '../mcp-http.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const out = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : join(root, 'dist/e2e/verify-gate'));

let gateModule, clientModule, sessionModule;
try {
  gateModule = await import('../../examples/verify-gate/gate.mjs');
  clientModule = await import('../../examples/verify-gate/mcp-client.mjs');
  sessionModule = await import('../../examples/verify-gate/claude-agent-sdk.mjs');
} catch (failure) {
  console.error(`Could not load examples/verify-gate (${failure.message}). Run \`bun install\` in examples/verify-gate first.`);
  process.exit(1);
}
const { createHandoverGate } = gateModule;
const { connectConquistador } = clientModule;
const { createGatedSession } = sessionModule;

const context = [
  'Product: Ledgerline (synthetic test product) reconciles Stripe and HubSpot revenue every night and flags mismatches.',
  'Buyer: RevOps lead at a 50-500 person B2B SaaS company.',
  'Proof: none supplied. Do not invent customers or numbers.',
  'Sender: Sam Lee at Ledgerline, 100 Example Street, Springfield.',
].join('\n');
const failing = `---
subject: Unlock seamless revenue ops!!
---
Hi {first_name},

In today's fast-paced world, RevOps teams are drowning. Ledgerline is a game-changer that will 10x your accuracy, guaranteed.

Click here to learn more.
`;
const clean = `---
subject: Stripe and HubSpot totals for last month
---
Hi Dana,

When Stripe and HubSpot disagree on last month's revenue, someone on RevOps usually rebuilds the numbers by hand.

Ledgerline compares the two every night and lists each mismatch with the records behind it.

Would a 15-minute look at one month of your data be useful?

Ledgerline, 100 Example Street, Springfield. To opt out, reply "stop" and I will not email you again.
`;
const cleanTwo = clean.replace('Hi Dana,', 'Hi Priya,').replace('last month', 'the last quarter');

const steps = [];
const record = (name, passed, detail = {}) => { steps.push({ name, passed, ...detail }); };
const servers = [];
async function serve(options) {
  const server = createServer(createMcpRequestHandler(options));
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}/mcp`;
}
const summary = review => ({ accepted: review.accepted, hostError: review.hostError ?? null, drafts: review.results.map(({ title, accepted, reason, findings }) => ({ title, accepted, reason, rules: findings?.map(finding => finding.rule) ?? [] })) });

async function main() {
  process.env.CONQUISTADOR_HOME = join(out, 'empty-home');
  delete process.env.CONQUISTADOR_PLAYBOOKS;
  const token = randomBytes(24).toString('hex');
  const signedUrl = await serve({ token, requireToken: true, receiptKey: randomBytes(24).toString('hex') });
  const unsignedUrl = await serve({ token, requireToken: true });

  // The agent's side: checks it runs itself. The host's side: a separate connection with the gate.
  const agent = await connectConquistador({ url: signedUrl, token, name: 'verify-gate-e2e-agent' });
  const host = await connectConquistador({ url: signedUrl, token, name: 'verify-gate-e2e-host' });
  const gate = createHandoverGate({ callTool: host.callTool, channel: 'email', context });
  const check = (text, extra = {}) => agent.callTool('conquistador_check', { text, channel: 'email', context, ...extra });
  try {
    const cleanCheck = await check(clean);
    const cleanTwoCheck = await check(cleanTwo);
    record('fixture: the clean drafts pass the check', cleanCheck.clean && cleanTwoCheck.clean, { blocking: [cleanCheck.blocking, cleanTwoCheck.blocking] });

    let review = await gate.review([{ title: 'Email 1', text: clean, receipt: cleanCheck.receipt }, { title: 'Email 2', text: cleanTwo, receipt: cleanTwoCheck.receipt }]);
    record('1. clean, signed, unchanged drafts are accepted', review.accepted && review.delivered.length === 2 && review.delivered[0].text === clean && review.delivered[1].text === cleanTwo, summary(review));

    review = await gate.review([{ title: 'Email 1', text: failing }]);
    record('2. a draft without a receipt is rejected with its findings', !review.accepted && !review.hostError && review.results[0].findings?.length > 0 && /receipt/i.test(review.results[0].reason), summary(review));

    const edited = clean.replace('Ledgerline compares', 'Ledgerline seamlessly compares');
    review = await gate.review([{ title: 'Email 1', text: edited, receipt: cleanCheck.receipt }]);
    record('3. text edited after a clean check is rejected with the new findings', !review.accepted && /changed/i.test(review.results[0].reason) && review.results[0].findings?.some(finding => finding.rule === 'ai-seamless'), summary(review));

    const noContext = await agent.callTool('conquistador_check', { text: clean, channel: 'email' });
    review = await gate.review([{ title: 'Email 1', text: clean, receipt: noContext.receipt }]);
    record('4. a check without the host context is rejected', !review.accepted && /context/i.test(review.results[0].reason), summary(review));

    const general = await agent.callTool('conquistador_check', { text: clean, channel: 'general', context });
    review = await gate.review([{ title: 'Email 1', text: clean, receipt: general.receipt }]);
    record('5. a check on another channel is rejected', !review.accepted && /channel/i.test(review.results[0].reason), summary(review));

    const failingCheck = await check(failing);
    review = await gate.review([{ title: 'Email 1', text: failing, receipt: failingCheck.receipt }]);
    record('6. an honest receipt from a failed check is rejected with its findings', !failingCheck.clean && !review.accepted && review.results[0].findings?.length > 0, summary(review));

    review = await gate.review([{ title: 'Email 1', text: failing, receipt: { ...failingCheck.receipt, clean: true, blocking: 0 } }]);
    record('7. a flipped receipt is rejected by its signature', !review.accepted && /signature/i.test(review.results[0].reason), summary(review));

    review = await gate.review([{ title: 'Email 1', text: clean, receipt: cleanCheck.receipt }, { title: 'Email 2', text: cleanTwo, receipt: cleanCheck.receipt }]);
    record('8. one receipt reused for two drafts rejects the delivery and names the draft', !review.accepted && review.results[0].accepted && !review.results[1].accepted && review.feedback.includes('Email 2') && review.delivered.length === 0, summary(review));

    review = await gate.review([{ title: 'Email 1', text: clean, receipt: { foo: 1 } }]);
    record('9. a malformed receipt is the agent\'s error, not the host\'s', !review.accepted && !review.hostError && /receipt/i.test(review.results[0].reason), summary(review));

    review = await gate.review([]);
    const reviewMissing = await gate.review(undefined);
    record('10. an empty delivery is rejected', !review.accepted && !reviewMissing.accepted && !review.hostError, { empty: summary(review), missing: summary(reviewMissing) });

    const unsignedAgent = await connectConquistador({ url: unsignedUrl, token, name: 'verify-gate-e2e-unsigned' });
    const unsignedCheck = await unsignedAgent.callTool('conquistador_check', { text: clean, channel: 'email', context });
    const unsignedGate = createHandoverGate({ callTool: unsignedAgent.callTool, channel: 'email', context });
    review = await unsignedGate.review([{ title: 'Email 1', text: clean, receipt: unsignedCheck.receipt }]);
    record('11. an unsigned receipt is a host error and never accepted', unsignedCheck.receipt.signature === null && !review.accepted && Boolean(review.hostError), summary(review));
    await unsignedAgent.close();

    let refused = null;
    try { await connectConquistador({ url: signedUrl, token: 'wrong', name: 'verify-gate-e2e-refused' }); } catch (failure) { refused = failure.message; }
    const brokenGate = createHandoverGate({ callTool: async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:9'); }, channel: 'email', context });
    review = await brokenGate.review([{ title: 'Email 1', text: clean, receipt: cleanCheck.receipt }]);
    record('12. a refusing or unreachable server fails closed', Boolean(refused) && !review.accepted && Boolean(review.hostError) && review.delivered.length === 0, { refused, ...summary(review) });

    review = await gate.review([{ title: 'Email 1', text: clean.replace(/\n/g, '\r\n'), receipt: cleanCheck.receipt }]);
    record('13. CRLF line endings do not break the match', review.accepted, summary(review));

    // The Claude Agent SDK session, without a model: its deliver tool and its Stop hook.
    const session = createGatedSession({ gate, maxStopBlocks: 2, maxRejections: 2 });
    const firstStop = await session.onStop({ hook_event_name: 'Stop', stop_hook_active: false });
    const rejected = await session.deliver({ drafts: [{ title: 'Email 1', text: failing, receipt: failingCheck.receipt }] });
    const accepted = await session.deliver({ drafts: [{ title: 'Email 1', text: clean, receipt: cleanCheck.receipt }] });
    const finalStop = await session.onStop({ hook_event_name: 'Stop', stop_hook_active: true });
    record('14a. the Stop hook blocks before delivery and allows it after', firstStop.decision === 'block' && rejected.isError && !accepted.isError && finalStop.decision !== 'block' && session.state.outcome === 'delivered' && session.state.delivered[0].text === clean, { firstStop, rejected: rejected.content[0].text.slice(0, 400), accepted: accepted.content[0].text, outcome: session.state.outcome });

    const silent = createGatedSession({ gate, maxStopBlocks: 2 });
    const stops = [];
    for (let attempt = 0; attempt < 3; attempt++) stops.push(await silent.onStop({ hook_event_name: 'Stop', stop_hook_active: attempt > 0 }));
    record('14b. an agent that never delivers ends as not-delivered after the block budget', stops[0].decision === 'block' && stops[1].decision === 'block' && stops[2].decision !== 'block' && silent.state.outcome === 'not-delivered' && silent.state.delivered.length === 0, { decisions: stops.map(stop => stop.decision ?? 'allow'), outcome: silent.state.outcome });

    const stubborn = createGatedSession({ gate, maxRejections: 2 });
    const attempts = [];
    for (let attempt = 0; attempt < 3; attempt++) attempts.push(await stubborn.deliver({ drafts: [{ title: 'Email 1', text: failing, receipt: failingCheck.receipt }] }));
    const lateClean = await stubborn.deliver({ drafts: [{ title: 'Email 1', text: clean, receipt: cleanCheck.receipt }] });
    const stubbornStop = await stubborn.onStop({ hook_event_name: 'Stop', stop_hook_active: false });
    record('15. after the rejection budget the session ends as rejected and hands nothing over', stubborn.state.outcome === 'rejected' && stubborn.state.delivered.length === 0 && lateClean.isError && stubbornStop.decision !== 'block' && stubborn.state.rejections === 2, { outcome: stubborn.state.outcome, rejections: stubborn.state.rejections, last: attempts.at(-1).content[0].text.slice(0, 200) });

    const hostDown = createGatedSession({ gate: brokenGate });
    const down = await hostDown.deliver({ drafts: [{ title: 'Email 1', text: clean, receipt: cleanCheck.receipt }] });
    const downStop = await hostDown.onStop({ hook_event_name: 'Stop', stop_hook_active: false });
    record('16. a host error ends the session as host-error without handing anything over', hostDown.state.outcome === 'host-error' && down.isError && downStop.decision !== 'block' && hostDown.state.delivered.length === 0, { outcome: hostDown.state.outcome });
  } finally {
    await agent.close();
    await host.close();
    for (const server of servers) server.close();
  }
}

try { await main(); } catch (failure) { record('run completed without an exception', false, { error: failure.stack }); }
const passed = steps.filter(step => step.passed).length;
const report = { name: 'verify-gate', ranAt: new Date().toISOString(), passed, total: steps.length, steps };
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(out, 'report.md'), [`# Verify gate E2E`, '', `${passed}/${steps.length} passed (${report.ranAt}).`, '', '| Step | Result |', '| --- | --- |', ...steps.map(step => `| ${step.name} | ${step.passed ? 'pass' : 'FAIL'} |`), ''].join('\n'));
for (const step of steps) console.log(`${step.passed ? 'pass' : 'FAIL'}  ${step.name}`);
console.log(`\n${passed}/${steps.length} passed. Report: ${join(out, 'report.md')}`);
process.exit(passed === steps.length ? 0 : 1);
