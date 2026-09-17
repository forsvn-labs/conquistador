# One outcome, one reviewed deliverable

Conquistador helps with growth, GTM, sales, marketing, product, and knowledge work.
Give it the outcome, source material, constraints, and destination. It selects the relevant methods,
completes the work through your host, reviews the result, and recommends a next step.
See [task examples](USAGE.md) for inputs and expected deliverables.

Your host supplies the model, tools, project access, permissions, and any separate worker contexts.
The method library does not supply a model or guarantee output quality. A narrow task can stay
with the parent. A broader task can use specialists when your host supports them and permits it.

## Choose an execution mode

| Mode | What you get | Requirement or limit |
| --- | --- | --- |
| Direct | The parent completes a task with the relevant methods | Uses your host's model and tools |
| Specialist team | Separate assignments, an integrated deliverable, and review of that exact artifact | The BB adapter needs an existing project, environment, and parent thread |
| Sequential team | The parent runs assignments and review in sequence | Review is in the same context; the callable coordinator requires an explicit host callback |
| Fixed worker and advisor | One production role hands an artifact to a review role | Separate `squad` package; the host must supply the contexts |
| Runtime playbook | A declared sequence with saved state and draft artifacts | Explicit runtime setup; limited to four implemented playbooks |

Independent review requires an isolated conversation context. A second pass in the parent's
context must be labeled same-context review. Separate conversations can still share files and
tools; isolation alone is not an access-control boundary. Installation does not prove that the
host created a worker or activated the skill.

The recommended operator package keeps the method library, portable agent contract, and BB
adapter together. Setup installs files only. It does not register an agent or project router in BB,
Claude, Codex, or another host. Invoke the parent file explicitly, or use a registered skill/plugin.

A host integration can import `loadOperatorProfile`, `admitRequest`, and `operatorStatus` from
`hosts/coding-agent/operator.mjs`. Call `admitRequest(profile, {text, source, recursive}, settings)`
for each user turn. `settings.activation` may be `manual`, `project`, or `off`; store it outside the
installed folder. Manual admission requires an explicit Conquistador invocation. Project admission
uses conservative domain phrases and abstains on ambiguous coding requests. Explicit invocation
can resolve that ambiguity. Off abstains even on explicit invocation. Invalid overrides disable
admission. This is a request-time decision function, not an automatic host registration.

No daemon, watcher, polling, or transcript collector starts. The router neither executes a task
nor authorizes an external mutation. A host must decide how to run an admitted task and enforce
its permissions. Before uninstall, detach routing and stop any active teams; file removal cannot
change host settings or stop running agents.

The BB coordinator emits a brief before dispatch and returns a deterministic receipt with the
private result. Public labels describe the selected capability methods and specialist roles.
Receipts retain integration, initial review, correction, and final-review executions separately,
including each review's artifact digest. Skipped assignments say `not-run`. Capabilities in a
receipt come from methods supplied to completed assignments, not from claims in the plan.
This records applied method contracts, not proof that a model followed or understood them.

Raw goals, model evidence/gaps, private knowledge bodies, method text, and prompts stay out of the
public projection. Optional presentation strings are caller-supplied public summaries; the caller
must approve them for display. Pattern checks reject recognizable secrets and paths but cannot
classify arbitrary confidential prose. The receipt reports result counts and limitation counts;
inspect the private result for the actual evidence and review findings. It does not verify sources,
classify live account data, audit host tool use, or grant human acceptance.

The BB coordinator limits concurrency to four and total dispatches to twelve, including integration,
review, and at most one correction cycle. Specialists receive bounded assignments and cannot delegate
or authorize consequential actions. See the private [BB adapter reference](https://github.com/forsvn-labs/conquistador/blob/private-alpha/hosts/coding-agent/README.md)
for commands, host callbacks, cancellation, briefs, receipts, and observed execution limits. Recorded
adapter runs do not establish general quality or human acceptance.

## Know what your install contains

| Install | What it contains | How work runs |
| --- | --- | --- |
| Staged parent-first skills.sh copy | One parent entry and all 38 internal methods, without the BB adapter | Your coding agent loads selected methods; the skills CLI owns its copy |
| Managed compact skill install | The parent, methods under `library/`, contracts, and selected usage docs | Your host supplies execution; this copy omits the BB adapter |
| Plugin or `operator` / `harness` package | The complete method tree, operator profile, and BB adapter; the Claude plugin also has a native agent definition | The consuming host supplies model, tools, and worker contexts. `harness` remains the setup alias |
| Fixed `squad` package | Worker and advisor role packages | The consuming host executes the handoff |
| Local MCP | Tools to list and read bundled methods | The MCP client supplies the model and execution tools; no runtime service is required |
| Runtime MCP bridge | Access to implemented runtime playbooks and draft artifacts | Explicit `mcp --url` and a configured runtime service are required |
| Portable Eve or official Grok Bot package | Experimental instructions and packaged skills | Native import and specialist delegation remain unverified |

Use the staged parent-first folder for the skills CLI. A raw source-root copy exposes canonical specialists. Do not install only the canonical nested parent
folder. A managed compact copy is a different layout, and cannot run an adapter it does not contain.
A standalone outcome install contains only that method and its required material.

Use the private [installation guide](https://github.com/forsvn-labs/conquistador/blob/private-alpha/INSTALL.md)
for commands, updates, and removal. `operator doctor --path ABS` through the complete CLI checks local
files against the manifest. It does not prove host activation, provider access, or task execution.
Start a fresh host session and complete a bounded task to check actual use.

Advanced hosts can restrict methods, knowledge, and tools to a domain. The coordinator enforces
its restriction file; other consuming hosts must enforce their own access. Local domain MCP is
unsupported. See the private [platform guide](https://github.com/forsvn-labs/conquistador/blob/private-alpha/docs/PLATFORMS.md)
for domain installs, package compatibility, and host-specific activation.

## Connect tools only when needed

Start with supplied context and permitted connections. If live account access blocks the task,
Conquistador helps set up Executor, hands sign-in to its UI, verifies one bounded authorized job,
and resumes the deliverable. A binary check, gateway login, or MCP tool listing does not establish
provider operation. Account setup does not authorize later sends, publishing, spend, or live writes.

The private [integration guide](https://github.com/forsvn-labs/conquistador/blob/private-alpha/docs/INTEGRATIONS.md)
contains official Executor setup commands and the separate checks for local files, binary detection,
discovery, and provider results. Credentials remain with their owner.

Eve jobs and the Conquistador runtime are advanced, explicit choices. Installing skills starts
neither service and enables no schedule. Eve preparation does not submit a job. The Conquistador
runtime executes four declared playbooks, not arbitrary combinations of all 38 methods. See the
private [runtime reference](https://github.com/forsvn-labs/conquistador/blob/private-alpha/runtime/README.md)
for model configuration, state, and execution limits.

## Optional feedback and follow-up

Ask for a [visual preview](PREVIEW.md) when you need to review layout or annotate a change.
Use [approved project memory](LEARNING.md) to retain useful facts or corrections. Automatic
cross-run retrieval and global learning are absent.

Ordinary use starts with your request. Optional [proactive advice](PROACTIVE.md) requires the host
to deliver an event. The helper returns instructions; it does not create workers, schedule jobs,
or perform external actions. Native Claude event delivery remains unverified.

Keep project knowledge, credentials, runtime state, and finished work outside the installed package.
Publication, spend, sends, deployment, memory writes, and feedback disclosure retain their documented
human decisions in every mode. Private-alpha Git links in this guide are proposed until that channel is available. Before then, read the corresponding files in the supplied complete distribution.
