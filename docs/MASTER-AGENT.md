# Master agent and execution modes

Conquistador accepts one outcome and owns the finished result. It can assign parts of a multi-stage
request to specialist roles that combine existing outcome skills, relevant project knowledge, and a
named composition workflow. The parent integrates the work and returns one review packet.

A narrow request uses one role. A broader request uses the roles the work needs within explicit
host and plan limits. The current coordinator caps concurrency at four and total dispatches at twelve,
including integration and review. Each assignment has one goal, exact
context, tools, dependencies, limits, and a verifiable finish state. Specialists cannot delegate or
authorize consequential actions.

## Execution modes

| Mode | Behavior | Availability |
| --- | --- | --- |
| Direct | The parent performs a narrow assignment with the relevant outcome skill | Available in every complete install |
| Specialist team | The BB adapter creates visible child threads, orders dependencies, integrates results and reviews the exact artifact | Implemented for BB with an explicit existing project, environment and parent |
| Sequential team | A host callback runs the same packets in the parent context and labels review accordingly | Implemented by the coordinator with an explicit parent callback |
| Fixed advisor/worker | One production role hands one artifact to one review role | Separate `squad` package; not the dynamic specialist team |
| Runtime playbook | The optional runtime executes a declared graph | Limited to implemented runtime playbooks; it does not execute the general specialist team |

An independent review needs an isolated context. Sequential review must be identified as
same-context. Installation or file discovery does not prove that a host created another agent.

Read `hosts/coding-agent/README.md` in the complete distribution or plugin/harness copy for the
callable CLI and API. Compact method installs omit the executable adapter.
`conquistador.agent-package/v2` declares the master contract. The original v1 schema remains
unchanged, and `agents/conquistador/compatibility/v1.json` preserves the original single-agent
package for older consumers. The specialist assignment/result protocol is separately versioned.
Actual BB runs have exercised isolated workers, integration and exact-artifact review. A separate
same-context run exercised fallback. Neither run granted human acceptance.

## Installation surfaces

| Surface | What is installed | Who runs specialists |
| --- | --- | --- |
| Coding-agent skill for Codex, Claude Code, Cursor, or Copilot | Parent, specialist contracts, and all 38 outcomes | The current coding agent, with native workers only when the host provides them |
| Claude or Codex plugin | The same complete method tree; Claude also gets one native Conquistador agent | The native parent asks the host for worker contexts when available |
| Agent Plugins client | The method tree declared by `plugin.json` | The client; the package format does not define a universal agent API |
| Package-manager `harness` target | Portable master-agent JSON and the complete method tree | The consuming host adapter |
| Package-manager `squad` target | Fixed worker and advisor JSON packages | The consuming host adapter, in separate contexts when supported |
| Local MCP | Bounded listing and reading of method text | The MCP client model and its own agent system |
| Runtime MCP bridge | Tools for implemented runtime playbooks and artifacts | The configured runtime; general specialist orchestration remains host-owned |
| Eve or official Grok Bot package | Experimental instructions and packaged skills | Native execution and specialist delegation remain unverified |

A domain-specific host can restrict the available roster, skills, knowledge roots, and tools.
`setup.mjs --domain ABS` writes `domain-restriction.json` next to a coding-agent, plugin, or
harness install. The callable coordinator checks that file before loading assignments or dispatching
workers, even when no additional authorizer callback is supplied. `createDomainAuthorizer(root)`
is available to other consuming hosts. Parent integration uses `skills=[]`. An `outcome` assignment
may load any skill in `allowed.skills`; the mandatory final review still requires `fresh-eyes-review`
in the dependency closure. Local MCP does not read the restriction file; domain MCP is unsupported.
No restriction file means the full package. Plugin and harness copies include
`hosts/coding-agent/README.md`. Compact skill folders do not include that adapter; native BB
dispatch needs the complete distribution or a plugin/harness copy that includes those modules.
Compact skill installs filter the copied methods, but their consuming host must enforce the
restriction file. Direct host filesystem and tool access is outside the coordinator's controls.

## Stack setup

Before adding a tool, Conquistador inspects what the project and host already use. The parent maps the
task to an existing connector, MCP server, maintained CLI, warehouse, or operator-supplied Executor
route. The catalog's `createStackSession` reads explicit host inventory, selects the exact extension,
adapter and Connection, then applies operation, principal, data and budget limits. Missing routes
return unsupported or connection-required. Writes require a separate human handoff.

One bounded public repository metadata read has succeeded through the implemented Executor mapping.
Its candidate-verification receipt does not establish supported provider status. Databricks,
Confluence, HubSpot, vision and warehouse connections still need their own exact adapters and evidence.
Credentials remain host-owned. Setup receipts contain identifiers and digests, without customer rows
or credentials. Deadlines return unknown when a host ignores cancellation and retain the reservation.

Recurring analytics should use an owned warehouse or durable export when available. Live provider
interfaces remain appropriate for provider-only reads and approved writes. Authentication, new paid
services, production permissions, and external actions remain human-owned.

## Optional Conquistador mode and hooks

Ordinary use starts when the user invokes Conquistador. No hook, daemon, schedule, or service is
enabled by installation.

A host may opt into Conquistador mode by routing selected task requests through the parent and by
calling the included proactive helper for its three events: session start, before delivery,
and results updated. The Claude adapter registers only session start and before delivery; results
updated remains a generic helper event. The explicit Claude configuration lifecycle is documented in
[Proactive advice](PROACTIVE.md); native event delivery remains unverified. The helper returns instructions. It does not create agents, schedule work, change
accounts, or perform external actions. The host must deliver the event and decide whether to create
specialist contexts for the resulting task.

Keep runtime data, project knowledge, credentials, and finished work outside the installed package.
Publishing, spend, sends, deployment, memory writes, and feedback disclosure keep their documented
human decisions in every mode.
