# Accounts, tools, and durable jobs

Conquistador uses the coding agent you already have. Reuse its authorized tools first. When a task
needs a new connection, the complete distribution offers an Executor connection helper. When work
must continue beyond an interactive session, it offers an explicit Eve job host. The portable skill
does not install either service.

## Responsibilities

| Component | Owns |
| --- | --- |
| Conquistador | The goal, relevant methods, business definitions, bounded assignments, evidence, and the final review |
| Coding-agent host | Interactive workers, local permissions, and the connection to Executor |
| Executor | Provider account connections, credential resolution, tool discovery, and execution policies |
| Eve | An explicitly prepared durable job, its session state, and its wait for human input |

Each job has one parent. An interactive assignment uses the coding host's workers. An Eve job uses
its own session. Do not dispatch the same assignment in both systems or retry an ambiguous job
submission automatically.

## Connect accounts

From the complete distribution, inspect the connection helper:

```sh
node runtime/bin/conquistador.js connections --help
```

Follow [Executor setup](../hosts/executor/README.md) to prepare a connection configuration, open the
operator's connection-manager UI, and probe the configured MCP endpoint. The helper does not create
an OAuth client, store provider secrets, start a daemon, or silently register an MCP server in your
coding agent.

Two authorization boundaries matter. The coding host authenticates to Executor. Executor then
uses the authorized provider connection for the requested account. A gateway login does not prove
that a CRM, warehouse, or publishing account is connected. A successful MCP probe proves discovery,
not that an operation on one of those accounts succeeded.

Complete provider sign-in and API-key entry through the connection manager's secure interface.
Configuration refers to host-held authentication by name. Never paste a token into chat, a command
argument, an assignment, or a tracked file. Specialists receive operation and connection references;
the gateway attaches provider credentials outside agent-authored code. Existing CLI or MCP credentials
remain with their owner and are not extracted or copied into Executor automatically.

Grant only the account, operations, data, and cost needed for the task. Publish, spend, sends, and live
writes require their separate human decision. Approving a connection or draft does not authorize a
later action. If an approval interface cannot complete that decision, retain the draft and hand off.
An Executor-only host policy continues to forbid alternate provider dispatch.

## Prepare durable work

```sh
node runtime/bin/conquistador.js jobs --help
```

The [Eve job host](../hosts/eve/README.md) prepares a separate, private app with the canonical skill
library and exact dependency pins. Installation, model credentials, starting the service, and job
submission are explicit steps. Skill installation never enables a schedule, webhook, or background
agent. Select a model and its billing limits before running a job.

Use an isolated owner and data directory. The Eve host has separate worker and operator authority.
Its upstream tools use Executor; it does not introduce another provider credential store. Keep the
Executor endpoint reachable from the job host. A cloud job cannot assume access to a laptop's
loopback gateway or private network.

The generated app and its state belong to the operator, outside the installed skill package.
Preparation is not deployment, a successful model turn, native acceptance, or provider support.
Inspect the recorded session after an uncertain submit or resume before attempting the operation
again. Upgrading dependencies must preserve or deliberately migrate persisted state.

## Keep integrations current

```sh
node runtime/bin/conquistador.js integrations status
node runtime/bin/conquistador.js integrations check-updates
```

`status` reads the optional host manifests and lockfile digests without contacting a service.
`check-updates` sends only their public dependency names to the npm registry. It reports the pinned
and latest versions and never installs a package, edits a lockfile, changes a connection, or grants
new tool access. Any different release, including an older `latest` tag, requires review. A failed
lookup remains unknown. Exit codes are 0 for matching releases, 1 for release review, and 2 for an
unavailable check or invalid input. Release metadata does not establish compatibility or security.

The private repository includes a daily read-only release-watch workflow and optional host checks.
Scheduled GitHub workflows run only after the workflow reaches the repository's default branch
and Actions permits it. Local changes do not activate this schedule. Reports stay in private Actions
artifacts. No workflow opens a PR, upgrades a deployment, or performs a provider call.

The optional checks install exact Bun lockfiles, load the real published packages, run local host
tests, and check dependency security advisories. Before adopting a new version, also verify the
authorized live account, approval, cancellation, and recovery paths used by the deployment. Local
tests and generated fixtures remain local evidence. Retain a known working version and a state
backup before migration; an older binary alone may not reverse a data migration.

Use official releases and small adapters. Avoid a permanent fork unless a verified problem requires
one. A dependency update must not silently add operations to an existing grant. Eve is Apache-2.0
and Executor is MIT; their license notices and any separate hosted-service terms remain applicable.

## Evidence and limits

The catalog continues to distinguish task observations from maintained provider support. Its
audited adapter and human-authority checks still apply. Connecting a gateway does not promote a
catalog operation or make arbitrary provider calls available through the runtime.

The standard build and tests are self-contained. Optional installed-package checks are separate
because the ordinary coding-agent skill does not need Eve or Executor dependencies. See each host
README for exact checks and external prerequisites. Current verification is recorded in
[implementation status](../PROGRESS.md).
