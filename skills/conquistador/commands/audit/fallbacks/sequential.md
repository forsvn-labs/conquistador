# Sequential fallback

Use when the host cannot run audit, polish, fixer dispatch, and re-verify as separate steps or
agents.

Keep the same method. Change only the machinery.

## Audit (detect only)

1. Freeze scope from `COMMAND.md`: exact artifacts, audience, channel, claims, missing context.
2. Detect findings with the seven dimensions in `COMMAND.md`, judged **in context** (no word or
   cadence is defective merely because an AI system often uses it). If the host happens to ship a
   deterministic scanner, its output is a *candidate-findings aid only* — every scanner finding
   still passes Layer-1 contextual review in `references/noise-filter.md` before it reaches the
   report, and the human-language verdict never comes from the scanner. Name dimension + location;
   do not invent registry ids.
3. Triage with `references/noise-filter.md` (Layer-1 FP guards, then Accepted / Rejected / Deferred).
4. Apply the noise gate: ≥5 findings and 0 blocking → collapse minors to one Rejected line.
5. Write the report with `references/report-template.md` to the host's durable artifacts directory
   (for example `.forsvn/artifacts/mkt/audit-marketing/`); return inline if none exists. Stop. Do
   not edit the audited package.

## Polish (optional, still human-owned)

Only when the operator asks for proposed fixes:

1. Run the audit sequence above.
2. Route Accepted findings with `references/fix-routing.md`. Route to whatever fixer the operator
   actually has: Vietnamese register → the public `vietnamese`; claim/proof/hook/CTA →
   `copy`; anything else → the operator's named tool, or no fixer at all. When no qualified
   fixer exists, findings stay Deferred with proposed corrections — they are not forced through an
   unqualified pass.
3. Apply fixes per `references/polish-flow.md`. Land `decision_state: pending` — never `approved`.
4. Gate with `references/reverify-gate.md` and the regression check in
   `references/quality-feedback-protocol.md`. Max two rounds. Any doubt → roll back and Defer.
5. Log critic overrides at `.forsvn/artifacts/mkt/audit-marketing/critic-overrides.md`
   (or the host's equivalent) when overrides occur.

Label this single-context. Do not call it independent corroboration. Do not invent claims, quotes,
metrics, or consent. The audit verdict ("ready / not ready for human release review") is evidence
for a human decision — publishing, release, delete, and external actions stay behind explicit human
approval.
