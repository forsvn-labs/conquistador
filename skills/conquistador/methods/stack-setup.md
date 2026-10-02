# Set up the working stack

Use this method when the outcome needs data, a provider, or a local tool that the host cannot
reach yet. Set up only what this task needs, then continue the task.

## Inventory first

Check the repository, host tools, configured MCP servers, and `conquistador connect --json`
before you ask the user. For each system the task needs, note:

| Field | Note |
| --- | --- |
| Capability | The capability id from [`capabilities.json`](../capabilities.json), for example `crm.read` |
| Job | The exact read or write this task needs |
| Route | Existing host tool, Executor integration, or the provider's official CLI |
| Scope | Account, workspace, and environment, without secret values |
| Write boundary | Draft, paused object, or live change, and the approval it needs |

If a material item stays unknown, ask one bundled question: which service the user uses, which
account, and which action is allowed.

## Choose the route

1. Reuse a working host tool or MCP server.
2. Use the user's Executor integration for the capability. Follow
   [connect accounts](connect-accounts.md) when it is missing.
3. Use the provider's official CLI when host policy allows it and Executor has no integration.
4. If no route works, finish with supplied context and name the missing capability.

For recurring reports, read from the warehouse (`warehouse.read`) when the data lands there.
Call the live provider for writes and for data that only the provider has.

## Check before use

- Executor: `conquistador connect verify` with one bounded read for the capability.
- CLI: the executable, its version, and the target account.
- Data: a small sample that keeps units, dates, and the source.
- Write: a draft, a sandbox, or a dry run, with the final payload shown before approval.

Never ask for secrets in chat or write them to commands, logs, or files. Account creation, paid
plans, and admin changes stay with the user.

## Continue the work

Give each specialist the verified route and its limits in the assignment. If setup fails, name
the failed check, use the best supplied evidence, and finish the deliverable.

Durable jobs outside this session (Eve) and the typed catalog are maintainer paths. See
`docs/INTEGRATIONS.md` in the Conquistador repository.
