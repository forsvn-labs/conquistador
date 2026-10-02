# Connect accounts when the task needs them

Start the requested outcome. Connect an account only when live data or a live action would make
the result better, or when the user asks to connect their stack. Do not open with a tool
questionnaire.

Conquistador names capabilities (`crm.read`, `ads.read`, `email.send`). The user connects the
services they already use in Executor. Executor holds the credentials outside the agent and
exposes the tools.

## Connect

1. Check what is ready: `conquistador connect --json <command or capability>`.
2. Executor is not installed: ask the user to run `conquistador connect` in a terminal. It asks
   before it runs `npm install -g executor` and `executor install`. Hosted option with nothing
   to install: [Executor Cloud](https://executor.sh/docs/hosted/cloud).
3. Executor is not running: tell the user to open Executor.app or run `executor web`. Do not run
   an `executor` command to wake it.
4. A capability is missing: run `conquistador connect add`. The user chooses Add Integration in
   the Executor web UI and signs in to the provider there. Suggest providers from
   `integrations/<capability>.md`. Limit the integration's policy to the operations the task needs.
5. Verify one bounded read: `conquistador connect verify <capability> --tool <path> --args '<json>'`.
6. Resume the requested deliverable. Use live data through the protocol in
   [setup](../standards/setup.md#use-live-data-through-executor).

To let this agent call Executor over MCP, run
`npx add-mcp http://127.0.0.1:4788/mcp --transport http --name executor`. The Connect card in the
Executor web UI shows the exact command. Most hosts load MCP servers only at session start.

## Keep these rules

- Never ask for keys, tokens, or passwords in chat. Never copy them into commands or files.
- A connection does not authorize a write. Before each send, publish, spend, or data change, show
  the exact payload and get the user's explicit approval.
- Discovery is not proof. A capability is verified only after one read returns a result.
