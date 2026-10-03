# Sequential fallback

Use when the host cannot run research, outline, draft, and critic as separate agents.

Keep the same method. Change only the machinery.

1. Resolve topic, target reader (role + awareness), and one ownable thesis. Ask at most one bundled
   question when those are missing. If there is no non-obvious claim to defend, stop and recommend
   `copy` for a how-to.
2. Run [research](../agents/research.md) against [research-method](../references/research-method.md):
   stress-test the thesis, build the evidence ledger, name the consensus baseline, find the
   proprietary angle. Do not draft yet.
3. Run [outline](../agents/outline.md) against [structure-patterns](../references/structure-patterns.md).
   Compress the argument to one spine. Every section cites ledger evidence, passes the necessity
   test, and has a named home for the counter-argument and the proprietary angle.
4. Run [draft](../agents/draft.md). Every factual claim maps to a ledger # or an explicit tag.
   Deliver the proprietary angle in the prose. Open on the thesis and stakes.
5. Run [critic](../agents/critic.md) against [rubric](../references/rubric.md) and
   [anti-patterns](../references/anti-patterns.md). Score Originality first against the named
   consensus baseline. Gate: total ≥36/49, every dim ≥4, Originality ≥5, all four hard gates.
6. On FAIL, re-work the named unit (research, outline, or draft) up to two rewrite cycles. If the
   second rewrite still FAILs, stop for the human with the best draft, critic scorecard, and every
   unresolved failure pinned. Any `done_with_concerns` label is an internal grade only; do not
   route a standing FAIL to finished-piece assembly. Do not pad a consensus piece to make it look
   like a pillar.
7. After critic PASS, assemble the artifact per
   [format conventions](../references/format-conventions.md). A human may explicitly direct
   assembly after a standing-failure stop; otherwise do not fall through to this step. Apply
   [anti-collapse](../references/anti-collapse.md) before return.

Label this single-context. Do not call it independent corroboration. Do not invent statistics,
citations, customers, or consent. Publishing stays behind explicit human approval.

`--fast` lightens research (fewer sources) and skips rewrite loops. It does not skip the thesis
block, research-before-outline, cited-or-marked, or the Originality floor.
