---
command: experiment
label: Run a measured growth experiment
intents: ["growth experiment","experiment loop","measured initiative","run an experiment","test and learn","learning cycles"]
chain:
  - { command: campaign, for: "hypothesis, signal, guardrails, stop rule" }
  - { command: outreach, for: "Cycle 1 asset (or the relevant create command)" }
  - { command: measure, for: "keep, revise, or stop" }
legacy: measured-initiative-loop
---
# Run a measured growth experiment

Use for a campaign or growth initiative that must learn across bounded cycles.

1. Use `campaign` to fix one segment, hypothesis, intervention, primary signal, guardrails,
   scope, kill switch, and stop rule.
2. Use the relevant creation outcome, such as `outreach`, for Cycle 1.
3. Use `measure` to decide keep, revise, or stop from actual results.
4. Change one hypothesis for Cycle 2 only when Cycle 1 evidence supports continuing.

Read the loop playbooks in [experiment/](experiment/) (loop
architect, metric designer, scope guard, eval-loop critic, pipeline spec). Do not paraphrase them.

Each run starts from the same recorded baseline and contract so retries do not drift. A safety,
compliance, or below-threshold kill switch ends the initiative rather than triggering another round.
Never promote a two-cycle observation into a universal rule. Optional persistence is one approved
Markdown record, not a manifest, graph, router, database, or background process.

End with one terminal Review Packet for final human review: current evidence, decision, bounded
learning proposal, remaining uncertainty, and one next action.
