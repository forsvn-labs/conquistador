# Sequential fallback

Use when the host cannot run metric-ingest, diagnosis, recommendation, and critic as
separate agents.

Keep the same method. Change only the machinery.

Label this single-context. Do not call it independent corroboration.

## Hard blocks (before any scoring)

- Draft, not sent, or no reply/bounce data → NEEDS_CONTEXT; route to `write-outreach`. Do not score copy as a completed cycle.
- No reply evidence for the cycle → BLOCKED. List what is missing. Unknown stays unknown, never zero.
- No deliverability/compliance evidence (bounce, spam complaints, opt-out status) → BLOCKED. A reply-winning sequence that burns the domain cannot `keep`.
- Channel + segment tag missing → BLOCKED. One channel + one segment per cycle. Secondary channels are context only.
- Organic post → `measure-growth`. Paid ad → `evaluate-paid-campaign`.
- `--fast` still enforces these blocks. It only skips the critic revision cycle and learning promotion.

A loop (`program.md` / `context.md`) is optional. When present, write into
`.forsvn/loops/[slug]/evals/`. When absent, write
`.forsvn/artifacts/mkt/evaluate-outreach/[channel]-[segment]-[YYYY-MM-DD].md` when that store exists —
otherwise return the evaluation inline and skip persistence.
Do not scaffold a loop. The standalone contract ingests operator-supplied exports, screenshots, and
pasted numbers; it never reads private runtime state as a requirement, and it never substitutes
estimates for missing evidence.

## Sequence

1. Record channel, segment, selection rule, batch size, send dates, delivery evidence, reply classifications, downstream outcomes, opt-outs/complaints, and instrumentation changes.
2. Run [metric-ingest](../agents/metric-ingest-agent.md). Categorize replies: qualified / positive-unqualified / objection / referral / explicit no or opt-out / automated or ambiguous.
3. Run [diagnosis](../agents/diagnosis-agent.md) against the source write-outreach artifact when available. Separate selection, delivery, message, offer, timing, and follow-up. Name confounders.
4. Run [recommendation](../agents/recommendation-agent.md). Apply the deliverability/compliance gate before any `keep`. Next route is `write-outreach`, `research-positioning`, or none.
5. Run [critic](../agents/critic-agent.md) against [rubric](../references/rubric.md) and [evaluation-loop-rubric](../references/evaluation-loop-rubric.md). Pass ≥49/70 and every dim ≥6. FAIL → revise once; still FAIL → BLOCKED, no ledger row.
6. Operator override of a critic FAIL never promotes `keep` and never relaxes the deliverability/compliance gate. Record the override in the artifact Status section.

Do not send, schedule, suppress, or alter a list. Evaluation recommends; humans authorize.
