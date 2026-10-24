---
title: Post-launch landing evaluation
lifecycle: canonical
status: stable
produced_by: convert
load_class: PLAYBOOK
---

# Post-launch landing evaluation

This is the post-launch lens of `convert`. It turns a launched page's measurements into a cycle
verdict: keep, discard, watch, or blocked. It runs inside an existing evaluation loop. When the
user also wants the page fixed, continue into the conversion diagnosis lens and draft the revision
with [page conversion craft](page-conversion-craft.md); do not mix the two verdicts.

## Gates

1. **An evaluation loop exists.** The loop names its primary metric, guardrails, baseline, and prior
   cycles (`program.md`, `context.md`, `results.tsv`, or the operator's equivalent). Without it,
   return NEEDS_CONTEXT and say which file is missing. This lens does not create loops.
2. **Measurement evidence exists.** At least the primary metric's current value, source, and window.
   Without it, return BLOCKED. A heuristic reading of the page is useful in the diagnosis lens; it
   is not a cycle verdict.
3. **One primary metric decides.** Secondary metrics and qualitative evidence explain; a guardrail
   defined in the loop can turn a keep into a discard.
4. **No fabricated analytics.** Unknown stays unknown. Operator notes count only when labeled with
   their date, window, and source.
5. **Confidence is explicit:** high, medium, low, or blocked, with sample or traffic volume,
   baseline comparability, and confounders.
6. **Evaluation is not redesign.** The verdict routes the next change; the change itself is drafted
   in the diagnosis lens or by `copy`, `creative`, or `campaign`.

## Roles

- **Metric ingest** normalizes the primary metric, baseline, sample, window, guardrails, and source
  caveats. Missing values are unknown, never zero.
- **Diagnosis** connects the observed result to the page hypothesis, the change made this cycle,
  traffic context, and behavior evidence such as recordings and form analytics.
- **Recommendation** chooses the status and the next route, and drafts one ledger row.
- **Critic** applies the [landing critic rubric](../agents/landing-critic-agent.md) and the
  [compact review](landing-eval-rubric.md). On FAIL, revise once; if it still fails, write no ledger
  row and return BLOCKED with the missing evidence.

## Outputs

The cycle artifact follows [landing format conventions](landing-format-conventions.md): verdict,
evidence table (signal, current, baseline, window, source, caveat), what changed, diagnosis, next
cycle recommendation, results row, and learning promotion. Write a lesson to `learnings.md` only for
a high-confidence keep or discard that applies beyond this page state. Return everything inline when
the host has no artifact store.

Check the result against [landing anti-patterns](landing-anti-patterns.md) and
[anti-sycophancy](anti-sycophancy.md). Changing the live page, starting a new test, or publishing
needs the owner's approval.
