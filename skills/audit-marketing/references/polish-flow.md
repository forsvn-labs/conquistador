---
title: Audit-Marketing — POLISH flow
lifecycle: canonical
status: stable
produced_by: audit-marketing
load_class: PROCEDURE
---

# POLISH flow — audit → fix → re-verify, human-owned, max 2 rounds

Runs only when the operator asks for proposed fixes. Runs AUDIT, then for each Accepted finding
dispatches an available fixer and passes a conservative re-verify gate. **Lands every edit as
`decision_state: pending` — never approved.** There is no agent-side accept tool; the human approves
in their own review step. When no qualified fixer exists for a finding (no `polish-vietnamese` for
VN register, no operator-named tool for voice/slop work), the finding stays Deferred with a proposed
correction — it is never routed to an unqualified pass.

## Steps

1. **Run AUDIT** ([`audit-flow.md`](audit-flow.md) steps 1–5) to get the triaged **Accepted** findings. Zero Accepted → nothing to fix; write the report, Completion DONE.

2. **Extract `protected_tokens`** from the artifact, deterministically (no LLM — reuse the same regex shapes the scanner uses): `{ numbers: [...], urls: [...], entities: [...], ctas: [...] }` — every number/percentage/price/date, every URL, every brand/proper-noun entity (BRAND.md tokens), every CTA verb-phrase in a button/CTA slot. This is the contract the re-verify gate enforces survives the fix.

3. **Route each Accepted finding to its fixer** via [`fix-routing.md`](fix-routing.md), restricted to fixers that actually exist in this install. **Group findings by fixer** so each fixer runs ONCE over the artifact (not once per finding). Cross-artifact / structural-only findings route to a `human-review` note, never a fixer.

4. **Snapshot the artifact** (for section-scoped rollback). **Dispatch each fixer** via the Skill tool (Route C — embedded, caller-driven), passing `protected_tokens`. Each fixer emits its Change Log `{ Location, Original, Change, Rule }`. The fixers already support Route C + protected tokens — reuse verbatim; add no fix code here.

5. **RE-VERIFY GATE** ([`reverify-gate.md`](reverify-gate.md)) — for the fixer's output:
   - **(a) findings delta:** re-run detection (contextual seven-dimension judgment, plus any host-supplied scanner as a counting aid) → the severity-weighted score (`3·blocking + 2·material + 1·minor`) is **strictly lower** AND the original finding is gone on re-read AND **no NEW finding** appeared (the fixer-introduces-a-new-tell guard).
   - **(b) Post-fix Regression Check** ([`quality-feedback-protocol.md`](quality-feedback-protocol.md) — the 5 checks): entities/URLs/numbers/prices/dates/claims/citations unchanged; specificity not dropped; CTA + format unchanged; mandatory caveats preserved; `protected_tokens` ⊆ post-fix tokens.
   - **(c) original critic gate** (if the artifact had one) still passes.
   - **PASS all → `accepted_fixed`.** **FAIL any → roll back THAT SECTION** (not the whole artifact — don't discard good fixes in the same round) and re-state the finding **`accepted_deferred` ("Attempted, Rolled Back")**.

6. **Loop (max 2 rounds).** Round 2 = re-run AUDIT fresh on the round-1 output; attempt only newly-Accepted findings NOT already rolled back, plus any fixer-introduced finding. After round 2 STOP: remaining Accepted → Deferred, **Completion DONE_WITH_CONCERNS** + an operator flag ("won't clean in 2 rounds — possible structural issue the fixers can't solve: no spine / no proof"). Never a 3rd round.

7. **Land + report.** Write the artifact with `decision_state: pending` (NEVER approved). Write the report with `score_before` / `score_after` / `rounds` in the **frontmatter** (not `verdicts.tsv`). The human approves in their own review step; any local verdict ledger is written there, never by this skill.

## Completion

- **DONE** — all Accepted findings `accepted_fixed` + verified.
- **DONE_WITH_CONCERNS** — some rolled back to Deferred, or the 2-round cap was hit.
- **BLOCKED** — a denylist finding (`mkt-claim-fabricated-precision` / locked-brand-token analog) is unresolved after 2 rounds. The other eight `block`-severity rules do NOT escalate to BLOCKED.
