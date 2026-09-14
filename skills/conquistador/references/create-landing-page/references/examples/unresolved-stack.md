# Unresolved stack — needs-input argument handoff

Focused case: the operator asked for an implementation handoff, the **repo root**
has no framework config, and the user did not name HTML or a framework.
Nested `app/desktop` Vite does **not** count.

Expected:

- `handoff_mode` is `unresolved`
- `detected_stack.framework` is `unresolved`
- the prompt is a page argument + labeled gaps, **not** a 200–350 coding-agent blueprint
- no Asset Placeholder CSS recipe, no `(BUG FIX)` execution recipes
- the **unresolved** Canonical closing from `handoff-formats.md`
- no `index.html`, no vanilla default, no invented Next/Vite layout
- no "Build a public landing page" opener and no "Write production-ready, flawless code" closing

A verified Next.js (or other) **repo-root** still uses `verified`. A repo that already
is a single HTML file, or an explicit “vanilla HTML” request, may use vanilla.
Bounded inline mode still emits no companion file.

This example is the discriminating case for the 2026-09-12 handoff conflict.
