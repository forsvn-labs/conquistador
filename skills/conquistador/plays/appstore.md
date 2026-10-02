---
command: appstore
label: Optimize an app store listing
intents: ["app store listing","app store optimization","aso","play store listing","store listing"]
chain:
  - { command: seo, for: "store search diagnosis" }
  - { command: copy, for: "name, subtitle, description" }
  - { command: creative, for: "screenshot story" }
  - { command: convert, for: "one listing test" }
legacy: optimize-app-store-listing
---
# Optimize an app store listing

Use for App Store or marketplace listing search, conversion, and review intelligence.

1. Use `seo` to inspect current store results, query intent, metadata constraints,
   competitors, index/discovery evidence, review language, and measurement.
2. Use `copy` for accurate name, subtitle, description, or equivalent listing copy.
3. Use `creative` for a progressive screenshot or preview story grounded in real UI.
4. Use `convert` to define one listing test and qualified activation guardrail.

Do not invent keyword volume, rank, conversion, product behavior, compatibility, awards, or reviews.
Keep metadata, media, product page, and activation promise congruent. Verify current store constraints
when they affect the work.

End with one terminal Review Packet for final human review: search diagnosis, finished metadata copy,
media story, claim and platform boundary, test rule, and one next action.
