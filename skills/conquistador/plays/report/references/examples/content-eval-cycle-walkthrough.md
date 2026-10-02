# Examples — content-eval Cycle Walkthrough (LinkedIn organic, save-rate loop)

> Illustrative walkthrough of Metric Ingest + Diagnosis, Recommendation and Critic. All numbers,
> comments and verdicts below are synthetic. They illustrate engagement-quality discrimination;
> they are not evidence of live execution, provider behavior or human acceptance.

The sequence ends at a reviewed draft. Follow [persistence consent](../format-conventions.md#persistence-consent)
before any file write: show the exact entry and destination and obtain explicit user approval.
No persistence consent is present in this example, so no files are written.

Cross-eval consistency: this walkthrough mirrors `evaluate-ad`'s 4-agent / 7-dim / 8-col shape. The two content-specific dimensions exercised here are **Engagement-Quality Discrimination** and **Platform-Fit**.

---

## 0. Operator invocation + inputs

```
/evaluate-content forsvn-launch-organic linkedin 7d
```

Inputs the operator supplied in conversation (all illustrative):

- **Loop:** `forsvn-launch-organic` — primary metric `save rate`, confidence floor `reach ≥ 1,500` (from `program.md`).
- **Source `social` artifact:** `docs/forsvn/artifacts/marketing/copy/linkedin-2026-06-05-agent-first-capture.md` — a text post promoting FORSVN: *"Your coding agent already did the work. You just can't see it."* Hypothesis: name the reader's exact pain (invisible agent output) in line 1; CTA = soft ("what does your team lose to invisible work?").
- **Window:** 2026-06-05 → 2026-06-12 (7 days).
- **Native LinkedIn analytics (operator-supplied screenshot summary):** reach 4,180; likes 196; saves 131; shares 38; comments 27 (3 are the operator's own replies); click-through 54.
- **Baseline:** cycle-1, same loop, same platform, same content-type (LinkedIn text post) — save rate 1.9%.
- **Secondary platform (context only):** the same copy was cross-posted to X — 11 reposts, 9 bookmarks. Operator flags it for context, not scoring.

---

## 1. Pre-Dispatch — hard-blocks, then resolution

Orchestrator runs the hard-block checks BEFORE Cold Start (`_shared/pre-dispatch-protocol.md`):

- `.forsvn/loops/forsvn-launch-organic/program.md` + `context.md` — **present.** (Else → `NEEDS_CONTEXT`, route to `/run-pipeline`.)
- Content type — **text post.** Not short-form video, not a paid ad. (Else → `NEEDS_CONTEXT`, route to `results` / `evaluate-ad`.)
- Primary-platform tag — **`linkedin`** supplied. Measurement evidence present. (Else → `BLOCKED`.)
- `results.tsv` — standard 8-column schema. Last row is cycle 1 → **this cycle = 2.**

Resolution: all six Cold Start slots filled from the invocation + scan. Dispatch proceeds.

---

## 2. Layer 1 (parallel) — Metric Ingest + Diagnosis

### Metric Ingest agent → Metric Packet

```markdown
## Metric Packet

- primary_platform: linkedin
- content_type: text
- primary_metric: save rate
- current_value: 3.1%  (131 saves / 4,180 reach)
- baseline_value: 1.9%  (cycle-1, linkedin text post)
- measurement_window: 2026-06-05 → 2026-06-12 (7 days)
- reach_or_impressions: 4,180  (above the loop's 1,500 confidence floor)
- engagement_breakdown:
  - likes: 196
  - saves: 131
  - shares: 38
  - comments: 27  (3 are operator self-replies → 24 audience)
- click_through: 54  (1.3% of reach)
- conversions: not defined in program.md
- source: operator-supplied (native LinkedIn analytics screenshot summary, dated 2026-06-12)
- attribution_confidence: medium
- comparability: comparable  (same platform + same content type as baseline)

## Cross-Platform Context (does NOT enter the verdict)

- x : 11 reposts, 9 bookmarks — same copy, context only

## Caveats

- Source is a screenshot summary, not a live export → confidence capped at medium.
- 3 of 27 comments are operator self-replies; audience comment count is 24.

## Blockers

- none
```

### Diagnosis agent (reads the packet + the source `social` hypothesis)

- **Likely Drivers** — save rate +1.2pp over a comparable baseline. The line-1 pain-naming hook ("you just can't see it") is the most plausible driver: saves cluster on posts people want to act on later, and the hypothesis explicitly bet on naming invisible-work pain. Shares (38) reinforce — the post was forwarded, not just liked.
- **Engagement-Quality Signals** — meaningful (saves 131 + shares 38 + comments 24 + click-through 54 = 247) vs vanity (likes 196). Meaningful-to-vanity ≈ 1.26 — the result is engagement-QUALITY-led, not a like spike.
- **Cross-Platform Context** — X bookmarks echo the save behavior directionally, but X is **not** scored this cycle.
- **Confounders** — no algorithm change flagged in the window; follower count flat; posting time consistent with cycle-1; screenshot (not export) is the one real caveat.

---

## 3. Layer 2 — Recommendation agent

Verdict driven by the packet + the quality read, not the diagnosis story:

- **keep** the line-1 pain-naming hook and the text-post format — both rest on meaningful engagement above a comparable baseline.
- **watch** click-through (1.3%) — soft CTA may be under-converting saves into clicks.
- **route next work to** `write-social --rev=3` with one narrow hypothesis: keep the hook, sharpen the CTA from soft-question to a concrete next step.
- Proposes ledger `status: keep`, learning promotion = **no**. Confidence is medium and this is
  one observed cycle against a baseline. Keep the proposed explanation as a working hypothesis.

---

## 4. The proposed eval artifact (full)

Proposed destination, pending exact-content and destination approval:
`.forsvn/loops/forsvn-launch-organic/evals/2026-06-12-cycle-2.md`.

```markdown
---
skill: evaluate-content
version: 1
date: 2026-06-12
status: done
summary: "linkedin cycle 2 content evaluation"
purpose: "Post-publish evidence snapshot for an organic-content eval loop, scoped to one primary platform"
lifecycle: evaluation
use_when: "Deciding whether to keep, discard, watch, or block the current content cycle"
do_not_use_when: "Authoring next-cycle copy without reading the latest loop context and results"
upstream: ".forsvn/loops/forsvn-launch-organic/program.md, context.md, strategy/, execution/, docs/forsvn/artifacts/marketing/copy/linkedin-2026-06-05-agent-first-capture.md, metric source"
downstream: "results.tsv, learnings.md, social next-cycle brief"
provenance:
  skill: evaluate-content
  run_date: 2026-06-12
  input_artifacts:
    - docs/forsvn/artifacts/marketing/copy/linkedin-2026-06-05-agent-first-capture.md
    - brand/BRAND.md
    - research/icp-research.md
  output_eval: null
---

# LinkedIn Cycle 2 Evaluation

## Verdict

- Status: keep
- Confidence: medium
- Primary-Platform: linkedin
- Primary metric: save rate = 3.1% vs 1.9% baseline
- Decision: On linkedin, keep the line-1 pain-naming hook and text-post format — save rate +1.2pp on comparable baseline is meaningful-engagement-led; watch click-through.

## Evidence

| Signal | Current | Baseline | Window | Source | Caveat |
|---|---:|---:|---|---|---|
| save rate (primary) | 3.1% | 1.9% | 2026-06-05→06-12 (7d), reach 4,180 | operator-supplied (native analytics, 2026-06-12) | screenshot, not live export |
| engagement rate | 9.4% | 6.1% | same | operator-supplied | blended — see breakdown below |
| saves | 131 | — | same | operator-supplied | meaningful |
| shares | 38 | — | same | operator-supplied | meaningful |
| comments | 24 | — | same | operator-supplied | 24 audience (3 self-replies excluded) |
| likes | 196 | — | same | operator-supplied | vanity |
| click-through | 54 (1.3%) | — | same | operator-supplied | below save count — CTA watch |
| reach / impressions | 4,180 | — | same | operator-supplied | above 1,500 floor |

## What Changed This Cycle

- Source social artifact: `docs/forsvn/artifacts/marketing/copy/linkedin-2026-06-05-agent-first-capture.md`
- Hook/format/visual/CTA/posting delta from prior cycle: cycle-1 led with a stat ("agents write 60% of our code"); cycle-2 leads by naming the reader's pain ("you just can't see it"). Format, posting time, and soft CTA unchanged.

## Diagnosis

### Likely Drivers

- Line-1 pain-naming hook is the most plausible driver of the save lift — saves cluster on save-for-later intent, which the invisible-work framing directly invites. Shares (38) corroborate forward-ability.

### Engagement-Quality Signals

- meaningful_engagement: saves 131 + shares 38 + comments 24 + click-through 54 = 247 (5.9% of reach)
- vanity_engagement: likes 196 + impressions (within reach 4,180)
- meaningful_to_vanity_ratio: 247 / 196 ≈ 1.26
- quality_read: strong
- qualitative_sentiment: positive — actual top comment: "Saving this — the 'invisible work' framing is exactly our standup problem." (24 audience comments; not inferred)

### Cross-Platform Context

- x: 11 reposts, 9 bookmarks on the cross-posted copy — directionally echoes save behavior — CONTEXT ONLY, not a verdict input

### Confounders

- Screenshot summary, not live export (confidence capped at medium); no algorithm change in window; follower count flat; posting time consistent with cycle-1; no cross-post cannibalization observed (X is a distinct audience).

## Next Cycle Recommendation

- Keep: line-1 pain-naming hook; LinkedIn text-post format.
- Discard: none.
- Watch: click-through (1.3% — soft CTA under-converting saves into clicks).
- Route next work to: social --rev=3 (hook held constant; CTA sharpened soft-question → concrete next step).

## Results Row

```tsv
cycle	date	artifact	primary_metric	value	baseline	status	description
2	2026-06-12	evals/2026-06-12-cycle-2.md	save rate	3.1%	1.9%	keep	linkedin save rate 3.1% over 7d — keep pain-naming hook + text format, watch CTA per low click-through
```

## Learning Promotion

- Promote to `learnings.md`: no
- Lesson: Working hypothesis only. For this LinkedIn text post and audience, the pain-naming hook may explain the higher save rate. Keep this hypothesis in the conversation; it is not a durable rule.
- Expiry / caveat: Medium confidence, one observed cycle against a baseline. Seek comparable exports and repeat evidence; a later cycle number alone does not justify promotion. Recheck if LinkedIn changes its save-count visibility or denominator. Comparable results without the hook would weaken the hypothesis.
```

Brand note: FORSVN copy under evaluation stays on-house — Forest Shadow background, Leaf `#74B36B` as the single accent in any rendered review chrome; never Signal Lime. The eval scores the post's metrics, not its visuals, but the brand floor still applies if the cycle ever references rendered assets.

---

## 5. Proposed results.tsv row

Proposed destination: `.forsvn/loops/forsvn-launch-organic/results.tsv`. The following row has eight
columns in the required order, `cycle date artifact primary_metric value baseline status description`.
It has not been appended. The host must check the current header and cycle for conflicts before
seeking approval for this exact row and destination.

```tsv
2	2026-06-12	evals/2026-06-12-cycle-2.md	save rate	3.1%	1.9%	keep	linkedin save rate 3.1% over 7d — keep pain-naming hook + text format, watch CTA per low click-through
```

`status` ∈ `keep|discard|watch|blocked`; description carries the `linkedin` primary-platform tag (Critic Hard Fail #8 guards its absence).

---

## 6. Layer 3 — Critic verdict (PASS)

```markdown
## Critic Verdict

- verdict: PASS
- score: 58/70
- per_dim:
  - loop_fit: 9 — program.md + context.md + results.tsv read; cycle-2 scoped to linkedin matching program.md; cycle number = last + 1.
  - metric_integrity: 8 — save rate + baseline + window + reach present; engagement 4-way breakdown present; source is a screenshot (not live export) → not a 9.
  - attribution_honesty: 8 — reach above floor; comparability explicit (same platform + type); confounders enumerated; confidence held at medium for the screenshot source.
  - decision_discipline: 9 — verdict matches the packet; routing to social CTA-only revision is correctly narrow, not "redo the content plan".
  - engagement_quality_discrimination: 9 — 4-way breakdown + meaningful-to-vanity ratio (1.26) computed; keep rests on saves+shares+comments+CTR, not likes.
  - platform_fit: 8 — 3.1% save rate read against a LinkedIn-specific benchmark; text-post format assessed as native; X kept in Cross-Platform Context only.
  - ledger_correctness: 7 — one proposed row; 8 columns; status valid; description carries "linkedin"; slightly verbose. No write has occurred.
- required_fixes:
  - none
- concerns:
  - Source is a screenshot summary, so confidence remains medium. No learning promotion. A comparable export alone would not establish a durable rule from one observation or two cycles.
- hard_fails_triggered:
  - none
```

**Domain gate checked:** Engagement-Quality Discrimination = 9 — the keep is explicitly built on the meaningful half of engagement (ratio computed, vanity named), so the "keep on a vanity spike" Hard Fail (#11) does not fire. Cross-platform contamination (#4) avoided — X never entered `current_value`. Aggregate 58 ≥ 49 and every per-dim ≥ 6 → **PASS.**

The critic PASS checks the draft; it grants no write permission. Present the exact eval artifact,
ledger row and their destinations for user approval. Until that approval exists, leave both files
unchanged. If approved later without changes, the host can save the artifact and append the row
once with its file tools. No learning write is eligible here; `learnings.md` remains unchanged.
No bundled append or manifest-sync script is required or available.

**Completion status: DONE_WITH_CONCERNS.** Return the reviewed draft with medium confidence and
the proposed row. Persistence consent is pending. No files were written and no learning was promoted.

---

## 7. FAIL → fix variant (vanity spike refused)

Same loop, hypothetical cycle-3. The operator brings: reach 31,000; likes 2,900; saves 9; shares 2; comments 4; save rate 0.03%. The post caught an algorithm boost. A naive draft claims `keep` ("huge reach, great cycle").

**Critic FAIL:**

```markdown
- verdict: FAIL
- score: 31/70
- per_dim:
  - engagement_quality_discrimination: 2 — keep rests on a likes/impressions spike with collapsed saves (9) + shares (2); meaningful-to-vanity ratio ≈ 0.005.
  - attribution_honesty: 4 — 10× reach jump not flagged as an algorithm-boost confounder.
  - (others ≥ 6)
- hard_fails_triggered:
  - #11 keep verdict resting on a vanity-heavy headline metric
```

On the single revision, Recommendation names the reach spike as a confounder, computes the
meaningful-to-vanity ratio and resets the verdict to **watch**. Learning promotion is **no**;
Hard Fail #9 would reject a lesson based on the vanity spike. The revised draft proposes
`status: watch` and leaves `learnings.md` unchanged. A ledger append still needs exact-row and
destination consent. If the operator contests the result, return a Review Packet override note
for review. Any persistent override note needs exact-entry and destination consent before writing.
An override does not bypass the evidence or learning gates; an unresolved critic FAIL permits no writes.
