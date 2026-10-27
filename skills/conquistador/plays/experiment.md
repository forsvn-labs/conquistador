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

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `campaign`.
2. `outreach`.
3. `measure`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
