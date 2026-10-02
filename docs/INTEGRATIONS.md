# Integrations

Conquistador works with the services you already use. It does not ship provider code. It names
**capabilities**, such as `crm.read` or `email.send`. You connect your services in
[Executor](https://executor.sh). At task time, the agent finds the matching tool in Executor and
calls it.

You do not need Executor to draft from supplied material. Connect a service when live data or a
live action makes the result better.

## How it works

| Part | Owns |
| --- | --- |
| [`capabilities.json`](../skills/conquistador/capabilities.json) | Capability ids, their class (`read` or `write`), Executor search phrases, and the capabilities each command can use |
| [`integrations/<capability>.md`](../skills/conquistador/integrations/README.md) | Recipes: the questions a capability answers, search phrases, and hints for common providers |
| Executor | Your integrations, credentials, and per-tool policies |
| Your coding agent | Finds the tool with `executor tools search`, reads its schema with `executor tools describe`, and calls it with `executor call` |

Both files ship inside the `conquistador` skill (`skills/conquistador/`), so a skill-only install
has them. Any provider that Executor reaches works: an MCP server, an OpenAPI spec, or a GraphQL API. To
add a provider hint, edit a recipe. To add a capability, edit `capabilities.json` and add a
recipe. Neither change needs code.

## Capabilities

| Group | Capabilities |
| --- | --- |
| Analytics | `analytics.read`, `product-analytics.read`, `warehouse.read` |
| Sales | `crm.read`, `crm.write` |
| Email | `email.read`, `email.send` |
| Ads | `ads.read`, `ads.write` |
| Search | `search.read`, `seo.read` |
| Social | `social.read`, `social.publish` |
| Revenue | `payments.read` |
| Docs and team | `docs.read`, `docs.write`, `chat.read`, `chat.send`, `calendar.read` |
| Product | `support.read`, `issues.read`, `issues.write` |

Read-class tools run within your host's policy. Write-class tools send, publish, spend, or change
data. The agent shows the exact payload and asks for your approval before each write.

## Connect your services

1. Check what is ready:

   ```sh
   conquistador connect
   ```

   Each capability shows one state: `verified`, `connected`, `missing`, or `unknown` (Executor
   is not running). Name a command to check only what it uses, for example
   `conquistador connect launch`. Add `--json` for agents.

2. If Executor is not installed, `conquistador connect` asks to install it. It runs
   `npm install -g executor` (Node 20 or later) and `executor install`, which starts a
   background service. To install by hand, run those two commands. To install nothing, use
   [Executor Cloud](https://executor.sh/docs/hosted/cloud).

3. If Executor is not running, open Executor.app or run `executor web`. Conquistador never
   starts Executor without your confirmation.

4. Add a service:

   ```sh
   conquistador connect add
   ```

   This opens the Executor web UI. Choose Add Integration and sign in to the provider there.
   Never paste keys into chat.

5. Verify one read:

   ```sh
   conquistador connect verify crm.read --tool <path> --args '<json>'
   ```

   Get the tool path from `conquistador connect` or `executor tools search`, and the arguments
   from `executor tools describe`. `verify` runs read-class tools only. It records the tool, the
   time, and the result size in `~/.conquistador/connections.json`. It records no credentials and
   no result data.

6. Optional: let your coding agent call Executor over MCP:

   ```sh
   npx add-mcp http://127.0.0.1:4788/mcp --transport http --name executor
   ```

   The Connect card in the Executor web UI shows the exact command for your port.

## How Conquistador talks to Executor

- Before any `executor` command, Conquistador checks that a server already answers
  `GET /api/health`. It reads the daemon records in `~/.executor/daemon-*.json` (host and port
  only) and checks the default ports 4788 and 4789. Set `CONQUISTADOR_EXECUTOR_URL` to check one
  server only.
- If no server answers, Conquistador reports Executor as not running. It does not run an
  `executor` command, because Executor's read commands start a folder-scoped server that does
  not show your integrations.
- Every `executor` command that Conquistador runs gets `--base-url` for the server that answered,
  after the positional arguments: `executor tools search "send email" --base-url <origin>`.
- If the only server that answers was started for one folder, `connect` warns you.

## Maintainer paths

These paths stay in the repository. They are not part of the default user path.

- **Typed catalog** (`catalog/`): typed provider operations with fixtures and audited limits. See
  the [catalog reference](../catalog/README.md).
- **Executor client** (`conquistador connections setup|status|prepare|login|probe`): gateway
  configuration and bounded MCP probes. See the [Executor client reference](../hosts/executor/README.md).
- **Eve jobs** (`conquistador jobs`): durable jobs that outlast the session. See the
  [Eve job guide](../hosts/eve/README.md).
- **Runtime** (`runtime/`): runs four declared playbooks with its own model configuration. See
  the [runtime reference](../runtime/README.md).
- **Dependency pins** (`conquistador integrations status|check-updates`): reports the pinned Eve
  and Executor versions and checks npm for newer releases. It installs nothing. Exit codes: 0 for
  matching releases, 1 for review required, 2 for an unavailable check.
