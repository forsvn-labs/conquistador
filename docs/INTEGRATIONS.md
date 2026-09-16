# Connect accounts when the task needs them

Start with the outcome: a launch package, campaign diagnosis, sales plan, or product decision.
Conquistador uses supplied files and permitted connections already available in your host.
Add Executor only when missing live account access blocks the task. Resume the original work
as soon as the required connection works.

You do not need Executor, Eve, or the Conquistador runtime to draft from supplied material.
Ordinary skill installation starts no service or background job.

## Connect the account that blocks your task

1. Name the missing input or action, the account, and the smallest operation needed. Reuse a
   permitted connection if it already covers that work. Keep an Executor-only host policy in force.
2. If a new live connection is needed, choose local Executor or
   [Executor Cloud](https://executor.sh/docs/hosted/cloud). For local setup, use the official
   [CLI instructions](https://executor.sh/docs/local/cli):

   ```sh
   npm install -g executor
   executor install
   executor web
   npx add-mcp http://127.0.0.1:4788/mcp --transport http --name executor
   ```

   Executor's CLI requires Node 20 or later; Conquistador's supported toolchain is Node 24.
   `executor install` sets up a persistent local service. The parent can run these commands
   through your host within its permissions. Refresh the host after adding MCP if it does not
   discover the connection. For Cloud, use the endpoint and connection instructions supplied
   by Executor.
3. Sign in and add the required source in the Executor UI. Limit access to the account,
   operations, data, and cost needed for this task. Keep credentials in the connection owner's
   credential tools, never in chat, command arguments, assignments, or tracked files.
4. Verify one bounded, authorized job through that connection, preferably a read of the exact
   input you need. Check the account, result, and terminal status. Login and tool listing alone
   do not verify provider operation. If the result is uncertain, inspect its state before retrying.
5. Resume the requested deliverable. Report what was observed and any remaining evidence gaps.

Connecting an account does not authorize publishing, sends, spend, or live writes. Those actions
retain their applicable human decision. Existing credentials are not extracted or copied into
Executor automatically.

## Know what each check proves

Run these commands from a complete checkout or distribution. Skill installation does not put
`conquistador` on your PATH.

| Check | What it establishes | What remains unverified |
| --- | --- | --- |
| `node runtime/bin/conquistador.js setup doctor --path /absolute/install` | Local installation completeness against the bundled manifest, plus applicable receipt and saved-path checks | Host activation, model context loading, task quality, and account access |
| `node runtime/bin/conquistador.js connections setup` | Whether an `executor` binary is on PATH, with setup instructions | A running service, MCP registration, login, or provider access |
| `node runtime/bin/conquistador.js connections probe --config /absolute/connection.json` | Bounded MCP negotiation and tool discovery at the configured endpoint | Any provider operation; `providerVerified` remains false |
| A bounded authorized provider operation | The observed result for that account, operation, and request | General provider support, other accounts, or human acceptance |

`connections status` also inspects binary availability. `connections prepare` prints a non-secret
configuration draft. `connections login` returns the operator UI handoff; it does not complete
sign-in. None of these helpers silently installs Executor or registers an MCP server.

The [installation guide](../INSTALL.md#read-only-completeness-check) covers the setup doctor.
The [Executor client reference](../hosts/executor/README.md) covers configuration, scoped gateway
access, probe limits, and the narrow GitHub metadata callback. The client does not support every
Cloud URL or interactive MCP OAuth session. Use a compatible host for those connections; do not
rewrite a supplied Cloud URL to fit the client's validator.

## Who owns access

| Component | Responsibility |
| --- | --- |
| Conquistador | Select methods, define bounded work, integrate the deliverable, and report evidence |
| Your coding-agent host | Supply the model, tools, permissions, worker contexts, and gateway access |
| Executor | Hold provider credentials, manage account connections, and enforce configured execution policies |
| Optional Eve job host | Own one explicitly prepared job session, its state, and waits for human input |

Gateway authentication and provider authentication are separate. Specialists receive connection
and operation references; provider secrets stay with Executor. A connection does not expand the
runtime's supported operations. The [catalog reference](../catalog/README.md) explains exact
operation limits and why a successful task observation is not maintained provider support.

## Advanced: jobs that outlast the session

Use Eve only when you explicitly request a durable job. Start with
`node runtime/bin/conquistador.js jobs --help` and the [Eve job guide](../hosts/eve/README.md).
Preparation copies methods into a separate private app. Installing dependencies, configuring a
model and billing limits, starting the service, and submitting a job are separate steps.

Each job has one owner, one state directory, and one coordinating parent. Do not run the same
assignment in both the interactive host and Eve. Keep the returned session ID and inspect state
after an uncertain submit or resume before retrying. A cloud job needs a reachable Executor
endpoint; it cannot assume access to a laptop's loopback service.

The [native Eve reference](../hosts/eve/runtime/README.md) covers caller and operator authority,
origin binding, credential rotation, approval, and persisted-state requirements. Prepared files,
local tests, and accepted submissions do not establish a completed model task or provider operation.
The portable Eve/Grok packages are separate; native import and delegation remain unverified.

The [Conquistador runtime](../runtime/README.md) is another explicit advanced option. It executes
four declared playbooks and requires its own model and service configuration. It does not execute
all 38 methods as arbitrary jobs. Ordinary skill use requires neither runtime.

## Advanced: dependency maintenance

From the complete distribution:

```sh
node runtime/bin/conquistador.js integrations status
node runtime/bin/conquistador.js integrations check-updates
```

`status` reads local pins and lockfile digests. `check-updates` sends public dependency names to
npm and reports release differences. It installs nothing and grants no new access. Exit codes
are 0 for matching releases, 1 for review required, and 2 for an unavailable check or invalid input.
A version difference, including an older `latest` tag, needs review. It is not a compatibility or
security verdict. Development dependency updates do not change the Node 24 requirement.

Optional host checks and the private daily release watch are described in the
[maintenance reference](../CONTRIBUTING.md) and [release-watch workflow](../.github/workflows/integration-updates.yml).
The schedule requires the workflow on the default branch and Actions permission. Before an upgrade,
retain a state backup and verify the deployment's authorized account, approval, cancellation, and
recovery paths. An older binary alone might not reverse a data migration. Keep upstream license
notices and hosted-service terms. See [implementation status](../PROGRESS.md) for recorded evidence.
