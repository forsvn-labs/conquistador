---
command: press
label: Earn press and media coverage
intents: ["press","press coverage","pr campaign","pitch journalists","podcast outreach","earned media","media pitch","pitch reporters"]
chain:
  - { command: channels, for: "outlets and people who reach the audience" }
  - { command: position, for: "the newsworthy story" }
  - { command: outreach, for: "signal-led pitches" }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: results, mode: outreach, when: "real placement or response evidence exists" }
legacy: earned-media-outreach
---
# Earn press and media coverage

Use for press, podcast, newsletter, analyst, creator, or other earned-media opportunities.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `channels`.
2. `position`.
3. `outreach`.
4. `audit`.
5. `results`, when real placement or response evidence exists.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
