# Hypothesis record

Use a hypothesis to identify evidence that could change a decision. This local reference follows
`diagnostic-evidence-method.md`; it is not a shared named framework or a required sentence formula.

Record the candidate cause or proposed action, scope/population, observable prediction, mechanism
and credible alternative explanation. Describe what would contradict the prediction and what
would remain ambiguous. A mechanism can be unknown; do not invent one to complete a clause.

The legacy If / Then / Because labels may hold premise / prediction / proposed explanation when
useful to existing artifacts. The literal words are not a quality gate. A falsifiable observation
can exist before its mechanism is understood. Evidence that matches a prediction does not by
itself confirm the proposed mechanism.

For diagnosis, compare the candidate with other explanations of supplied observations. For a
proposed intervention, state the change, target event/denominator, baseline or pending baseline,
comparison, observation window, guardrail and stop condition. Do not invent effect-size forecasts.

Keep Deciding data, Source, Owner, Confirming, Rejecting and Potential gap explained fields for
handoffs. Unknown values need an explicit reason and resolution step. Potential gap can be units,
a supported bound or unknown; it is not a required guessed percentage. Add overlap/dependency
notes so the verdict owner knows which contributions cannot be summed.

Synthetic example: after a form release, recorded completions fall. Candidate A is a client event
failure; candidate B is a real server-side failure. Compare aligned client events with independent
server acceptance receipts by request id and release window. Shared instrumentation would leave
that comparison inconclusive. A form-error display change is a proposed intervention only until
an authorized test supplies outcomes. No test or user observation occurred in this example.
