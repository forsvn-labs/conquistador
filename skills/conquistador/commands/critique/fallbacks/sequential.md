# Sequential fallback

Use when the host cannot run reviewer, specialist lenses, and resolver as separate contexts.

Keep the same method. Change only the machinery. Label the result **single-context review**, not
independent corroboration.

1. Build the clean review packet: exact artifact or actual output, intended outcome, acceptance
   criteria, evidence, constraints, known risks, and release boundary. No implementation rationale
   unless it is itself evidence. Use [`../references/review-target-and-closeout.md`](../references/review-target-and-closeout.md)
   when detecting what to review.
2. Choose depth from the front-door contract:
   - ordinary artifact → generalist pass with [`../agents/reviewer-agent.md`](../agents/reviewer-agent.md);
   - auth, payments, PII, migrations, bulk mutation, or >500-line diff → run the three specialist
     lenses in order from [`../references/specialist-lenses.md`](../references/specialist-lenses.md)
     ([security](../agents/security-reviewer-agent.md),
     [performance](../agents/performance-reviewer-agent.md),
     [correctness](../agents/correctness-reviewer-agent.md)) and merge without majority filtering;
   - high-stakes non-code → baseline reviewer plus
     [`../references/critic-consensus.md`](../references/critic-consensus.md).
3. Triage every finding through [`../references/noise-filter.md`](../references/noise-filter.md)
   (real-vs-fake, then Accepted / Rejected / Deferred). Check
   [`../references/scope-drift.md`](../references/scope-drift.md) when a spec or acceptance set exists.
4. Resolve with [`../agents/resolver-agent.md`](../agents/resolver-agent.md): synthesize, fix Accepted
   items, rerun the relevant checks, max two loops. Do not stack a critic on the reviewer.
5. Write the report from [`../references/report-template.md`](../references/report-template.md).
   Method context: [`../references/independent-review-method.md`](../references/independent-review-method.md)
   and [`../references/anti-patterns.md`](../references/anti-patterns.md).
6. Log repeated misses or overrides per
   [`../references/quality-feedback-protocol.md`](../references/quality-feedback-protocol.md).

Never publish, release, approve spend, delete work, or claim human approval. Prefer
`.forsvn/artifacts/mkt/fresh-eyes-review/` for durable review artifacts when such storage exists;
it is optional and never required. Nothing here requires a private sibling skill or hidden runtime.

Fail-closed stops: artifact, output, or criteria unobtainable → record the limitation, never review
from a summary alone; an untraceable consequential claim → blocking or material finding; verification
needs access you lack → mark the check not performed; irreconcilable dissent or an exceeded resolver
loop → return the unresolved state; every verdict ends at a human decision.
