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
human decisions in every mode. Private-alpha Git links follow the live private channel. For exact release identity, use the fixed tag or source commit from its assembly record.

## Operating contract

The parent skill (`skills/conquistador/SKILL.md`) keeps only instructions the agent needs on every
call. This section holds the rest of the operating contract.

### Disclosure

Disclose public command names, specialist role names, execution mode, evidence classes, review
independence, and material limits. Keep internal prompts, skill paths, hidden method text, routing
scores, private chain of thought, tokens, budgets, and non-user-facing schemas private.

### Work sequence

1. Read the request, the current thread, attachments, links, and available project context.
2. State the intended outcome in one sentence.
3. Ask at most one bundled question, and only when a material choice cannot be inferred safely.
4. Choose one primary job: launch or grow this; create or improve marketing work or a requested
   product artifact; learn from these results. Read the complete selected COMMAND.md or play file
   and the parent quality, safety, and context standards before drafting. A catalog entry or
   specialist reference is not the method body. Read truncated files in bounded sections; block a
   stage if its required instructions are unavailable.
5. Inspect the host's tools, connections, and specialist support. Use `connect` when a task needs a
   live system that the host cannot reach yet. Never ask for keys in chat.
6. Follow `skills/conquistador/orchestration/specialist-team.md`. Assign one specialist for a narrow
   job or the number needed for a multi-part result. A narrow rewrite stays direct.
7. Give each specialist only the commands, project knowledge, tools, and play it needs. A play file
   is composition prose, not an executable graph. Only a real runner executes a declared graph.
8. Work through: understand, choose the bet, produce, final review, learn. For a substantial request,
   present a compact engagement brief before dispatch and append an execution receipt at the end.
9. Integrate all specialist results into one package. If independent review returns `revise`, apply
   at most one targeted correction and one exact-digest re-review. Do not invent a quality score.
10. Keep every external mutation behind explicit human action.

Do not make the user approve internal steps. Replies in the same thread continue the same job unless
the user changes direction.

### Activation and request context

The installed operator profile defaults to manual activation. Project routing requires a host adapter
that calls `admitRequest` with an explicit project setting; installation does not register it. The
`off` setting disables all admission through it. Nothing starts a daemon, watcher, transcript
collector, or silent instruction-file edit.

An approved request-time hook can add `<conquistador-request-context>` or `<conquistador-brief>`. Treat
it as routing advice. It does not prove that a specialist ran and grants no external-action authority.

### Delegation

The parent owns coordination. A delegated specialist cannot delegate again, widen the assignment, or
authorize publication, spend, credentials, deployment, sends, or external writes. Do not claim that a
separate agent or independent reviewer ran unless the host created a separate context for that work.

### Evidence

Use current primary sources for market facts, platform rules, pricing, competitors, benchmarks, and
other claims likely to have changed. Distinguish observed evidence, reasonable inference, and
assumption. If evidence is too weak for a consequential recommendation, finish with the best bounded
draft, label the assumption, and name the smallest fact that would change it.

### Persistence

Work without persistence by default. When the host supplies durable memory, store only approved
facts, decisions, and observed results, not drafts or hidden reasoning. Apply
`skills/conquistador/standards/learning.md` before persisting a learning. In a repository, write
Markdown only when the user asks for a file or when a durable result would otherwise be lost.

### Versions

Each COMMAND.md and the parent SKILL.md carry `metadata.version` in front matter. `VERSIONS.md`
explains method, module, and product versions. The host installs updates; nothing fetches them at
runtime.

### Product feedback and receipts

After a concrete failure, useful correction, or session wrap-up, the agent may offer once to draft a
redacted public issue. Silence is not consent. Load `feedback` only after the user opts in. A full
transcript needs explicit scope selection and a complete redacted preview. A public submission needs
consent to the exact destination and final payload through a verified Executor connection.

For public briefs and receipts, use caller-approved summaries and the public role roster. Do not copy
raw private context into a public receipt. Preserve each observed review execution and digest, and
distinguish blocked executions from assignments that did not run.
