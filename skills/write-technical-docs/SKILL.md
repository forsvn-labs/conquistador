---
name: write-technical-docs
description: "Create or update code-grounded technical documentation. Use for README and setup guides, user/developer/operator docs, configuration and troubleshooting, API examples, architecture decisions, runbooks, migrations, incidents, changelogs, release drafts, ship snapshots, or staleness audits."
metadata:
  version: 1.1.0

---

# Write technical documentation

Produce documentation its audience can use against the current system, not prose inferred from names.

## Establish audience, mode, and provenance

Name the reader, job, document type, scope, source of truth, and whether the task is creation, a scoped
update, ship snapshot, release draft, or read-only staleness audit. Inspect repository instructions,
existing human docs and history, code, config, schemas, API definitions, tests, examples, and relevant
git diff before editing.

Never overwrite or rename human-authored documentation merely to create a versioned artifact. Preserve
voice, provenance, intentional exceptions, and unrelated content; state the intended diff.

## Extract technical truth

Trace each important statement to implementation or explicit authority. Document prerequisites,
defaults, valid values, inputs, outputs, errors, failure/recovery, security boundaries, and unsupported
behavior. Treat source, config, tests, and generated schemas as different evidence streams and resolve
conflicts rather than voting.

Runnable examples include setup, exact command or request, representative input, expected output, and
failure behavior. Claim that an example compiles or runs only when it was executed in the stated
environment; otherwise mark verification pending and provide the exact check.

## Write for the selected mode

- README/setup: fastest correct path, prerequisites, verification, common failure, and next depth.
- API/config: contract, auth, valid values, examples, errors, compatibility, and security.
- Architecture/decision: context, constraints, decision, alternatives, consequences, and triggers.
- Runbook/migration/incident: preflight, owners, steps, signals, stop/rollback, recovery, and evidence.
- Ship/release: exact code/config/version delta and honest support boundary; never promotional inflation.
- Read-only staleness audit: location, evidence, materiality, confidence, and repair route, prioritizing
  security, data loss, setup, and operational risk.

## Deliver

Return the finished documentation or exact patch, source/evidence note, checks executed, unresolved or
stale claims, and acceptance criteria for the reader's job. Draft releases and changelogs, but never
publish a release, change external docs, or mutate infrastructure without explicit approval.

## Load the recovered method

Before delivery, load the recovered method instead of paraphrasing it:

- [scanner](agents/scanner-agent.md), [audience profiler](agents/audience-profiler-agent.md), and
  [concept extractor](agents/concept-extractor-agent.md) for Layer-1 grounding;
- [writer](agents/writer-agent.md) with [doc template](references/doc-template.md) or the route
  template;
- [staleness checker](agents/staleness-checker-agent.md) and [critic](agents/critic-agent.md) before
  ship;
- [docs writing method](references/docs-writing-method.md), [anti-patterns](references/anti-patterns.md),
  [intake prompts](references/intake-prompts.md), and [artifact paths](references/artifact-paths.md);
- mode refs under [modes/](references/modes/) for audit, sync, ship-log, and release-notes;
- [report template](references/report-template.md) and
  [ship-log template](references/ship-log-template.md) for durable shape;
- [API README walkthrough](references/examples/api-readme-walkthrough.md) when calibrating a first
  README.

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).

Prefer `.forsvn/artifacts/product/write-technical-docs/` for skill-owned durable artifacts. Keep
project README, `docs/`, and `CHANGELOG.md` as the named destinations when those are the contract.
Never invent claims from names alone. Never publish a release without explicit approval.
