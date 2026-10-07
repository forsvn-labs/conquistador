---
command: content
label: Run a content learning loop
intents: ["content loop","content engine","content intelligence loop","repeatable content","content flywheel","content system"]
chain:
  - { command: ideas }
  - { command: social, for: "the finished channel-native artifact" }
  - { command: critique, for: "independent readiness review" }
  - { command: measure, when: "the observation window has closed" }
legacy: content-intelligence-loop
---
# Run a content learning loop

Use when current audience signals must become a repeatable content learning loop.

## The one social branch

Compose these exact files, in order, for one platform and one artifact:

1. [`ideas`](../commands/ideas/COMMAND.md) — collect current source signals
   and rank one to four angle briefs by audience relevance, evidence, distinctiveness, and
   production fit.
2. [`social`](../commands/social/COMMAND.md) — produce the finished channel-native artifact from
   the selected brief.
3. [`critique`](../commands/critique/COMMAND.md) — independent readiness review of the
   actual artifact.
4. **Human verdict boundary** — the review ends at one terminal Review Packet for final human
   review; it never issues the ship decision.
5. Optional action handoff — if the human approves an external action, follow
   [social-publishing handoff](../adapters/social-publishing-handoff.md); without approval the
   loop stops at the reviewed package.
6. [`measure`](../commands/measure/COMMAND.md) — after the observation window, interpret actual
   results and choose one next change.

## Test distinctiveness before ranking

- Before an angle is chosen, map the strongest existing coverage of the topic. Record the angle each
  piece already owns and the questions it leaves open. If existing coverage already owns the
  proposed angle, find a sharper contribution or archive the idea.
- Hold an idea that has only one source, with a note such as "needs a second independent source".
  Do not rank it as a pattern.
- When the human rejects an angle, record one plain reason, such as: the conversation already
  peaked, the angle is already owned, it is not relevant to our reader, or we cannot make it
  credible. Use past rejection reasons as examples in later rankings.

Use `channels` to validate the platform before step 2 when it is in doubt. The optional runtime graph
for this play is `runtime/fixtures/playbooks/content-intelligence-loop.json`; it stops at human review.

Preserve source provenance and never present a trend memory, copied competitor angle, or one cycle
as a durable truth. Change one consequential variable per cycle; stop when the signal cannot justify
the production cost.

End with one terminal Review Packet for final human review: selected angle, ready artifact, sources,
observation window, stop rule, and one next action.
