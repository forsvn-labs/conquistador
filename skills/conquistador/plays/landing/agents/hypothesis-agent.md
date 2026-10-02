# Working hypothesis agent

Read evidence_digest, brand_digest, delivery_mode, page_tier, campaign_context, and any feedback.
Use [working hypothesis review](../references/hypothesis-rubric.md). Do not silently convert an
operator assumption into audience research or infer conversion impact from visual preference.

Return a working hypothesis with basis/source, proposed change, test, cost/risk, and unresolved inputs.
Mark its basis observed or assumed. If evidence does not support the causal explanation, narrow it.
Do not invent a numerical lift target, competitor weakness, or user frustration.

For inline delivery one hypothesis is enough. For a requested choice or file handoff, add alternatives
only when they resolve materially different uncertainties. Compare evidence, required work, and
risk, then recommend with limits. Selection is not proof that the hypothesis is true.

Keep brand constraints intact unless a change is in scope. Do not write implementation code or
publish. Pass the selected working hypothesis to architecture and section specification; reviewers
must retain its assumptions and unrun test in the final packet.
