---
title: Audit-Marketing — category → fixer routing
lifecycle: canonical
status: stable
produced_by: audit
load_class: PROCEDURE
---

# Fix routing — which fixer repairs which antipattern family

Routing is by finding family, restricted to fixers that actually exist in the current install. The
public skills named here (`vietnamese`, `copy`) route when installed. Families whose
default fixer is not installed stay **Deferred with a proposed correction** — they never route to an
unqualified pass, and no routing decision grants release authority.

| Family | Fixer (when available) | Why |
|---|---|---|
| slop lexicon & cadence | operator-named language tool, else Deferred | strip the tell, preserve the claim |
| voice / register | operator-named language tool, else Deferred | re-register without changing the message |
| structure & scannability | operator-named language tool, else Deferred | re-shape for the surface |
| channel-fit | operator-named language tool, else Deferred | adapt to the platform's format |
| model-identity tells | operator-named language tool, else Deferred | strip the provider tell, keep the message |
| hook / lede | `copy` | regenerate the weak unit, not a synonym swap |
| claim quality | `copy` | re-ground the claim in proof |
| CTA | `copy` | pair the action with a payoff |
| persuasion structure | `copy` | identify the unsupported premise or missing decision answer; repair it with evidence and clear scope |

**VN override.** A finding tagged Vietnamese-register / translation-artifact routes to
`vietnamese` (when installed) regardless of family default — Vietnamese tone is its own fixer
of record.

## Cross-artifact / structural-only → human-review (never a confident auto-fix)

These need context a single in-scope artifact can't supply, or are structural decisions the fixers shouldn't make blind. Route them to a **human-review note** in the report's Deferred subsection:

- CTA bait-and-switch — needs the paired ad + landing page both in scope to compare verbs.
- competitor-swap failure — when the paired/comparison artifact is absent.
- missing social proof — the fix is *supplying* a named proof, not rewording; a human owns which proof.
- headline overflow — the fix is a length/placement decision against the platform cap; surface the measured overage, let the human cut.

## Fixer invocation contract

Invoke each fixer with **`protected_tokens`** so it preserves every number / URL / entity / CTA
verb-phrase. Group Accepted findings by fixer → **one fixer run per artifact**, listing the target
findings. The fixer returns its Change Log `{ Location, Original, Change, Rule }`, which the
re-verify gate diffs. This skill adds no fix code of its own.
