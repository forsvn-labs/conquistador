# Sequential fallback

Use when the host cannot run brief-phase and production-phase agents as separate agents.

Keep the same method. Change only the machinery. Brief and produce stay distinct phases —
do not blend them into one mushy pass.

## Phase A — Brief / composition

1. Soft-load current platform or trend evidence when it matters. Prefer a
   operator-supplied content catalog; if missing, proceed with a visible evidence-gap flag and the matching
   platform pack by exact file from the
   [pack contract](../../measure/references/platform-intelligence/CONTRACT.md) (e.g.
   [tiktok](../../campaign/references/platform-intelligence/tiktok.md)). Do not invent VoC.
2. Lock `brand_mode` to `founder` or `company` (no hybrid). Soft default: 1 hero + up to 2
   true-recut variants.
3. Run Layer 1 in order: [format](../agents/format-agent.md) →
   [voc-extraction](../agents/voc-extraction-agent.md) →
   [production-mode](../agents/production-mode-agent.md). Load
   [production-modes](../references/production-modes.md) and the matching platform pack.
4. Run Layer 1.5 craft: [hook](../agents/hook-agent.md) (3 alternatives, promise and evidence checked using
   [hook-archetypes](../../results/references/modes/video/references/hook-archetypes.md)) →
   [storyboard](../agents/storyboard-agent.md) against
   [storyboard-grammar](../references/storyboard-grammar.md) →
   [audio](../agents/audio-agent.md) →
   [copy-pack](../agents/copy-pack-agent.md) against
   [caption-cta-rules](../references/caption-cta-rules.md).
5. If ≥2 platforms: run [platform-tailor](../agents/platform-tailor-agent.md) for true recuts
   (assess opening, audio, caption, CTA and format; explain retained and changed choices). A crop or renamed export without that assessment is incomplete.
6. Gate with [critic](../agents/critic-agent.md) against
   [anti-patterns](../references/anti-patterns.md) and
   [format-conventions](../references/format-conventions.md). Four binary sub-critics
   (hook / production / algorithm-fit / brand-fit) must PASS. Max two rewrite cycles; a standing
   FAIL stops for the human — deliver the best draft with critic concerns pinned for a human
   decision, never as a completed ship. Apply [legibility](../../campaign/references/legibility-convention.md) and
   [why this works](../references/why-this-works-convention.md).
7. Optional terminal polish per [polish-chain](../references/polish-chain.md): for Vietnamese copy,
   the public `vietnamese` skill when installed; otherwise none. Only after an internal gate
   PASS or an accepted-with-concerns grade. Skipping polish is normal, not a defect.

## Phase B — Produce / export bundle

8. Detect mode from the brief (`video` shortform vs app-preview handoff). Load
   [video-brief-schema](../references/video-brief-schema.md),
   [produce-inputs-and-outputs](../references/produce-inputs-and-outputs.md), and
   [production-pattern](../references/production-pattern.md).
9. Run [prompt-author](../agents/prompt-author-agent.md): assemble manifest + per-shot prompts +
   runtime scaffolds + post stage; recommend a lane from
   [production-lanes](../references/production-lanes.md) and
   [render-engines](../references/render-engines.md). Do not invoke render engines or publish.
10. Gate with [produce-critic](../agents/produce-critic-agent.md) against
    [produce-anti-patterns](../references/produce-anti-patterns.md),
    [produce-format-conventions](../references/produce-format-conventions.md), and
    [produce-quality-gate](../references/produce-quality-gate.md). Faithfulness to the brief —
    not a re-score of brief quality.
11. Emit still/poster + reduced-motion fallback with the claim, proof, captions, and action intact.

Label this single-context. Do not call it independent corroboration. Do not fabricate VoC,
metrics, product UI, logos, or consent. A critic PASS (brief or produce) is an internal quality
gate, not completion and not acceptance: rendering, verification against real output, posting, paid
amplification, and live renders stay behind explicit human approval.

`--fast` collapses Layer 1.5 into one craft pass but keeps Critical Gates and both critics.
`--deep` allows a second brief rewrite cycle. Post-launch interpretation is a later task and is not a
dependency for completing this package.

Load [shortform-brief-method](../references/shortform-brief-method.md) when teaching the brief
phase.

Return everything inline when the host has no artifact store. Missing brand artifacts, research
catalogs, product capture, or render engines must become labeled assumptions or unverified cells,
never fabricated values and never a reason to require a sibling package.
