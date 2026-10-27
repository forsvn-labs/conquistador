---
command: answers
label: Check visibility in AI answers
intents: ["ai answer visibility","cite our","chatgpt and perplexity","ai citations","answer visibility","chatgpt mentions","cited by chatgpt","perplexity citations","aeo audit","llm visibility","ai search visibility"]
chain:
  - { command: seo, for: "query set, eligibility, extractability" }
  - { command: factcheck, for: "source authority and uncertainty" }
  - { command: measure, for: "dated comparison" }
legacy: answer-visibility-monitor
---
# Check visibility in AI answers

Use for an on-demand, dated audit of whether a product or source appears or is cited in AI
answer systems.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `seo`.
2. `factcheck`.
3. `measure`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
