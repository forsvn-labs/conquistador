---
title: Short-Form Research — Anti-Patterns
lifecycle: canonical
status: stable
produced_by: research-content-ideas
load_class: ANTI-PATTERN
---

# Anti-Patterns

**Load when:** critic agent fires (5-rubric gate) OR re-dispatch heuristic kicks in (critic FAIL routes to named source agent). Re-read before any output leaves the skill; `done_with_concerns` is an internal grade that never ships.

---

| Anti-Pattern | Problem | INSTEAD |
|---|---|---|
| Orphan numerical claims | A number without its inspected record, definition and scope cannot support a production decision. | Cite the exact evidence, denominator and capture window. Mark missing values unobserved and separate proposed targets from collected results. |
| Mixing market scopes | Combining observations from different language and audience contexts hides differences relevant to the brief. | Keep the requested market scope explicit. Separate other-market evidence and avoid inferring preferences from nationality alone. |
| Sample-size dishonesty | Reporting n=4 as "the pattern" without LOW_SAMPLE flag. Downstream brief reads it as a strong bet, lays content on weak evidence. | Declare per-platform: OK (n≥8) / LOW_SAMPLE (n=3-7) / INSUFFICIENT_DATA (n<3). INSUFFICIENT_DATA = no pattern claims, only observed examples. Flag propagates downstream. |
| Stale mechanics passing as fresh | A recent artifact date can hide an unchecked requirement. | Preserve both review timestamps and actual source records. Check applicability to the selected route; do not fabricate source dates or treat review intervals as platform facts. |
| Generic recommendations that lack a decision | An instruction to improve an opening does not identify what to change. | Name the inspected problem, account context, proposed change and outcome. Shared accessibility checks are valid; unsupported ranking rules are not. |
| Running audio-trend-agent outside its supported dispatch scope | Additional work can produce claims without relevant observations. | The current workflow dispatches this agent when TikTok or Reels is in scope. This is a workflow boundary, not evidence that other platforms prefer original audio. |
| Skipping ICP without flagging | Running with cold-start hint but artifact doesn't say so. Downstream brief assumes audience is well-grounded, lays campaign on shaky ground. | Audience Fit section either references ICP or explicitly declares "no ICP — using cold-start hint" with the hint text included. Critic rubric #5. |
| Looping the critic past 2 cycles | Trying for PASS forever when the underlying data is genuinely thin (LOW_SAMPLE everywhere, no doc URLs available). Burns tokens for a result that won't improve. | Hard cap at 2 cycles. After cycle 2, stop for the human; internal grade `done_with_concerns` with failed rubrics pinned at top of artifact. The transparency IS the value. |
| Adding net-new platforms beyond the 5-cap | Adding YouTube Long, Snapchat Spotlight, etc. mid-run because operator asked. Each platform doubles research time + cost. | Hard cap is 5. If operator wants a 6th, refuse and surface the cap. Research depth per platform > breadth across platforms. |
| Re-pulling for the same topic+market inside the freshness window | Wasting cost on a re-run when warm-start would have caught it. | Warm-start scan in Pre-Dispatch is mandatory. If an artifact exists for (topic, market) and `trend_signals_date` is <14d AND `platform_mechanics_date` is <90d, default to mode (a) "use existing." |
| Cross-stack contract drift | Adding new frontmatter fields or body sections without updating `create-shortform` (consumer) + `evaluate-shortform` (cycle scorer). Silent schema drift breaks downstream parsers. | Output Artifact Structure is the cross-stack contract. Schema changes require atomic update of both consumers — never ship a one-sided schema change. Flag to operator before changing. |
| Treating critic rubric as scoring noise | Critic FAIL → ignore and ship anyway. Defeats the entire 5-rubric gate. | Critic FAIL → re-dispatch named source agent with feedback. If FAIL persists past cycle 2, stop for the human; internal grade `done_with_concerns` with failed rubrics pinned. The gate is load-bearing — never silently bypassed. |
| Recommendations that cannot be evaluated | An attention claim without a comparison does not guide a test. | State the viewer task, uncertain decision, change, comparison and observable outcome. Cite supporting observations and preserve their limits. |
| Skipping competitor seeds when offered | Operator provided 5 competitor handles in Cold Start Q5, scout ignores them and pulls top performers from default search. Wastes a high-value signal. | Scout protocol: seed list is the priority cohort. Default search supplements only after seed cohort is exhausted. See `scout-protocol.md`. |
| Confusing observations with requirements | Observed audio use does not establish an upload rule or ranking effect. | Separate inspected behavior from checked technical requirements and proposed tests. Record the evidence date and reason for rechecking each claim. |
