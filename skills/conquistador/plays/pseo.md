---
command: pseo
label: Build programmatic search pages
intents: ["programmatic seo", "pseo", "programmatic pages", "comparison pages at scale", "location pages", "template pages for seo", "city pages", "alternative page"]
chain:
  - { command: seo }
  - { command: copy, for: "a page template with page-specific content" }
  - { method: artifact-hygiene, for: "pilot inventory and regeneration path" }
  - { command: audit, for: "pre-ship review of the finished package" }
legacy: build-programmatic-search
---
# Build programmatic search pages

Use for programmatic SEO, comparison pages, location/category templates, or other scaled
search inventory.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `seo`.
2. `copy`.
3. `artifact-hygiene`.
4. `audit`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
