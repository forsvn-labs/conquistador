---
command: series
label: Run a short-form video series
intents: ["shortform campaign","short form campaign","video series","tiktok series","reels series","shorts series","ugc campaign"]
chain:
  - { command: ideas, when: "the audience signal or angle is unresolved" }
  - { command: video }
  - { method: video-production, for: "verify the actual capture and exports" }
  - { command: results, mode: video, when: "a real render or published result exists" }
legacy: shortform-campaign
---
# Run a short-form video series

Use for TikTok, Reels, Shorts, founder demos, UGC-style video, and measured recuts.

1. Use `ideas` when the current audience signal or angle is unresolved.
2. Use `video` for one audience/hypothesis, hero script, storyboard, platform-native recuts,
   production specification, and learning plan.
3. Use the [video-production](../methods/video-production.md) method to verify the actual capture and exports.
4. Use `results` after a real render or published result exists; use `measure` only
   for cross-channel or downstream synthesis.

Load only the relevant channel and format notes. Do not claim trends from memory, invent UI, voice of
customer, or results, or call a crop a recut. Posting, amplification, and external production remain
human-owned.

End with one terminal Review Packet for final human review: campaign bet, hero and true recuts,
production acceptance, observation rule, and one next action.
