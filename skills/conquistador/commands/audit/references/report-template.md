---
title: Audit-Marketing — Report Template
lifecycle: canonical
status: stable
produced_by: audit
load_class: PROCEDURE
---

# Report Template

**Load when:** the final step of the AUDIT flow — writing the dated report to disk. Path: `.forsvn/artifacts/mkt/audit-marketing/[YYYY-MM-DD]-audit-marketing-<slug>.md` (dated, slug-suffixed, immutable per-run; lifecycle: snapshot). Reports accumulate as an audit trail — never overwrite a prior report.

The report **describes** findings; it never edits the audited artifact. The optional POLISH flow writes fixes to the *audited* file (landing `decision_state: pending`) — never to this report.

---

## Frontmatter

The report is itself a meta-stack artifact and must pass `validate-artifacts --strict`, so it carries the v3 instruction core (`id`/`type`/`keywords`) + v2 fields (`stack`/`review_surface`) on top of the review-report shape.

```yaml
---
skill: audit
produced_by: audit
id: audit-marketing-{YYYY-MM-DD}-{slug}     # == filename stem; v3 instruction core
type: record                                 # meta-stack records layer
keywords: [slop-audit, antipattern, {target-slug}]
stack: meta
review_surface: html
version: {skill-version}                      # matches the running skill's metadata.version
date: {YYYY-MM-DD}
status: done | done_with_concerns | blocked   # mirrors the Completion Status
verb: audit | polish                          # which sub-command produced this report
rounds: N                                     # polish: fix→re-verify cycles ran (0 for a pure audit)
score_before: N                               # severity-weighted = 3*block + 2*warn + 1*nit (across targets)
score_after: N                                # == score_before for a pure audit; lower-or-equal after polish
verdict: clean | findings | blocked           # clean = 0 findings; blocked = unresolved denylist hit
advisory_tier_run: false                      # true only once the S6 LLM-critic exists and ran
provenance:
  skill: audit
  run_date: {YYYY-MM-DD}
  input_artifacts:                            # what was scanned
    - {path to the audited artifact, or the operator-supplied package / `.forsvn/artifacts/**/*.md` tree}
  detector: seven-dimension judgment (+ host scanner aid if present)
  output_eval: null
---
```

## Body template

```markdown
# Marketing Slop Audit — {target}

**Reads like AI? — {PASS | FAIL}.** {One brutally-honest line. On FAIL, name the single loudest tell, e.g. "FAIL — em-dash crutch + 'it's not just X, it's Y' in the hero."}

**Scanned**: {named artifact path | the operator-supplied package / `.forsvn/artifacts/**/*.md` tree (N files)}
**Tiers run**: deterministic (regex + heuristic){; advisory LLM-critic NOT run — S6 not built / not invoked}
**Severity-weighted score**: {3·block + 2·warn + 1·nit} = {N}  ·  **block {N} · warn {N} · nit {N}**

> {Only when a denylist finding fired:} ⛔ **Finalize blocked** — a zero-tolerance finding is present (fabricated/unsourced stat or a locked brand token). Fix it before this copy goes to release review; the POLISH flow marks Completion BLOCKED until it clears.

## Issues Found

Findings are grouped **blocking → material → minor**. Each line: severity · dimension/rule name · section/line · measured-evidence snippet · → suggested fixer (if one exists). A finding is **not** automatically a defect (see the footer).

### Accepted   {/audit: the real findings; /polish: the ones it attempted to fix}
- `[block] slop-not-just-x` · hero:L3 · "It's not just a tool, it's a movement." · → operator-named language tool
- `[warn] cta-weak-verb` · cta:L12 · "Learn more" (no value clause) · → `copy`

### Rejected   {Layer-1 false positives + collapsed nit-padding — say WHY each cleared}
- `[minor] rule-of-three` · L8 · triad inside a quoted testimonial — exempt (FP guard).

### Deferred   {needs paired artifact / human judgment / rolled back in polish}
- `[warn] cta-bait-and-switch` · needs the paired landing page in scope to verify — human-review.

## Changes Made   {/polish only — omit for a pure /audit}

| Location | Original | Change | Rule | Verify |
|---|---|---|---|---|
| hero:L3 | "It's not just a tool, it's a movement." | "{the fix}" | slop-not-just-x | accepted_fixed |
| cta:L12 | "Learn more" | "{attempted}" | cta-weak-verb | accepted_deferred (rolled back — dropped the CTA verb) |

## Next

{Imperative + FP-judgment clause + the rolled-up command.}
Handle the BLOCK findings before this ships. A finding is not automatically a defect — a quoted testimonial, a legal disclaimer, an intentional bad-example block, or a user-confirmed choice can be valid as-is; use judgment, and don't silence a real one.

**Next**: ask for the audit POLISH flow on {target} to apply + re-verify Accepted fixes (lands `decision_state: pending` for your review) — using available fixers only: {operator-named language tool, `copy`, `vietnamese`}. No fixer grants release authority.
```
