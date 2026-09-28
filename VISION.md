# Product principles

Conquistador helps users do marketing and growth work in their existing coding agent: on any
platform, in any service, and inside their product. Launches are one job among many; strategy,
social, search and AI answers, paid ads, email and outreach, in-product growth, content, and
measurement carry equal weight. Users ask for an outcome. The parent selects the necessary methods,
assigns bounded specialist work when useful, and owns one integrated, reviewed deliverable.
Research, creative work, engineering, and review support that mission.

## Make the first task easy

Setup ends inside the user's agent, with the task already typed, not in a list of next steps.
Bare `conquistador` installs into every agent it finds without asking, asks what to work on, and
opens the agent with that task. The agent learns the product from the repository, so the user does
not describe it first. The user learns four commands: `conquistador`, `conquistador "TASK"`,
update, and remove, plus `/conquistador` inside the agent. Every other route stays available
behind `help --all` and INSTALL.md, because a long menu stops people from starting. Install once
per user; it works in every project. The same package
also serves the other surfaces: skills only, a local or hosted MCP server, a bot pack for chat
apps, and the per-project operator. Every route has a clear update and removal path, and none
adds a dependency or lockfile to the user's project.

The playbooks are the product. An agent that answers from general knowledge while the right
playbook sits unread is a product failure, not a style choice. So one briefing engine decides
what each task must read; the MCP tool returns those playbooks inline; plugin hooks add the
reading list to relevant prompts and send the agent back once when it skipped them; and every
deliverable ends with the playbooks it applied. The user's own playbooks rank first, read in
place. Coding prompts get nothing.

Pinned private Git references lead acquisition during the private alpha. Public alpha should
publish `@forsvn/conquistador` to the npm registry and list the same plugin in the agent
marketplaces. Do not advertise the registry command until the exact public package exists,
registry ownership is verified, and a clean global lifecycle passes.

An installed library must contain the methods and resources its parent routes to. Report local
completeness, host activation, knowledge use, and task success separately. A passing install or
a cited playbook does not prove that the answer is useful.

The host supplies the model, context, tools, permissions, and worker contexts. Use specialists
within host limits; use a labeled same-context fallback when separate contexts are unavailable.
Specialist roles compose the existing methods, not a second library. Installation starts no
daemon, watcher, or schedule. Hooks are read-only, fast, never block unrelated work, and can be
turned off. Public labels stay visible; prompts, routing scores, and chain-of-thought stay private.

## Connect only what the task needs

Start with supplied context and permitted connections. When missing live access blocks the task,
help the user set up Executor, connect the host, sign in through the service UI, verify the required
operation, and resume. A new user should not need to know Executor beforehand. Existing connections
remain subject to host policy. Credentials stay with the host or connection manager.

Eve is for explicitly requested jobs that outlast the coding session. Each job has one coordinating
parent and a named owner. Keep exact dependency pins and review upgrades against the deployed
account, approval, and recovery paths. A release check grants no new operations and starts no job.
Do not duplicate provider credential storage or the method library.

## Preserve evidence and user control

Methods must be original, independently useful, and clear about evidence and limits. Keep private
knowledge, customer records, credentials, and workspace history out of product source. Preserve
required licenses and notices. Distinguish synthetic tests, observed results, operator attestations,
and human acceptance. Passing tests cannot establish model quality or general provider support.

Use Lavish AXI through the host for optional previews and annotations; keep source artifacts
canonical. Host-event advice is opt-in, must reject invalid input, and must not block completion.
The callable coordinator enforces domain restrictions; other consuming hosts must enforce their
own access boundaries.

Publication, spend, sends, external writes, reusable memory, and feedback disclosure retain their
applicable human decisions. Accepting a draft does not authorize memory or disclosure. Feedback
needs a redacted preview and exact-content consent. No automatic transcript collection, global
learning, or background feedback upload is planned.

## Stay private until a release decision

Private distribution is the initial boundary. Judge it through real tasks and corrections. Keep the
repository private and the npm publication guard enabled. Public distribution, marketplace listings,
and landing work require an explicit later decision. Local package records do not grant release
authority. See [ROADMAP.md](ROADMAP.md) and [PROGRESS.md](PROGRESS.md).
