---
command: answers
label: Check visibility in AI answers
intents: ["ai answer visibility","answer visibility","chatgpt mentions","cited by chatgpt","perplexity citations","aeo audit","llm visibility","ai search visibility"]
chain:
  - { command: seo, for: "query set, eligibility, extractability" }
  - { command: factcheck, for: "source authority and uncertainty" }
  - { command: measure, for: "dated comparison" }
legacy: answer-visibility-monitor
---
# Check visibility in AI answers

Use for an on-demand, dated audit of whether a product or source appears or is cited in AI
answer systems.

1. Use `seo` to define a fixed query set, inspect source eligibility and extractability,
   and diagnose organic versus answer-surface evidence separately.
2. Use `factcheck` to record source authority, contradictions, provider limits, and uncertainty.
3. Use `measure` to compare dated observations, confounders, and keep/revise decisions.

Read the AEO playbooks in [answers/](answers/) (query set,
provider readiness, citation/geo/traffic monitors, report, provider matrix). Do not paraphrase them.

Record exact query, date, locale/personalization context when knowable, provider/model, answer,
citation, and source URL. Repeat the same ritual across snapshots; record what changed and what remains
unknown. Do not infer citations from organic traffic or claim a content/schema change caused provider
behavior. This is on-demand, never a background monitor.

End with one terminal Review Packet for final human review: dated snapshot, comparison, uncertainty,
bounded recommendation, recheck trigger, and one next action.
