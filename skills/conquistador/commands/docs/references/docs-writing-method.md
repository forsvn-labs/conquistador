---
title: Docs Writing Method
lifecycle: canonical
status: stable
produced_by: docs
load_class: REFERENCE
---

# Docs Writing Method

## Why this skill exists

A codebase is not documented when it has a README — it's documented when a new team member can install, configure, run, and extend it without reading source code OR asking anyone. Most "documentation" stops at the surface: a 200-line README with quick-start that breaks at step 3, no API reference, stale environment variable lists, no troubleshooting for errors the code actually throws. The cost compounds: onboarding takes weeks instead of days, the same questions get asked in Slack every quarter, contributors give up and fork private patches.

This skill exists to make documentation truthful and audience-appropriate. Multi-agent orchestration (6 agents across 2 layers — scanner, concept-extractor, audience-profiler in parallel; then writer → staleness-checker → critic sequentially) ensures every claim traces to the codebase, every section matches the audience's vocabulary, and stale claims (Node 16 vs Node 18, missing env vars, renamed endpoints) get caught before delivery.

7 output types map to 7 audiences with 7 lengths. 4 specialized routes (audit / sync / ship-log / release-notes) override the default writer pipeline when the operator's intent is sharper than "document this." The artifact varies by route — most write to project files (README, docs/), but ship-log writes to `.forsvn/artifacts/product/write-technical-docs/product-context.md` (canonical cross-stack contract) and release-notes appends to `CHANGELOG.md` (convention-enforcing).

## Methodology

**Audience first, content second, prose third.** audience-profiler-agent runs in parallel with scanner + concept-extractor, NOT after. Audience drives vocabulary, code-example shape, assumed-knowledge baseline — everything downstream depends on it.

**Every claim must trace to the codebase.** staleness-checker-agent runs on every writer output. Documentation that says "Node 16" when `package.json` says `>=18` fails the critic. Hallucinating an API endpoint that doesn't exist fails the critic. "See code for details" fails the critic — that defeats the purpose of documentation.

**Route-specific behavior overrides the default pipeline.** Routes C (sync), D (ship-log), and E (release-notes) each modify which agents run, which references load, and which critic gates fire. The orchestrator selects the route from the trigger phrase or flag; the route then locks the audience-profiler-agent to a pre-set value (no inference) and swaps templates.

**Critic-agent fires on every run.** Route-specific gates replace the default gates for ship-log and release-notes (these have different success criteria — narrative completeness for ship-log, convention compliance for release-notes — so the standard checklist doesn't apply).

## Principles

- **The 6 standard critical gates are the contract** (for default + README + user-guide + api-reference + config-guide + tutorial + audit + sync routes). Every user-facing feature documented. Setup numbered with expected outcomes. New user follows Getting Started without source code. Code examples compile. Configuration lists defaults + valid values. Troubleshooting covers code-visible errors.
- **Ship Log writes to a canonical artifact** (`.forsvn/artifacts/product/write-technical-docs/product-context.md`) consumed by 12+ downstream skills. The pre-write merge-mode check is non-negotiable — overwriting an icp-research-authored product-context loses marketing context.
- **Release Notes are convention-enforcing.** Anti-patterns from past releases (file inventories, fresh-eyes recaps, anti-goals lists, "What did NOT change" sections) cause hard critic FAIL. 20-line cap is hard. Per-section bullet cap is hard.
- **No "see code for details."** The skill exists because operators don't want to read source code. Saying "see code" is a refusal to do the job.
- **Documenting internals is rare.** Users care about behavior + interfaces, not ORM layer + dependency-injection container. The exception is contributor docs (architecture.md, contributing.md) where internals ARE the audience's job.
- **Stale screenshots rot faster than text.** writer-agent prefers text descriptions of UI elements. When screenshots are unavoidable (visual UI, design docs), they get a `<!-- captured: YYYY-MM-DD -->` comment for staleness tracking.

## Documentation Types (mode catalog)

| Type | Audience | Focus | Length |
|------|----------|-------|--------|
| **README** | Developers discovering the project | What it does, quick start, contribution | 1-3 pages |
| **User Guide** | End-users operating the product | Workflows, features, troubleshooting | 5-20 pages |
| **API Reference** | Developers integrating | Endpoints, parameters, responses, errors | Varies |
| **Configuration Guide** | Operators deploying | Environment vars, settings, infrastructure | 2-5 pages |
| **Getting Started Tutorial** | New users of any type | Single workflow, start to finish | 1-2 pages |
| **Ship Log** | Humans + coding agents | Product snapshot, features, tech stack, shipping history | 2-5 pages |
| **Release Notes** | Stack users on `/plugin update` | What changed in a version — user-visible delta only | ≤20 lines per entry |

Default to **User Guide** if the user says "document this" without specifying type. Default to **Ship Log** if the user says "product context" or "what does this app do." Default to **Release Notes** if the user says "release notes," "changelog entry," or passes `--release-notes`.

## 3 Audience Types

| Audience | Vocabulary | Code Examples | Assumed Knowledge |
|----------|-----------|---------------|-------------------|
| **End-user** | Plain language, no jargon | Only CLI commands they run | Can install software, use a browser |
| **Developer** | Technical terms, API vocabulary | Request/response samples, code snippets | Can read code, use package managers |
| **Operator** | Infrastructure terminology | Config files, deployment commands | Understands networking, servers, CI/CD |

The audience-profiler-agent infers from codebase signals (UI-heavy = end-user / API-heavy = developer / Dockerfile + CI configs = operator) unless the route locks it (ship-log = mixed, release-notes = stack user, sync = preserves existing audience).

## File Importance Ranking (7 ranks)

The scanner-agent ranks files by documentation value. Read top-ranked first for highest-leverage extraction.

| Rank | File Type | What It Reveals | Priority |
|------|-----------|-----------------|----------|
| 1 | Entry points (`main.*`, `index.*`, `app.*`) | App initialization, core structure | Read first |
| 2 | Route/endpoint definitions | Feature surface area | Read second |
| 3 | Config/env files | Setup requirements, feature flags | Read third |
| 4 | Models/Types/Schemas | Core data entities, relationships | Read for depth |
| 5 | Components/Views | UI structure, user interactions | Read for UX docs |
| 6 | Middleware/Interceptors | Auth, logging, error handling | Read for ops docs |
| 7 | Migration files | Data model evolution, schema requirements | Skim for setup |

## When NOT to use this skill

- **Specifying what to build** → `shape`. Documenting hallucinated requirements is worse than no docs.
- **Restructuring code for readability** → code readability cleanup outside this skill. Documentation can't fix a confusing codebase; cleanup it first.
- **Visual brand identity for the docs site** → `/create-brand`.
- **Single-page conversion surface** (landing page) → `convert`.

## Further reading

- [`anti-patterns.md`](anti-patterns.md) [ANTI-PATTERN] — 7-pattern failure catalog
- [`intake-prompts.md`](intake-prompts.md) [PROCEDURE] — Warm + Cold intake prompts verbatim
- [`report-template.md`](report-template.md) [PROCEDURE] — default artifact template + frontmatter
- [`modes/sync.md`](modes/sync.md) [PROCEDURE] — Route C: Post-Change Sync (git diff → targeted updates only)
- [`modes/ship-log.md`](modes/ship-log.md) [PROCEDURE] — Route D: Ship Log (writes canonical `.forsvn/artifacts/product/write-technical-docs/product-context.md`)
- [`modes/release-notes.md`](modes/release-notes.md) [PROCEDURE] — Route E: Release Notes (CHANGELOG.md entry + GH Release body, convention-enforcing)
- [`modes/audit.md`](modes/audit.md) [PROCEDURE] — Audit mode (staleness-only, no writing)
- [`doc-template.md`](doc-template.md) — default writer template (pre-existing, writer-agent consumes)
- [`ship-log-template.md`](ship-log-template.md) — ship-log writer template (pre-existing, writer-agent consumes in Route D)
- [`examples/api-readme-walkthrough.md`](examples/api-readme-walkthrough.md) [EXAMPLE] — Node.js REST API README end-to-end
- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) (single-context / fast path) — `--fast` behavior (standard-tier skill; `--fast` runs Single-Agent Fallback but still enforces critic gates per safety-gates-supersede rule)
- [`intake-prompts.md`](intake-prompts.md) — canonical intake spec
