# Sequential fallback

Use when the host cannot run evidence-intake, benchmark, synthesis, recommendation, and critic as
separate agents.

Keep the same method. Change only the machinery.

## Hard blocks and stop states

- **Account scope empty** and no warm-start match → BLOCKED; ask for account scope.
- **No evidence for any platform** and no prior-eval artifacts → `NEEDS_CONTEXT`. Name what to export
  per platform and stop. Do not invent numbers.
- Platforms outside the supported five (X, LinkedIn, TikTok, YouTube, Instagram) → note out of scope
  and continue with the supported subset.
- Missing niche hint and no ICP context → warn; benchmarks will be weaker; not a hard block.

`--fast` does **not** skip Cold Start or Critical Gates. It only collapses multi-agent orchestration
to single-pass intake + synthesis (critic still recommended; if skipped, record the internal grade
and stop for the human — an unreviewed result never ships).

## Intake

Resolve before any lens runs:

1. Account scope — whose accounts (company, founder personal, etc.).
2. Platforms in scope — subset of X / LinkedIn / TikTok / YouTube / Instagram.
3. Supplied evidence per platform — exports, screenshots-as-text, figures, or honest "none".
4. Niche / audience hint — or point at existing `research-positioning` output.
5. Optional prior-eval pointer under `.forsvn/loops/`, when that store exists. No store → skip and
   rely on operator-supplied prior evidence.

This skill never holds platform credentials and never calls live analytics APIs. Operator-pasted
evidence is the input. Public metrics may be fetched with ordinary web tools.

Warm start (optional): when the local store exists and `.forsvn/artifacts/mkt/research-channel/[slug].md`
already exists for the same account scope, offer (a) use existing, (b) refresh metrics only, or
(c) full re-run based on the two freshness windows. No `.forsvn` directory → skip the warm-start scan
and proceed as a cold start.

Write durable account-scope / platforms / niche hints to `.forsvn/experience/content.md` when that
store exists. Do not persist per-run pasted exports.

## Sequence

1. For each in-scope platform, run `agents/evidence-intake-agent.md` as a sequential pass. Load
   `references/platforms/[platform].md`, `references/evidence-protocol.md`, and
   `references/confidence-labeling.md`. A platform with no evidence still produces a `NO_EVIDENCE`
   record with gaps named — never drop it silently.
2. Run `agents/benchmark-agent.md` once for the platform set (external reference ranges only;
   benchmarks never become owned evidence).
3. Run `agents/synthesis-agent.md` to assemble the artifact body — written to
   `.forsvn/artifacts/mkt/research-channel/[slug].md` when that store exists, assembled inline
   otherwise — per `references/format-conventions.md`. Leave
   TL;DR and Recommendations as placeholders.
4. Run `agents/recommendation-agent.md`. Coverage flag gates recommendations: MEASURED → normal;
   PARTIAL → confidence capped at M, directional; NO_EVIDENCE → recommend nothing.
5. Gate with `agents/critic-agent.md` against `references/scoring-rubrics.md` and
   `references/anti-patterns.md` (five rubrics: evidence citation, source-type honesty, coverage-flag
   accuracy, recommendation completeness, freshness). Max 2 rewrite cycles; then stop for the human —
   record `DONE_WITH_CONCERNS` as the internal grade with failed rubrics pinned; it never ships.

## Critical gates

1. Every metric carries source type + measured_at (or explicit gap).
2. Coverage flags match the evidence actually present.
3. Recommendations attribute platform + evidence source + freshness + confidence.
4. Freshness windows: performance ~30d (warn 60d); algorithm/context ~90d (warn 180d).
5. No fabricated numbers, no credential collection, no live API calls from this skill.

## Deliverable

Return the channel decision package required by the live SKILL.md front door: decision boundary,
owned-evidence readout, public evidence with freshness, focused comparison, recommended channel /
role / format / first test, deferred channels, next evidence, reversal evidence, and revisit trigger.

Method depth lives in `references/channel-evidence-method.md`.

Label this single-context. Do not call it independent corroboration. Do not invent metrics. Publishing,
community contact, private analytics access, and live channel setting changes stay behind explicit
approval.
