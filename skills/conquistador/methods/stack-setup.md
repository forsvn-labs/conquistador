# Set up the working stack

Use this method when the requested outcome needs data, a provider, or a local tool that the current
host cannot yet reach. Set up only what the current task needs, then continue the task.

## Inventory what already exists

Inspect the repository, host tools, configured connectors, and available commands before asking the
user. Build a short internal map with these fields:

| Field | Record |
| --- | --- |
| System | The existing source or destination, such as Databricks, Confluence, HubSpot, or GitHub |
| Job | The exact read, query, draft, or write needed for this task |
| Interface | Existing host connector, MCP server, official CLI, or operator-supplied Executor route |
| Identity | Account, workspace, environment, and permission scope, without secret values |
| Data boundary | Data that may enter the agent context and data that must stay in the system |
| Cost boundary | Free, metered, or unknown, with the task limit |
| Write boundary | Draft, sandbox, paused object, or live mutation, plus the required human decision |
| Proof | The check that shows the interface can do the declared job |

If a material item remains unknown, ask one bundled question about the systems the user already uses,
the target account or environment, and the allowed action. Do not ask the user to choose between
technical transports when one existing route clearly fits.

## Choose the access route

Prefer routes in this order:

1. Reuse a verified connector or MCP server already available in the host.
2. Use the provider's maintained CLI through the project's package manager or a pinned auxiliary
   package cache. Add a project dependency only when the product itself needs that dependency.
3. Use an existing, operator-supplied `Executor.sh` or Executor connection for an authorized API or
   GraphQL call. Keep the provider, operation, account, environment, and payload explicit.
4. If no safe route exists, finish the local work and return the exact missing connection or human
   action.

Read recurring analytics from an owned warehouse or durable export when available. Use a live
provider API for writes and provider-only reads. Do not poll live ad, CRM, or product APIs when the
same reporting data already lands in the warehouse.

## Prepare and verify

Use the host's credential flow. Never request a secret in chat or write it to commands, logs, project
files, or specialist assignments. Authentication, new accounts, paid plans, administrator changes,
and production permissions remain human-owned.

Verify the narrow route before use:

- CLI: resolve the executable, version, help output, and target environment;
- MCP: confirm server discovery and the exact tool or resource needed;
- Executor: confirm the named connection, operation, account, and read or write class;
- data: run a bounded metadata or sample query that preserves units, dates, and source identity;
- write: prefer a draft, sandbox, dry run, or paused object and show the final payload before approval.

Do not treat installation, a successful login, tool discovery, or a fixture as proof that a business
operation succeeded.

## Continue the work

Give specialists the verified interface and its limits in their assignment packets. Record the setup
result only when the user wants a durable stack note. Keep that note outside installed Conquistador
files and omit credentials.

If setup succeeds, complete the requested task. If it fails, name the failed check and use the best
available local evidence. Do not stop with a generic tool checklist.
