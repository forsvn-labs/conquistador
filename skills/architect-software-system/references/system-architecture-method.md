---
title: System architecture method
lifecycle: canonical
status: stable
produced_by: architect-software-system
load_class: METHOD
---

# System architecture method

## Why this skill exists

Software architecture decisions compound. A choice made on day one — Postgres vs. SQLite, REST vs. tRPC, monorepo vs. polyrepo, Vercel vs. self-hosted — shapes every downstream feature, every migration cost, every onboarding hour for the next two years. Most architectures fail not because the tech was wrong but because the decision was unconscious: defaults chosen by familiarity, not fit.

This skill exists to make those decisions deliberate. Its lenses cover stack, operating environment,
state, interaction contracts, integrations, and evolution against the same constraints. A local app
may legitimately have no network API, server database, authentication system, or service fleet; the
method records that decision instead of fabricating those layers. The critic then verifies internal
consistency before delivery.

The output is one portable architecture artifact, returned inline by default or written to a
host-provided location when persistence is requested.

## Methodology

**Constraint-first, choice-second.** Scale targets + budget + team skills + compliance + latency are the architecture constraints. Stack choices that violate any constraint are wrong, regardless of how popular the framework. Layer-1 agents (stack-selection + infrastructure) receive constraints first, choose second.

**Layer-1 parallel, Layer-2 sequential — never invert.** Stack + infra can be chosen in parallel because they don't depend on each other (infra mostly depends on the deployment target which is itself a constraint). Schema → API → integration → scaling is sequential because each depends on the prior layer's output.

**Critic-gate before assembly.** All eight quality gates are verified before delivery. FAIL means
rework the specific weak section, not “the architecture didn't work.”

**Every dependency classified.** In-process / local-substitutable / remote-owned / true-external. This classification drives testing strategy in task decomposition and `fresh-eyes-review` downstream. An unclassified dependency is an untested dependency.

**Scale to evidence.** Use measured near-term load and explicit evolution thresholds. Do not impose
10× or 100× machinery when history and operating constraints are unknown.

## Principles

- **Every tech choice has a rationale** — not just "it's popular." Rationale gets captured in the artifact, not just in the agent's head.
- **An interaction contract exists for every user-facing feature** — this may be an in-process
  interface, command, file contract, event, or network endpoint.
- **The state model covers every persistent entity** — choose files, embedded storage, a database, or
  no persistence deliberately.
- **The operating and packaging section lists required configuration** — an empty environment-variable
  list is valid for a self-contained local component.
- **File structure matches chosen framework conventions** — deviating from conventions silently increases onboarding cost.
- **Identity and authorization are explicit** — “single local user; no authentication” is a valid
  bounded decision when supported by the product context.
- **At least one architectural trade-off is documented with alternatives considered** — "we picked X" is half the value; "we considered Y and Z" is the other half.
- **Premature microservices are the most common architecture failure** — start monolith, extract at pain points.

## Required vs. optional input artifacts

| Artifact | Source | Benefit |
|----------|--------|---------|
| `research/product-context.md` | supplied product and audience research | Industry context, user personas, and constraints |
| `.forsvn/artifacts/product/shape-initiative/specs/*.md` | shape-initiative | Scoped spec — the WHAT being architected |
| `.forsvn/artifacts/product/task-decomposition/tasks.md` | task-breakdown (meta-skills) | Feature list already decomposed into buildable units — informs feature-scoping in §9 |
| `.forsvn/artifacts/product/map-user-flow/*.md` | map-user-flow | Per-flow user flow diagrams + platform-surface matrix; read every file. Feeds API endpoint design and feature scoping. |
| `.forsvn/artifacts/mkt/prioritize-opportunities/prioritize-*.md` | prioritize-opportunities | Business initiatives — informs build-vs-skip on optional capabilities |
| Existing `.forsvn/artifacts/product/architect-software-system/system-architecture.md` | self (prior run) | Re-run mode: rename existing to `.forsvn/artifacts/product/architect-software-system/system-architecture.v[N].md` and write new version |

None are hard-required — this skill can run standalone via the Architecture Interview (see [`intake-prompts.md`](intake-prompts.md) [PROCEDURE]) — but every present artifact sharpens the output.

## Two modes of operation

**Mode 1: Tech Stack Already Chosen** — operator provides stack upfront (e.g., "I'm using Next.js + Postgres + Vercel"). Routing Logic row 1: skip stack-selection-agent; pass user's stack directly to schema-agent. Layer-2 chain runs unchanged.

**Mode 2: Need Tech Stack Recommendations** — operator needs help choosing. Routing Logic row 2: run stack-selection-agent first in Layer 1 (parallel with infrastructure-agent), then chain remaining agents.

The routing decision is automatic from the prompt — explicit stack names trigger Mode 1; absence triggers Mode 2.

## Further reading

- [`intake-prompts.md`](intake-prompts.md) [PROCEDURE] — Warm + Cold prompts + Architecture Interview (8 questions)
- [`anti-patterns.md`](anti-patterns.md) [ANTI-PATTERN] — failure modes catalog + revision-loop handling
- [`report-template.md`](report-template.md) [PROCEDURE] — 12-section artifact template + security subsections (STRIDE, OWASP, LLM/AI)
- [`dependency-classification.md`](dependency-classification.md) [PROCEDURE] — 4-category taxonomy that drives downstream testing strategy
- [`examples/saas-invoicing-walkthrough.md`](examples/saas-invoicing-walkthrough.md) [EXAMPLE] — Stripe invoicing tool end-to-end
- [`tech-stack-patterns.md`](tech-stack-patterns.md) — stack choice comparisons (stack-selection-agent consumes)
- [`tech-stack-matrix.md`](tech-stack-matrix.md) — stack comparison matrix (stack-selection-agent consumes)
- [`database-patterns.md`](database-patterns.md), [`api-patterns.md`](api-patterns.md), [`auth-patterns.md`](auth-patterns.md), [`file-structure-patterns.md`](file-structure-patterns.md), [`deployment-patterns.md`](deployment-patterns.md), [`failure-modes.md`](failure-modes.md), [`interaction-edge-cases.md`](interaction-edge-cases.md), [`security-patterns.md`](security-patterns.md) — agent-consumed pattern catalogs
- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) — `--fast` behavior (deep-tier skill; `--fast` runs Single-Agent Fallback but still enforces 8 quality gates per the safety-gates-supersede rule)
- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) — canonical Pre-Dispatch spec
