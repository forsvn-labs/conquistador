# Sequential fallback

Use when the host cannot run ICP or market specialists as separate agents.

Keep the same method. Change only the machinery. Load the core first: establish the decision,
inspect supplied product context, and read [`confidence-labeling`](../references/confidence-labeling.md)
when the output needs epistemic labels. Read [`product-context-schema`](../references/product-context-schema.md)
only when a local product-context file needs schema validation or creation.

Stop after the core for **hypothesis mode (offline/local-context)**. It does not need the persona,
VoC, habitat, psychology, competitor, sizing, trend, or market-gap references. Load one of the
conditional lenses below only for validated research or for a specifically missing dimension that
the decision cannot resolve from the supplied context.

Choose the lens from the decision. Run both only when the recommendation needs both audience truth
and market truth. Do not blend the two into one pass.

## Validated ICP lens or missing audience dimension

Use this section only when the audience, persona, customer language, habitat, pain, or decision
psychology is a real missing dimension, or when validated audience research is requested.

1. Anchor product, costly moment, alternatives, and the decision this research must change.
2. Collect voice-of-customer evidence with `agents/voc-collector-agent.md` and
   `references/voice-of-customer.md`. Use `scripts/search-platforms.sh` only as a query helper
   when collection is actually in scope.
3. Build at most two personas with `agents/persona-agent.md`; classify pain with
   `agents/pain-analysis-agent.md`; map named habitats with `agents/habitat-agent.md` and
   `references/habitat-mapping.md`; name decision psychology with
   `agents/decision-psychology-agent.md` only when those dimensions matter.
4. Synthesize with `agents/synthesis-agent.md` into the ICP artifact
   (`references/icp-format-conventions.md`) and gate with `agents/icp-critic-agent.md` plus
   `references/confidence-and-bias.md` only before returning a validated ICP artifact.
   Source floor is five independent sources per persona and 15 verbatim quotes. Below that, label
   hypothesis. No unresolved `L` findings.

## Validated market lens or missing market dimension

Use this section only when market, competitor, pricing, sizing, trend, or whitespace evidence is a
real missing dimension, or when validated market research is requested.

1. Scope the category and why-now.
2. In parallel-as-passes, load only the needed specialists: `agents/trends-agent.md`,
   `agents/sizing-agent.md` when the decision needs TAM/SAM/SOM, `agents/competitor-agent.md`
   when alternatives or adjacency matter, and `agents/consumer-landscape-agent.md` when audience
   behavior outside supplied context matters.
3. Pause for coverage gaps, operator-internal knowledge, and adjacency calibration.
4. Load `agents/cross-analysis-agent.md` then `agents/opportunity-agent.md` only when the decision
   needs whitespace or opportunity ranking.
5. Gate with `agents/market-critic-agent.md` for a validated market artifact. Every claim needs a
   source. Sources older than 18 months are historical, not current. Sizing without method is a
   guess.

Then make the seven positioning decisions from the front-door SKILL.md. For a validated ICP
artifact, load `references/icp-anti-patterns.md` before returning it. For a validated market
artifact, load `references/market-anti-patterns.md` before returning it. Hypothesis mode loads
neither anti-pattern reference.

Label this single-context. Do not call it independent corroboration. Do not invent quotes, market
size, competitor claims, or consent. External writes stay behind explicit human approval.
