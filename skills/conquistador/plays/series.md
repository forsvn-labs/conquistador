---
command: series
label: Run a short-form video series
intents: ["shortform campaign","short form campaign","video series","tiktok series","reels series","shorts series","ugc campaign"]
chain:
  - { command: ideas, when: "the audience signal or angle is unresolved" }
  - { command: video }
  - { method: video-production, for: "verify the actual capture and exports" }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: results, mode: video, when: "a real render or published result exists" }
legacy: shortform-campaign
---
# Run a short-form video series

Use for TikTok, Reels, Shorts, founder demos, UGC-style video, and measured recuts.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `ideas`, when the audience signal or angle is unresolved.
2. `video`.
3. `video-production`.
4. `audit`.
5. `results`, when a real render or published result exists.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
