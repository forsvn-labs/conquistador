# Paid evaluation artifact contract

When `.forsvn/loops/[slug]/` exists, write `evals/YYYY-MM-DD-cycle-N.md`, then append
one row to results.tsv. Otherwise return both inline. Never create a duplicate
cycle or overwrite an existing result without explicit correction history.

Use ISO dates and the next unused cycle number. Preserve frontmatter keys skill,
version, date, status, summary, purpose, lifecycle, use_when, do_not_use_when,
upstream, downstream, and provenance. Set skill to evaluate-paid-campaign and
lifecycle to evaluation. provenance includes skill, run_date, input_artifacts,
and output_eval. List actual inputs only; missing brand or research files must
not appear as consumed sources. Artifact status is done, done_with_concerns,
blocked, or needs_context; it is distinct from the recommended action.

## Body

Include Verdict, Evidence, What Changed This Cycle, Diagnosis, Next Cycle
Recommendation, Results Row, and Learning Promotion beneath the title.
Verdict states action, confidence with reason, cell scope, primary outcome, and
reversal condition. Evidence uses these six columns:

| Signal | Current | Baseline | Window | Source | Caveat |
|---|---|---|---|---|---|

Include denominators and units in the values or attached normalized packet.
Diagnosis separates likely drivers, confounders, fatigue signals, and audience
match. frequency_threshold must be an account-specific declared trigger or null;
there is no fallback number. Unknown fatigue remains unknown. Name the exact
component and controls for a proposed refresh.

## Ledger compatibility

Preserve these eight tab-separated columns:

```tsv
cycle	date	artifact	primary_metric	value	baseline	status	description
```

Encode a supported keep as keep, a supported stop or rejected tested change as
discard, and a provisional result or proposed revision as watch. Use blocked when
missing or invalid evidence prevents a decision. An operational pause can use
blocked when evidence is invalid, watch while awaiting mature evidence, or discard
when an agreed terminal loss rule closes the test. In every case description must
state the precise keep/revise/pause/stop recommendation and its audience/network
scope. Do not silently equate an encoding with an approved account action.

Reject tabs or newlines inside cells. Retain missing as an explicit value; never
coerce it to zero. Validate the row against the artifact before append. Record the
artifact first, append once, then update learnings.md only for a critic-reviewed
lesson with evidence, reusable scope, uncertainty, and expiry. If an append fails,
report it and check for an existing identical row before retrying. Do not duplicate
results or claim persistence when returning inline.
