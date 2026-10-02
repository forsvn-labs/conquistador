---
command: report
label: Review content performance
intents: ["content performance","content performance review","how did our posts do","content report","review our content results"]
chain:
  - { command: measure }
  - { command: convert, for: "first message-to-action break" }
  - { command: results, mode: video, when: "the artifact is a short-form video" }
legacy: content-performance-review
---
# Review content performance

Use for measured organic text, image, carousel, newsletter, or video content.

1. Use `measure` to define one primary platform, source/window, comparable baseline, primary
   outcome, diagnostics, and confounders.
2. Use `convert` to locate the first evidenced message-to-action break and design one
   next-cycle change.
3. Use `results` instead when the consequential artifact is an actual short-form video.

Read the content-eval playbooks in [report/](report/)
(metric ingest, diagnosis, recommendation, critic). Do not paraphrase them.

Views, reach, and engagement cannot override failed qualified behavior unless one was explicitly the
primary outcome. Keep platforms, versions, and cohorts separate. Finish with keep/drop/change, one
falsifiable hypothesis, a stop rule, and what evidence would reverse the diagnosis.

End with one terminal Review Packet for final human review: evidence boundary, actual performance
diagnosis, preserved strengths, next-cycle change, and one next action.
