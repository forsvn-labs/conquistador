# Conversion diagnosis workflow

Use `diagnostic-evidence-method.md` to distinguish a conversion observation from its possible
causes. The output is a defensible diagnosis and the inputs for the requested Change/Test revision.
It need not identify a cause when evidence cannot distinguish alternatives.

Reuse supplied metric, audience, current/comparison values, timeline and previous attempts. Ask
only for material missing inputs. A target is not a measured baseline. For prelaunch-test, causal
verdict and current/target requirements are not applicable; return labeled assumptions and the
instrumentation needed before activation.

## Roles and sequence

1. Conversion tree builder records the metric calculation and candidate explanation map.
2. External check reviews supplied evidence about relevant outside changes, independently of
   internal candidates when the host supports separate contexts.
3. Hypothesis agent states each candidate's observable prediction, mechanism, competing causes,
   overlap and disconfirming pattern. It chooses the next checks by decision value and feasibility.
4. Data mapper names the deciding evidence set, source/fields, owner, availability and criteria.
5. Verdict agent evaluates supplied evidence and separates arithmetic from causal attribution.
6. Critic checks evidence, overlap accounting, unknowns and downstream usability. Failed findings
   return to their named owner. Maximum two rewrite cycles; unresolved failure stays explicit.

Sequential fallback runs the same roles in one context and says so. Do not call it independent
corroboration. External review does not require a new live search; absent evidence stays unknown.
Do not classify a cause Ruled Out merely because no report was supplied.

## Handoff and stopping

The diagnosis artifact keeps Problem Definition, Hypotheses, Root Cause Verdict and Next Step.
Use conversion-diagnosis-format-conventions.md for fields and status tokens. Existing artifact
storage is optional; inline delivery carries the same information. Critic acceptance is internal
review, never experiment activation or publication authority.

Proceed to the requested revision when its assumptions and risks can be stated honestly. If
missing data changes which intervention is appropriate, return the deciding-data request and a
bounded candidate revision rather than a confident causal claim. Prioritization receives only
supported causes plus explicit uncertainty, not forced gap shares. Measurement setup, market
research and technical bug repair remain separate handoffs when they are the actual missing work.
