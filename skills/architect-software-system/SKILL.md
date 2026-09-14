---
name: architect-software-system
description: "Design an implementation-ready software architecture for an explicit build, migration, or technical-product decision. Use for greenfield or brownfield systems, service boundaries, schemas, APIs, integrations, reliability, security, rollout, and technical tradeoffs—not routine marketing work."
metadata:
  version: 1.0.0

---

# Architect a software system

This is a demand-triggered engineering outcome. Invoke it only for explicit architecture, migration,
or build intent; do not route an ordinary marketing request into a generic engineering catalog.

## Establish mode and constraints

Choose greenfield, brownfield, or migration mode. Inspect the existing repository, instructions,
dependencies, deployment shape, schemas, APIs, tests, and operational evidence before replacing a
decision. Define the product flow, expected near-term load, team, budget, latency, availability,
privacy, compliance, data residency, and deployment constraints. Separate facts, estimates,
assumptions, and unresolved choices.

## Make inspectable decisions

For each consequential choice, show the selected option, credible alternatives, governing evidence,
tradeoffs, and reversal condition. Specify:

- components, ownership, boundaries, and dependency direction;
- data model, source of truth, lifecycle, consistency, migration, and retention;
- API and event contracts, idempotency, versioning, errors, and compatibility;
- external integrations, file/object boundaries, timeouts, retries, and failure isolation;
- identity, authentication, authorization, privacy, secrets, dependency trust, and threat boundaries;
- observability, capacity, cost, backup, recovery, rollout, rollback, and operations.

Architect to evidenced near-term load. Add an evolution threshold for each deferred scale mechanism;
do not pay an automatic 10× complexity tax without a measured trigger.

## Plan implementation without a runtime dependency

Break work into outcome-oriented vertical slices with stable IDs, dependencies, risk-first spikes,
acceptance evidence, migration/rollback, tests, docs, and human-owned prerequisites. Parallelize only
when resources and interfaces do not conflict.

Extract a shared service only when at least two real callers need the same stable capability. Preserve
the caller's why/when and move only the shared how; migrate one caller at a time against a green
baseline and stop on behavioral drift.

## Deliver

Return the system context, decision record, component and trust-boundary view, data/API/event contracts,
failure and recovery model, deployment/operations model, implementation slices, risks, validation plan,
and explicit unresolved decisions.

Do not provision infrastructure, migrate production data, rotate secrets, deploy, or make destructive
changes without explicit approval for the exact action.

Before delivery, load the recovered method instead of paraphrasing it:

- [stack-selection](agents/stack-selection-agent.md) and
  [infrastructure](agents/infrastructure-agent.md);
- [schema](agents/schema-agent.md), [api](agents/api-agent.md), and
  [integration](agents/integration-agent.md);
- [scaling](agents/scaling-agent.md) for near-term load, failure modes, and evolution thresholds;
- [critic](agents/critic-agent.md) against the eight critical gates;
- [system architecture method](references/system-architecture-method.md),
  [report template](references/report-template.md),
  [dependency classification](references/dependency-classification.md),
  [intake prompts](references/intake-prompts.md), and
  [anti-patterns](references/anti-patterns.md);
- pattern catalogs as needed:
  [tech-stack](references/tech-stack-patterns.md),
  [tech-stack matrix](references/tech-stack-matrix.md),
  [file structure](references/file-structure-patterns.md),
  [database](references/database-patterns.md),
  [API](references/api-patterns.md),
  [auth](references/auth-patterns.md),
  [deployment](references/deployment-patterns.md),
  [failure modes](references/failure-modes.md),
  [interaction edge cases](references/interaction-edge-cases.md),
  [security](references/security-patterns.md).

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Return the architecture inline by default. If the host supplies a durable artifact location and the
operator asks for persistence, write it there; no project-specific store is required.
Fuzzy requirements belong to `shape-initiative`; task decomposition stays outside this skill.
