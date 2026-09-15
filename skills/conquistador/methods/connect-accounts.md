# Connect the user's toolstack

Conquistador's job is elite growth, GTM, sales, marketing, and product knowledge work. Connecting
accounts is how that work reaches the user's real systems. It is not a setup ritual.

## When to use this method

Load this when the current task needs a CRM, warehouse, ads, docs, analytics, or other live system
the host cannot yet reach, or when the user asks to install Executor or wire their stack.

Start the requested outcome. Pause for connections only when a missing system blocks a concrete
next step. Do not open with a tool questionnaire.

## Help a new user get going

A user who already knows Executor still needs you to inspect and continue. A user who does not
must not be left with a link dump.

1. Inspect. Look for an `executor` binary, an Executor MCP server already in the host, or
   `conquistador connections status` in a complete distribution.
2. If Executor is missing, explain in one short paragraph: it holds provider credentials outside
   the agent sandbox and exposes the user's tools over MCP. Then install it through the host using
   the official documented commands (Node 20+):

   ```sh
   npm install -g executor
   executor install
   executor web
   ```

   Also valid: `pnpm add -g executor`, `bun add -g executor`, `yarn global add executor`.
   Official CLI docs: https://executor.sh/docs/local/cli
   Hosted path with no local service: Executor Cloud at https://executor.sh/docs/hosted/cloud

   State what each command does before running it. `npm install -g executor` installs the CLI.
   `executor install` registers a durable local background service. `executor web` opens the local
   UI at `http://127.0.0.1:4788/`. Do not run these as a silent side effect of loading Conquistador.
   Run them when this task needs accounts and the user wants to get going, using host permissions
   already granted for local installs. If the host requires extra approval for a global install or a
   background service, ask once with the exact commands.

3. Connect this coding agent to Executor MCP:

   ```sh
   npx add-mcp http://127.0.0.1:4788/mcp --transport http --name executor
   ```

   If the host only loads MCP at session start, say so and continue after the user opens a new chat.
   Do not paste tokens into chat.

4. Add only the sources this task needs. In Executor UI, use Add Source with an OpenAPI, GraphQL,
   or MCP URL. Restrict policies to the account, operations, and data class required. The user
   signs in there. Never request a secret in chat.

5. Verify the narrow job, not the brand name. Discovery is not proof that a CRM write or warehouse
   query succeeded. Then resume the original growth, GTM, sales, marketing, or product task.

Prefer an already-working host CLI or MCP over installing Executor. Prefer Executor over copying
keys into scripts. Prefer Cloud when the user does not want a local Node service.

## Complete-distribution commands

These inspect and prepare; they do not themselves run `npm install` or `executor install`. You run
the official install commands through the host when helping the user.

- `conquistador connections setup` — inspect plus official next steps (JSON)
- `conquistador connections status` — install detection only
- `conquistador connections prepare|login|probe` — operator-owned gateway config after Executor exists

Follow [stack setup](stack-setup.md) for the exact job-to-route map after Executor is reachable.
Keep human gates for credentials, spend, publish, and live writes.
