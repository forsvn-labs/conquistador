---
title: Audit-Marketing — AUDIT flow
lifecycle: canonical
status: stable
produced_by: audit
load_class: PROCEDURE
---

# AUDIT flow — one-shot, detect-only, NEVER fixes

Produces a severity-grouped pre-ship audit report ending in a **ready / not ready for human release
review** verdict. Side-effect-free except writing the report artifact. **It never edits the audited
artifact.**

## Steps

1. **Resolve target.** A named artifact path, or — empty arg — the whole operator-supplied package (or `.forsvn/artifacts/**/*.md` when scanning a tree). `scan.ts` accepts a file, a directory, or a glob.

2. **Detect findings.** The primary detector is contextual judgment: apply the seven dimensions in
   `COMMAND.md` to each unit **in context** — no word or cadence is defective merely because an AI
   system often uses it. Rank each finding `block / warn / nit` (mapped to blocking / material /
   minor on the front door). Name the dimension + location; do not invent registry rule ids.

   If the host ships a deterministic scanner, its output may seed candidates, but it is an **aid,
   never the verdict**: every scanner finding passes Layer-1 contextual review in
   [`noise-filter.md`](noise-filter.md) before reaching the report, FP-guard exemptions always
   apply, and the "reads like AI" style verdict of any tool is discarded — this flow's only verdict
   is *ready / not ready for human release review*. Parse a present scanner's JSON envelope as
   candidate findings (`{ schema, register, results: [...], totals, ok }`, each finding carrying
   `antipattern`, `name`, `severity`, `line`, `snippet`, `evidence`, `fixSkill`) with the same
   discipline: measured evidence required, context decides.

3. **Dedupe** (only when the S6 critic ran): the scanner result is canonical. Drop any critic candidate whose `(antipattern, file, line ±2)` already fired, OR whose family already has a deterministic finding on the same structural unit (hook / CTA / section) — the taxonomy's "gated to fire only when the deterministic rules did NOT already flag."

4. **Triage** via [`noise-filter.md`](noise-filter.md): Layer-1 real-vs-fake (drop FP-guard exemptions — see below), then Layer-2 Accepted | Rejected | Deferred. For a pure `audit`, "Accepted" = the real findings (none are fix-attempted); cross-artifact findings with no paired artifact in scope → **Deferred** (human-review note), never a confident finding.

5. **Noise gate.** ≥5 findings and 0 `block` → collapse the nits to a single Rejected line and re-state the verdict (a wall of nits with no substantive finding is itself an audit failure).

6. **Emit the report** ([`report-template.md`](report-template.md)). Lead with the honest **`Ready for human release review? — YES | NO`** verdict + the single loudest named finding. Group findings **blocking → material → minor**. Each finding: severity · dimension or rule id · section/line · the evidence snippet · suggested fixer (if one exists). An unsupported-claim finding renders in the blocking group under a **⛔ Finalize blocked** banner. End with the directive footer: imperative ("Handle the blocking findings before this goes to release review") + the judgment clause (a finding is not automatically a defect — quotes / legal / intentional bad-examples / user-confirmed choices can be valid) + the note that fixes run only if the operator asks for the POLISH flow.

7. **Write the report** to the host's durable artifacts directory under
   `[date]-audit-marketing-<slug>.md`; return inline if none exists. **Completion: DONE** iff zero
   findings across all targets, else **DONE_WITH_CONCERNS** (the normal case). STOP — no fixes.
   The verdict is evidence for a human decision; it authorizes nothing by itself.

## FP guards (Layer-1 — do not flag)

The scanner's own guards already exempt most of these, but the triage must not re-introduce them: parenthetical em-dashes inside a **quote/testimonial**; genuine **regulated-industry legal disclaimers** (by register); known acronyms in all-caps/emoji rules (API/SaaS/CRM/AI/B2B); an intentional **bad-example / fixture block** that documents slop. Authority is asymmetric — a confident false flag erodes trust faster than a missed nit.
