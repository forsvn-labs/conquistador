# Desktop selected target — stack-targeting test

Focused case: the operator **selected** `app/desktop` (`selected_target: desktop`
only). This is not public-landing detection and not a `target_handoff` value.

Expected:

- `handoff_mode` is `desktop-test`
- detection reads `app/desktop/package.json` and `app/desktop/vite.config.*` only
  because desktop was selected
- public-landing detection at repo root stays unresolved on this product (no root Vite)
- opener is the test sentence from `handoff-formats.md`; verified Implement opener absent
- closer is the desktop-test Canonical closing; verified production-ready closer **absent**
- no Asset Placeholder CSS, no `(BUG FIX)` recipes, not a 200–350 marketing SECTION BLUEPRINT
- no public marketing route, no repo-root `index.html`

Do not treat a three-line disclaimer beside a verified implementation prompt as this case.
