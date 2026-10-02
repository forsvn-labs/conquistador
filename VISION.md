# Product principles

Conquistador helps users do marketing and growth work in their existing coding agent: on any
platform, in any service, and inside their product. Launches are one job among many; strategy,
social, search and AI answers, paid ads, email and outreach, in-product growth, content, and
measurement carry equal weight. Users ask for an outcome. One skill, `/conquistador`, routes it to a
command (one method) or a play (a declared chain of commands), assigns bounded specialist work when
useful, and owns one integrated, reviewed deliverable.
Research, creative work, engineering, and review support that mission.

## Make the first task easy

`npx @forsvn/conquistador` detects the user's agents, shows that set with "keep or customize",
asks for global or project scope, installs one skill, and opens the agent. A project without
`GROWTH.md` opens with `/conquistador init`; otherwise the task picker opens. Choose the target
before any change, show the scope and the exact undo command, and never add hosts that the user
did not choose. Support every agent whose skill path the agent's own documentation confirms.

Copy Impeccable's interaction model for growth work. Users learn a small vocabulary: one-word
commands such as `position`, `outreach`, `launch`, and `audit`, typed after `/conquistador`, or a
plain request that the router sends to the right command or play. Hosts register exactly one
skill. `/conquistador` with no argument shows a menu that leads with two or three commands that
fit this project. `/conquistador pin outreach` makes a standalone shortcut. Old skill names keep
working as aliases. On the CLI, the user needs `conquistador`, `conquistador "TASK"`, update,
doctor, and remove; every other route stays behind `help --all` and INSTALL.md.

`/conquistador init` records durable product truth in `PRODUCT.md` (shared with Impeccable) and
growth truth in `GROWTH.md`. Every command reads both through the brief, so the agent does not
learn the product again on each task. Init asks only about real gaps and never overwrites a file
that another tool wrote. A repository and connected accounts are not prerequisites for a first
draft.

The playbooks are the product. An agent that answers from general knowledge while the right
playbook sits unread is a product failure, not a style choice. So one briefing engine decides
what each task must read; the MCP tool returns those playbooks inline; plugin hooks add the
reading list to relevant prompts and send the agent back once when it skipped them; and every
deliverable ends with the playbooks it applied. A play returns its steps and the playbooks to
read at each step. The user's own playbooks rank first, read in place. Coding prompts get nothing.
`conquistador check` and its edit hook check marketing text against fixed rules with no model:
unsupported claims, AI-writing tells, vague calls to action, channel limits, email compliance,
and link hygiene. A clean check is evidence, not proof of quality.

The public npm package `@forsvn/conquistador` leads acquisition: `npx @forsvn/conquistador` or a
global install. Pinned Git tags stay available for exact versions. List the same plugin in the
agent marketplaces. Advertise a version only after its exact package is on the registry and a
clean global lifecycle passes.

Make the first result small enough to review: one complete marketing draft, one growth
experiment brief, or one product specification. Give one focused correction opportunity and
preserve the user's other facts. Synthetic examples demonstrate a contract; they are not host
runs or customer outcome evidence. Specification acceptance does not authorize implementation.

An installed library must contain the methods and resources its parent routes to. Report local
completeness, host discovery, hook trust, actual knowledge use, task success, correction quality,
and human usefulness separately. A passing install or
a cited playbook does not prove that the answer is useful.

The host supplies the model, context, tools, permissions, and worker contexts. Use specialists
within host limits; use a labeled same-context fallback when separate contexts are unavailable.
Specialist roles compose the existing methods, not a second library. Installation starts no
daemon, watcher, or schedule. Hooks are read-only, fast, never block unrelated work, and can be
turned off. Public labels stay visible; prompts, routing scores, and chain-of-thought stay private.

## Connect only what the task needs

Conquistador is provider-agnostic. It names capabilities (`analytics.read`, `crm.read`,
`email.send`, `ads.read`), not providers. The user connects the services they already use in
Executor; at task time the agent finds the tool with Executor's search, reads its schema, and
calls it. `conquistador connect` shows each capability as missing, connected, or verified,
installs Executor after confirmation, and opens the Executor UI to add a source. Adding a provider
is a Markdown recipe, not code. Start with supplied context; connect only what the task needs.

Reads run within host policy. Every send, publish, spend, or other write shows its exact payload
and needs the user's approval each time. Credentials stay in Executor, never in chat. Conquistador
never starts an Executor server as a side effect: Executor's CLI starts a folder-scoped daemon
when none answers, and that daemon hides the user's integrations. Only an explicit, confirmed
`connect` step may start Executor.

Eve is for explicitly requested jobs that outlast the coding session. Each job has one coordinating
parent and a named owner. Keep exact dependency pins and review upgrades against the deployed
account, approval, and recovery paths. A release check grants no new operations and starts no job.
Do not duplicate provider credential storage or the method library.

## Preserve evidence and user control

Methods must be original, independently useful, and clear about evidence and limits. Keep private
knowledge, customer records, credentials, and workspace history out of product source. Preserve
required licenses and notices. Distinguish synthetic tests, observed results, operator attestations,
and human acceptance. Passing tests cannot establish model quality or general provider support.

Review happens where the work is. `conquistador review` opens Markdown in the FORSVN Proof fork
(channel previews, check findings as comments, the playbooks applied, and a human-only approval
stamp bound to the SHA-256 of the exact text) and HTML in Lavish, both on loopback with no hosted
sharing. Source files stay canonical. An annotation is a revision request. An approval stamp
records one human decision for one exact text; it never authorizes a send, publication, or spend. Host-event advice is opt-in, must reject invalid input, and must not block completion.
The callable coordinator enforces domain restrictions; other consuming hosts must enforce their
own access boundaries.

Publication, spend, sends, external writes, reusable memory, and feedback disclosure retain their
applicable human decisions. Accepting a draft does not authorize memory or disclosure. Feedback
needs a redacted preview and exact-content consent. No automatic transcript collection, global
learning, or background feedback upload is planned.

## Public alpha, judged by real tasks

The repository and the npm package are public from 0.2.0; 0.2.2 is the current published alpha.
Source changes remain unshipped until their release is recorded. Judge the product through real tasks and
corrections, not install counts. Each release, marketplace listing, and landing change still needs
an explicit decision. Local package records do not grant release authority. See [ROADMAP.md](ROADMAP.md) and [PROGRESS.md](PROGRESS.md).
