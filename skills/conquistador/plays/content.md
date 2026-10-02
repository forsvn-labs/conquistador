# Content-intelligence-loop workflow

This file is a prose-composition source with no execution authority. The separate executable graph
at `runtime/fixtures/playbooks/content-intelligence-loop.json` is locally implemented and verified
with synthetic fixtures. Those checks establish local runner behavior only. Live execution,
provider behavior and human acceptance remain unverified.

The optional runtime requires validated host judgments and stops at human review. Installing this
skill does not load that runner or authorize publication, spend or other external actions.

Use privately when current audience signals must become a repeatable content learning loop.

## The one social branch

Compose these exact files, in order, for one platform and one artifact:

1. [`research-content-ideas`](../../research-content-ideas/SKILL.md) — collect current source signals
   and rank one to four angle briefs by audience relevance, evidence, distinctiveness, and
   production fit.
2. [`write-social`](../../write-social/SKILL.md) — produce the finished channel-native artifact from
   the selected brief.
3. [`fresh-eyes-review`](../../fresh-eyes-review/SKILL.md) — independent readiness review of the
   actual artifact.
4. **Human verdict boundary** — the review ends at one terminal Review Packet for final human
   review; it never issues the ship decision.
5. Optional action handoff — if the human approves an external action, follow
   [social-publishing handoff](../adapters/social-publishing-handoff.md); without approval the
   loop stops at the reviewed package.
6. [`measure-growth`](../../measure-growth/SKILL.md) — after the observation window, interpret actual
   results and choose one next change.

`research-channel` may validate the chosen platform before step 2, but the branch above is the only
composition this workflow names as its social path.

Preserve source provenance and never present a trend memory, copied competitor angle, or one cycle
as a durable truth. Change one consequential variable per cycle; stop when the signal cannot justify
the production cost.

End with one terminal Review Packet for final human review: selected angle, ready artifact, sources,
observation window, stop rule, and one next action.
