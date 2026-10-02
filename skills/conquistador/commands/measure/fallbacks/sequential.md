# Sequential fallback

Use when the host cannot run metric ingest, diagnosis, pack feedback, recommendation, and critic
as separate agents.

Keep the same method. Change only the machinery.

Choose the mode from the front-door COMMAND.md: design (instrumentation before results) or readout
(results against the original decision rule). Then choose the lens: one channel, or a whole
campaign. Do not blend them.

## Measurement-design lens

When no observations exist, load `references/measurement-design-contract.md` and return the decision,
signal definitions, event/property contract, guardrails, pending baseline/sample/window/threshold
decisions, QA, and activation gate. Do not run result-ingest, diagnosis, pack-feedback,
recommendation, or readout critic agents.

## Channel measurement lens

1. Normalize one channel's numbers with `agents/measure-metric-ingest-agent.md`. Never invent a
   metric. Missing is `n/a`.
2. Attribute with `agents/measure-diagnosis-agent.md`. If an operator-supplied channel pack exists,
   use its observable measures and bounded test, without treating the pack as attribution evidence. If none, use the Absent shape in
   `references/legibility-convention.md` and say the read is not channel-tailored.
3. Draft the append-only write-back with `agents/pack-feedback-agent.md`. Do not overwrite tactics.
   Skip hosted POSTs; the local artifact is the source of truth.
4. Gate with `agents/measure-critic-agent.md` and `references/measure-rubric.md`. Pass needs ≥35/50
   and no dimension at 0. A read that could have been written without the numbers is a FAIL.
   Load `references/anti-sycophancy.md`.

## Campaign evaluation lens

1. Normalize campaign metrics with `agents/campaign-metric-ingest-agent.md`. Keep blended CAC and
   paid CAC distinct. Complete the per-channel rollup.
2. Diagnose with `agents/campaign-diagnosis-agent.md` against the original plan hypothesis. Name
   driver, mixed, and rider channels. Exclude rider conversions from campaign-driven net-new.
3. Recommend keep / discard / watch / blocked with `agents/campaign-recommendation-agent.md`.
4. Gate with `agents/campaign-critic-agent.md`, `references/campaign-rubric.md`, and
   `references/evaluation-loop-rubric.md`. Rider-channel contamination and blended-CAC laundering
   are hard fails.
5. Append one ledger row on the measurement artifact. Promote a learning only when the critic
   allows it. Do not run TypeScript helpers.

In design mode, stop after the decision system, instrumentation, and thresholds exist. Do not
retrofit success criteria during readout.

Label this single-context. Do not call it independent corroboration. Do not invent analytics or
treat missing observations as zero. Tracking changes, experiment activation, and external writes
stay behind explicit human approval. Nothing here requires `.forsvn` storage, a private sibling
skill, or a hidden runtime.

Fail-closed stops: no baseline, decision rule, or denominator → inconclusive or design mode; a
causal claim competing explanations can explain as well → state uncertainty and propose the
discriminating test; no analytics access → `n/a`, never simulated numbers; critic FAIL after the
bounded rewrite cycle → return the failure honestly; keep / drop / test stays advisory until the
decision owner decides.
