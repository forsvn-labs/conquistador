# Verify gate: make the host enforce the check

A deployed agent can report "all checks clean" when they are not. In a 2026-10-07 test, a
Haiku-class agent delivered three emails that failed `conquistador_check` with seven errors and
reported them clean. The brief asks the agent to check its drafts; this example makes the host
require it.

The host gives the agent one way to hand drafts over: a `deliver` tool. The host verifies each
draft with `conquistador_verify` and accepts the delivery only when every draft is the exact text of
a clean check, signed by the server, that used the host's channel and context. Otherwise it rejects
the whole delivery and sends the agent the blocking findings to fix. Nothing reaches a person until
the gate accepts it.

## Files

| File | What it does | Use it when |
| --- | --- | --- |
| `gate.mjs` | The gate. `createHandoverGate({ callTool, channel, context }).review(drafts)` returns `accepted`, the verified texts, per-draft reasons, findings, and feedback for the agent. No dependencies. | Every host. Start here. |
| `mcp-client.mjs` | Connects to the Conquistador MCP server with the official MCP client and adapts it for the gate. Also a CLI that checks a delivery file. | Your host speaks MCP, or you want to check a delivery by hand. |
| `claude-agent-sdk.mjs` | A complete Claude Agent SDK host: Conquistador as an HTTP MCP server, an in-process `deliver` tool, and a `Stop` hook that keeps the agent working until a delivery is accepted. | Your agent runs on the Claude Agent SDK. |

The E2E test is `node tools/e2e/verify-gate.mjs` from the repository root. It needs no model and no
network.

## Install

Use Node 24. From this directory:

```sh
bun install    # or: npm install
```

These packages are not part of the npm package `@forsvn/conquistador`.

## The server must sign receipts

The gate accepts only signed receipts. A server signs them when it has `CONQUISTADOR_RECEIPT_KEY`
(the hosted server at `https://mcp.forsvn.com/mcp` does). Without the key, an agent could compute a
receipt itself, so the gate reports a host error and hands nothing over.

## Check a delivery file

```sh
export CONQUISTADOR_MCP_TOKEN=...   # the server's access token
node mcp-client.mjs --channel email --context context.md delivery.json
```

`delivery.json` is an array of `{ "title", "text", "receipt" }`, with each receipt as
`conquistador_check` returned it. Exit codes: 0 accepted, 2 rejected (the output lists what to fix),
1 the host could not verify.

## Run an agent behind the gate

```sh
export CONQUISTADOR_MCP_TOKEN=...
node claude-agent-sdk.mjs --task task.md --context context.md --channel email \
  --model claude-haiku-4-5 --out run/
```

The agent gets only the Conquistador tools and `deliver`; built-in tools, local settings, and other
MCP servers are off. The run writes:

- `run/delivered.md`: the drafts the gate accepted, copied from the verified text. If the gate
  accepted nothing, it says so.
- `run/run.json`: the outcome, every review with its reasons and rules, turns, and cost.
- `run/transcript.jsonl`: every SDK message.

Outcomes:

| Outcome | Meaning |
| --- | --- |
| `delivered` | The gate accepted every draft. |
| `rejected` | The agent used up its delivery attempts (6 by default). Nothing was handed over. |
| `not-delivered` | The agent stopped without an accepted delivery after the Stop hook blocked it 3 times. |
| `host-error` | The host could not verify: the server was unreachable, refused the token, or did not sign. |

## Other hosts

In any host, keep the same three rules:

1. The agent hands drafts over through a tool the host owns, never through its final message.
2. The host calls `review()` and passes on only `review.delivered`, the texts it verified.
3. The host fails closed: a host error hands nothing over.

## Limits

- The gate proves that the delivered text passed the rule-based check. It does not prove that the
  copy is true, persuasive, or legal. A person still reviews it.
- The gate checks the channel and context it is given. If the host passes the wrong context, the
  gate verifies against the wrong facts.
- The Stop hook and the attempt limit bound a run; they do not make a weak model write well.
