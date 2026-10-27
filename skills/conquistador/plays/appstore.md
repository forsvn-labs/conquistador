---
command: appstore
label: Optimize an app store listing
intents: ["app store listing","app store optimization","aso","play store listing","store listing"]
chain:
  - { command: seo, for: "store search diagnosis" }
  - { command: copy, for: "name, subtitle, description" }
  - { command: creative, for: "screenshot story" }
  - { command: convert, for: "one listing test" }
  - { command: audit, for: "pre-ship review of the finished package" }
legacy: optimize-app-store-listing
---
# Optimize an app store listing

Use for App Store or marketplace listing search, conversion, and review intelligence.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `seo`.
2. `copy`.
3. `creative`.
4. `convert`.
5. `audit`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
