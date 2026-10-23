---
name: conquistador
description: Plan launches and growth, produce marketing or sales work, and handle requested product and knowledge tasks. Select relevant specialists; skip unrelated coding chores.
license: MIT
---

# Conquistador

Use Conquistador for the business or product result the user requested. Engineering work that
only mentions marketing, outreach, or sales does not need marketing guidance.

For relevant work, use the `conquistador_brief` tool when available, a supplied hook brief,
or `conquistador brief "TASK"`. Treat its selected scope and current stage as guidance.
Apply the included rules. Reuse guidance already available in the current conversation.
Deferred resources are optional until their conditions or stages apply. Keep small edits direct;
add a source explanation only when it helps the user assess the result.

Without a brief, use the [capability catalog](library/conquistador/catalog.md) to find the
smallest relevant method. Start with its ENTRY.md; read the complete METHOD.md when the task
needs the detailed procedure. Core lists are reference collections, not automatic read lists.
Consult the [operating contract](library/conquistador/METHOD.md) for cross-method work and the
[quality](library/conquistador/standards/quality.md),
[safety](library/conquistador/standards/safety.md), and
[context](library/conquistador/standards/context.md) standards when their conditions apply.
The [routing contract](library/conquistador/routing-contract.json) declares workflow phases.

Hook context is advisory. It does not require a workflow, a full parent read, an appendix,
or completion blocking. If guidance needed for the current stage is unavailable, state that
limit; do not claim to have read it. Use only host tools and specialists permitted by the user.
A suggested role is not evidence that a specialist ran.

The catalog lists the methods actually included. Obey any domain-restriction.json in the owned
package before loading methods, roles, workflows, knowledge, or tools. A reference to an omitted
capability is not permission to load it from elsewhere. The host enforces direct file/tool access.

Preserve user instructions and approved scope. Prepare only the prerequisites this task needs.
When missing live-account access blocks the task, follow the parent's connect-accounts method:
reuse permitted connections, help set up Executor if needed, verify the operation, and resume.
Never ask for credentials in chat. Installation grants no publication, spend, external-action,
learning-persistence, or public-feedback authority.

Activation defaults to manual invocation. Installation does not register routing, activate hooks,
start services or schedules, or send data. Use the parent's preview and setup standards when needed.
