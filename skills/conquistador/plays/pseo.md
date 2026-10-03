---
command: pseo
label: Build programmatic search pages
intents: ["programmatic seo","pseo","programmatic pages","comparison pages at scale","location pages","template pages for seo"]
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

1. Use `seo` to verify demand and intent, crawl/index foundations, unique page-level
   inventory, internal linking, canonical rules, retrieval/answer suitability, and measurement.
2. Use `copy` to define a template whose decision-bearing content remains specific to each page.
3. Use the [artifact-hygiene](../methods/artifact-hygiene.md) method to prove the pilot inventory, source provenance, generated-output
   boundary, and safe regeneration path.

Run a small manually reviewed pilot before scaling. Missing page-level evidence blocks a page. Stop
when pages become interchangeable, target the wrong intent, fail indexation after technical checks,
or produce unqualified traffic. Do not publish or generate the full inventory implicitly.

Run `audit` on the finished package before the Review Packet.

End with one terminal Review Packet for final human review: query/inventory thesis, pilot template and
examples, technical gates, stop rules, and one next action.
