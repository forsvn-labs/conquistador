# Paid creation review rubric

Score each dimension from 0 to 10 for each variant. These scores assess artifact
quality, not predicted campaign performance. Use 0 for absent or contradicted,
1-5 for a material defect, 6-7 for usable work with stated limits, and 8-10 for
complete work supported by inspectable evidence. Explain the score with an exact
passage and a concrete correction when needed.

| Dimension | Review question |
|---|---|
| Audience and task | Does the message address the declared eligible user and actual task? |
| Component compliance | Do current supplied placement constraints support every required component? |
| Destination continuity | Do the promise, terms, CTA, and landing behavior agree? |
| Test discrimination | Does the changed component match the hypothesis while controls stay fixed? |
| Evidence and rights | Are claims, depictions, permissions, and disclosures supported? |
| Specificity | Can the reader understand the actual product and offer without generic praise? |
| Creative feasibility | Can the proposed asset show the evidence within rights, accessibility, and production limits? |

Preserve the existing score interface: each variant totals /70. A variant needs
at least 49/70 with every dimension at least 6. Scores 49-55 indicate concerns;
56 or more does not remove unresolved hard blockers. The aggregate is the sum
across hero, variant_a, and variant_b, out of 210. Do not use the score as a budget
allocation formula or a performance benchmark.

Hard blockers include fabricated or overstated proof, incompatible destination
terms, unauthorized use of an actor or asset, a false claim of platform clearance,
and test spend above the authorized ceiling. Missing information must be visible.
Specificity has no count quota for entities, numbers, citations, or claims.

Compare final variants to the test contract and any pre-polish versions. Return
the affected passage, decision impact, and smallest supported repair. No score
can approve a live action or substitute for a human verdict.

## Machine-readable gate

`conquistador_score` checks a self-score against these rules. Score each creative variant (hero,
variant_a, variant_b) separately with the single `default` variant; 49-55 is pass with concerns. The
/210 aggregate is reported, not gated. Report each hard blocker above as a hard fail.

```json conquistador-gate
{
  "scale": { "min": 0, "max": 10 },
  "dimensions": ["Audience and task", "Component compliance", "Destination continuity", "Test discrimination", "Evidence and rights", "Specificity", "Creative feasibility"],
  "variants": {
    "default": { "minEach": 6, "minTotal": 49, "doneAt": 56 }
  },
  "hardFails": ["fabricated-or-overstated-proof", "incompatible-destination-terms", "unauthorized-actor-or-asset", "false-platform-clearance", "spend-above-ceiling"]
}
```
