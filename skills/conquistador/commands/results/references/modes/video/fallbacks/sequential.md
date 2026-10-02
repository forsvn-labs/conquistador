# Sequential fallback

Use when the host cannot run hook-strength, eval-runner, pattern-extractor, and critic as separate
agents.

Keep the same method. Change only the machinery.

1. Bound the evidence: platform, post or render URL, original brief path, matching platform pack by
   exact file from the
   [pack contract](../references/platform-intelligence/CONTRACT.md) (e.g.
   [linkedin](../../../../../measure/references/platform-intelligence/linkedin.md)), observation window, and
   known confounders. Missing brief or missing pack → BLOCKED, not vibes scoring.
2. Honor cycle weighting: cycle 1 is 70% observation / 30% scoring. Later cycles balance. Rubric in
   [rubric](../references/rubric.md) stays provisional until real variance forces a dated revision.
3. Run [hook-strength](../agents/hook-strength-agent.md): compare the observed opening and payoff to the brief using [hook-archetypes](../../../../../video/references/hook-archetypes.md).
4. Run [eval-runner](../agents/eval-runner-agent.md): score the four primary dimensions plus
   author-discretion with falsifiable one-sentence justifications. Do not invent metrics.
5. Run [pattern-extractor](../agents/pattern-extractor-agent.md): one atomic pattern-log entry in
   claim / evidence / refutability / expiry shape per
   [format conventions](../references/format-conventions.md).
6. Gate with [critic](../agents/critic-agent.md) and [anti-patterns](../references/anti-patterns.md).
   All four binary PASS required. Max two rewrite cycles; a standing failure stops for the human —
   it is never shipped as a completed evaluation. A passing critic is an internal quality gate, not
   a human verdict on the video.
7. Append the cycle row to the local `results.tsv` beside the artifact and update the local artifact
   index (by hand, or with helper scripts if the host ships them).

Label this single-context. Do not call it independent corroboration. Do not fabricate engagement
numbers. Publishing, live edits, and release approval stay behind explicit human review.

`--fast` collapses to a single-pass eval-runner with hook-strength and pattern-extractor folded into
the same notes, but Critical Gates still apply. Load
[shortform eval method](../references/shortform-eval-method.md) when teaching the skill or deciding
whether to run it.
