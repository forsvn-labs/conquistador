# Procedure — Critical Gates (write-social)

> Load before Pre-Dispatch. These four gates are non-negotiable; violations triggered downstream (anti-patterns, FORMAT_FAIL escalation, polish-chain divergence) trace back here.

---

## 1. Single-platform per artifact

Multi-platform = re-invoke with a different `platform` argument. Each platform artifact needs its own account constraints, preview, audience decision and production checks.

## 2. Single-market per artifact

Multi-market campaigns re-run per market. Vietnamese-market copy auto-routes through `polish-vietnamese` via `--polish-chain polish-vietnamese`. The polish chain is **terminal**, never inline — copywriter generates in the source language; polish step transforms in place.

## 3. Brand mode required (`founder` OR `company`)

Either `brand/BRAND.md` declares the mode (look for `mode:` field or explicit "founder voice" / "company voice" language) OR the operator answers Cold Start Q3. **No silent default** — defaulting silently triggers Anti-Pattern #5 (Brand-Voice Ignored) at critic time. If Pre-Dispatch cannot resolve the mode and Cold Start is skipped (`--fast` mis-applied), the dispatch BLOCKS with a `NEEDS_CONTEXT` status pointing to `create-brand`.

## 4. Max 1 format-check revision loop (baseline)

Two consecutive `REVISION_REQUIRED` verdicts from the format-checker = `FORMAT_FAIL`, escalated to user. Artifact ships with `status: blocked` and critic is NOT dispatched. Looping until copy fits typically masks a brief-vs-platform mismatch (e.g., a 3-claim narrative crammed into an X 280-char window).

**Mode interaction:**
- `--fast` → revision loop = 0 cycles. First hard-cap violation = `FORMAT_FAIL` immediately.
- `--deep` → revision loop = MAX 2 cycles. Third `REVISION_REQUIRED` still escalates.

---

## Cross-references

- Anti-Pattern catalog (per-pattern detection rule + agent ownership): [`anti-patterns.md`](anti-patterns.md).
- Dispatch mechanics (format-check bounce, single-agent fallback, polish-chain handoff): [sequential fallback](../fallbacks/sequential.md).
- Mode resolver (mode definitions, `--fast` / `--deep` mechanics, safety-gate floor): [sequential fallback](../fallbacks/sequential.md).
