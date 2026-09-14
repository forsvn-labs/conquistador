---
name: evaluate-outreach
description: "Evaluate an actually sent outreach batch or sequence using delivery, reply quality, compliance, and segment-level evidence. Use after cold email, founder outreach, partnership outreach, or DMs have results. Not for writing the sequence or authorizing another send."
metadata:
  version: 1.0.0

---

# Evaluate outreach results

Diagnose one channel, audience segment, and bounded send cycle from observed evidence. Raw reply rate
alone is not success.

## Establish the evidence boundary

Record channel, segment, selection rule, batch size, message or step, send dates, delivery evidence,
reply classifications, downstream outcomes, opt-outs or complaints, and any known instrumentation
change. Missing evidence stays missing—not zero.

If messages were not sent or results are unavailable, return the exact result schema and observation
window needed for evaluation. Do not score draft copy as a completed outreach cycle.

## Normalize the response path

Keep segments, channels, and sequence steps separate. For each cell, report counts and denominators
for attempted, delivered, bounced, replied, positive, qualified, meeting or next-step, opt-out, and
complaint outcomes where available.

Classify replies by meaning:

- qualified interest or useful next step;
- positive but unqualified;
- objection or timing signal;
- referral to another person;
- explicit no or opt-out;
- automated, irrelevant, or ambiguous.

## Diagnose

Separate observable selection, delivery, message, offer, timing, and follow-up signals. State the
evidence for each diagnosis, plausible alternatives, and confidence. Check whether one weak domain,
mailbox, list source, geography, persona, or sequence step is distorting the aggregate.

Review compliance and trust explicitly: truthful identity and affiliation, lawful sourcing,
suppression and opt-out handling, frequency, and whether the message implies familiarity that does
not exist. A response lift does not excuse a trust or compliance regression.

## Recommend the next batch

Return:

1. evidence boundary and data-quality warnings;
2. delivery and reply-quality table by segment and step;
3. first evidenced break and alternative explanations;
4. keep, change, pause, and stop decisions;
5. one bounded next batch with one intentional change, guardrails, and a decision rule.

State what would disconfirm the diagnosis. Do not infer that a planned follow-up was sent, and never
send, schedule, suppress, or alter a list without explicit human authority.

Before delivery, load the recovered method instead of paraphrasing it:

- [metric-ingest](agents/metric-ingest-agent.md), [diagnosis](agents/diagnosis-agent.md),
  [recommendation](agents/recommendation-agent.md), [critic](agents/critic-agent.md);
- [rubric](references/rubric.md), [evaluation-loop rubric](references/evaluation-loop-rubric.md),
  [anti-patterns](references/anti-patterns.md).

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
A loop is optional: write into `.forsvn/loops/[slug]/evals/` when present, otherwise
`.forsvn/artifacts/mkt/evaluate-outreach/` — and when neither store exists, return the evaluation
inline. This skill runs standalone: it ingests operator-supplied exports, screenshots, and pasted
numbers instead of reading private runtime state as a requirement. Sequence authorship stays on
`write-outreach`. Signal separation holds either way: opens alone support no success claim, and no
new send is ever authorized by this evaluation.
