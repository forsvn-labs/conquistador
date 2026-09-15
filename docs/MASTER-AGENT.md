# Master agent and execution modes

Conquistador accepts one outcome and owns the finished result. It can assign parts of a multi-stage
request to specialist roles that combine existing outcome skills, relevant project knowledge, and a
named composition workflow. The parent integrates the work and returns one review packet.

The product does not set a fixed team size. A narrow request uses one role. A broader request uses the
number of roles the work needs, subject to the host's limits. Each assignment has one goal, exact
context, tools, dependencies, limits, and a verifiable finish state. Specialists cannot delegate or
authorize consequential actions.

## Execution modes

| Mode | Behavior | Availability |
| --- | --- | --- |
| Direct | The parent performs a narrow assignment with the relevant outcome skill | Available in every complete install |
| Specialist team | The parent creates isolated assignments and runs independent work concurrently | Available only when the host exposes agent or worker contexts |
| Sequential team | The parent runs the same specialist contracts in one context and in dependency order | Portable fallback in every complete install |
| Fixed advisor/worker | One production role hands one artifact to one review role | Separate `squad` package; not the dynamic specialist team |
| Runtime playbook | The optional runtime executes a declared graph | Limited to implemented runtime playbooks; it does not execute the general specialist team |

An independent review needs an isolated context. Sequential review must be identified as
same-context. Installation or file discovery does not prove that a host created another agent.

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

A domain-specific host can restrict the available roster, skills, knowledge roots, and tools in its
adapter. The current setup command does not build a custom domain package. It prepares the complete
portable master agent or the fixed squad.

## Stack setup

Before adding a tool, Conquistador inspects what the project and host already use. The parent maps the
task to an existing connector, MCP server, maintained CLI, warehouse, or operator-supplied Executor
route. It prepares the smallest missing interface and verifies that route before assigning it.

Recurring analytics should use an owned warehouse or durable export when available. Live provider
interfaces remain appropriate for provider-only reads and approved writes. Authentication, new paid
services, production permissions, and external actions remain human-owned.

## Optional Conquistador mode and hooks

Ordinary use starts when the user invokes Conquistador. No hook, daemon, schedule, or service is
enabled by installation.

A host may opt into Conquistador mode by routing selected task requests through the parent and by
calling the included proactive helper for its three supported events: session start, before delivery,
and results updated. The helper returns instructions. It does not create agents, schedule work, change
accounts, or perform external actions. The host must deliver the event and decide whether to create
specialist contexts for the resulting task.

Keep runtime data, project knowledge, credentials, and finished work outside the installed package.
Publishing, spend, sends, deployment, memory writes, and feedback disclosure keep their documented
human decisions in every mode.
