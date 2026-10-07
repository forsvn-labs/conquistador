// A Claude Agent SDK host that enforces Conquistador's check loop. The agent reads the brief and
// checks its drafts through the Conquistador MCP server, but it can hand drafts over only through
// the host's `deliver` tool. The host verifies every draft with conquistador_verify and rejects the
// delivery with the findings until each draft is the exact text of a clean, signed check. A Stop
// hook keeps the agent working until a delivery is accepted, up to a budget. The host then writes
// the verified texts, never the agent's own report of them.
//
//   CONQUISTADOR_MCP_TOKEN=... node claude-agent-sdk.mjs --task task.md --context context.md \
//     --channel email --model claude-haiku-4-5 --out run/
//
// Outputs in --out: delivered.md (only the verified drafts), run.json (outcome, each review, cost),
// and transcript.jsonl (the SDK messages).
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { createHandoverGate } from './gate.mjs';
import { connectConquistador } from './mcp-client.mjs';

const text = value => ({ content: [{ type: 'text', text: value }] });
const refusal = value => ({ ...text(value), isError: true });

// The host's side of the session: the deliver tool and the Stop hook, with no model attached.
export function createGatedSession({ gate, maxStopBlocks = 3, maxRejections = 6 }) {
  const state = { outcome: 'working', delivered: [], rejections: 0, stopBlocks: 0, reviews: [] };
  const ended = () => state.outcome !== 'working';

  async function deliver({ drafts }) {
    if (state.outcome === 'delivered') return text('The host already accepted a delivery. Stop now.');
    if (ended()) return refusal(`The session has ended (${state.outcome}). Stop now and report that the drafts were not handed over.`);
    const review = await gate.review(drafts);
    state.reviews.push({ at: new Date().toISOString(), accepted: review.accepted, hostError: review.hostError ?? null, results: review.results.map(({ title, accepted, reason, findings }) => ({ title, accepted, reason, rules: findings?.map(finding => finding.rule) ?? [] })) });
    if (review.hostError) {
      state.outcome = 'host-error';
      return refusal(`${review.feedback}\nStop now and report that the host could not verify the drafts.`);
    }
    if (review.accepted) {
      state.outcome = 'delivered';
      state.delivered = review.delivered;
      return text(`${review.feedback} Stop now.`);
    }
    state.rejections += 1;
    if (state.rejections >= maxRejections) {
      state.outcome = 'rejected';
      return refusal(`${review.feedback}\n\nThat was the last attempt this session allows. Stop now and report which findings you could not fix.`);
    }
    return refusal(review.feedback);
  }

  async function onStop() {
    if (ended()) return {};
    if (state.stopBlocks >= maxStopBlocks) {
      state.outcome = 'not-delivered';
      return {};
    }
    state.stopBlocks += 1;
    return { decision: 'block', reason: 'You have not delivered the drafts. Call the deliver tool with every final draft: its title, its exact text, and the receipt from its last conquistador_check. The host hands over only drafts it can verify.' };
  }

  return { state, deliver, onStop };
}

const receiptShape = z.object({ sha256: z.string(), clean: z.boolean(), blocking: z.number(), channel: z.string(), format: z.string(), contextSha256: z.string().nullable(), signature: z.string().nullable() }).passthrough();
const deliverShape = {
  drafts: z.array(z.object({
    title: z.string().describe('A short name, such as "Email 1".'),
    text: z.string().describe('The exact final text, as checked.'),
    receipt: receiptShape.optional().describe('The receipt object from the last conquistador_check of this exact text.'),
  })).describe('Every final draft, in order.'),
};

export async function runGatedAgent({ url, token, task, context, channel, model, out, maxTurns = 60 }) {
  mkdirSync(out, { recursive: true });
  const transcript = join(out, 'transcript.jsonl');
  writeFileSync(transcript, '');
  const host = await connectConquistador({ url, token, name: 'conquistador-verify-gate-host' });
  const session = createGatedSession({ gate: createHandoverGate({ callTool: host.callTool, channel, context }) });
  const handover = createSdkMcpServer({ name: 'handover', version: '0.1.0', tools: [
    tool('deliver', 'Hand your final drafts to the host. The host verifies each one with Conquistador and hands them over only when every draft is the exact text of a clean check. If it rejects the delivery, fix what it lists, check again, and deliver again.', deliverShape, deliver => session.deliver(deliver)),
  ] });
  const prompt = [
    task.trim(),
    '',
    'Facts from the sender (pass them as `context` to conquistador_brief and conquistador_check, word for word):',
    '<context>', context.trim(), '</context>',
    '',
    `Use the Conquistador tools: conquistador_brief first (size "compact"), conquistador_read for the files it lists, then conquistador_check on each draft with channel "${channel}" and the context above. Revise until each check is clean.`,
    'Hand the drafts over only with the deliver tool, each with the receipt from its last check. The host verifies them and rejects text that changed after its check or that did not pass.',
  ].join('\n');

  let result = null;
  const started = Date.now();
  try {
    for await (const message of query({ prompt, options: {
      model,
      maxTurns,
      tools: [],
      settingSources: [],
      strictMcpConfig: true,
      mcpServers: { conquistador: { type: 'http', url, headers: { authorization: `Bearer ${token}` } }, handover },
      allowedTools: ['mcp__conquistador', 'mcp__handover'],
      permissionMode: 'dontAsk',
      hooks: { Stop: [{ hooks: [async () => session.onStop()] }] },
    } })) {
      appendFileSync(transcript, `${JSON.stringify(message)}\n`);
      if (message.type === 'result') result = message;
    }
  } finally {
    await host.close();
  }
  if (session.state.outcome === 'working') session.state.outcome = 'not-delivered';
  const run = {
    model, url, channel, outcome: session.state.outcome, rejections: session.state.rejections, stopBlocks: session.state.stopBlocks,
    reviews: session.state.reviews, turns: result?.num_turns ?? null, costUsd: result?.total_cost_usd ?? null,
    durationMs: Date.now() - started, finalMessage: typeof result?.result === 'string' ? result.result : null,
  };
  writeFileSync(join(out, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(join(out, 'delivered.md'), session.state.delivered.length
    ? session.state.delivered.map(draft => `## ${draft.title}\n\n${draft.text.trim()}\n`).join('\n')
    : `Nothing was handed over. Outcome: ${run.outcome}.\n`);
  return run;
}

async function cli(args) {
  const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const token = process.env.CONQUISTADOR_MCP_TOKEN;
  if (!token || !option('--task') || !option('--context')) {
    console.error('Usage: CONQUISTADOR_MCP_TOKEN=... node claude-agent-sdk.mjs --task FILE --context FILE [--channel email] [--model ID] [--url URL] [--out DIR]');
    return 1;
  }
  const run = await runGatedAgent({
    url: option('--url') ?? 'https://mcp.forsvn.com/mcp', token,
    task: readFileSync(option('--task'), 'utf8'), context: readFileSync(option('--context'), 'utf8'),
    channel: option('--channel') ?? 'email', model: option('--model') ?? 'claude-sonnet-5-5',
    out: resolve(option('--out') ?? 'verify-gate-run'),
  });
  console.log(`Outcome: ${run.outcome}. Rejections: ${run.rejections}. Stop blocks: ${run.stopBlocks}. Cost: ${run.costUsd ?? 'unknown'} USD.`);
  return run.outcome === 'delivered' ? 0 : 2;
}

if (argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await cli(argv.slice(2));
