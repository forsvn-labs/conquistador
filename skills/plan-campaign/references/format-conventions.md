# Campaign plan artifact contract

Write `.forsvn/artifacts/mkt/plan-campaign/campaign-plan.md` when the host has that
store; otherwise return the same structure inline. Preserve prior versions when
comparing revisions. A plan is not a launch receipt.

## Frontmatter

Retain these keys:

```yaml
skill: plan-campaign
version: 1
date: YYYY-MM-DD
status: done_with_concerns
stack: marketing
review_surface: md
decision_state: not_required
review_tool: inline
reviewed_at:
reviewer:
pack_verified: none
applied_tactics: []
```

status is done, done_with_concerns, blocked, or needs_context. version identifies
the artifact revision. Human decision_state is pending, approved, denied, suggested,
or not_required. Only record a human verdict actually received. reviewed_at and
reviewer remain empty until then. review_surface and review_tool describe the
actual review channel; they do not prove acceptance.

pack_verified: none applies when only method packs were loaded. Keep method_updated
separate from platform verification. Per-channel evidence dates, scope, unresolved
checks, and applied_tactics follow legibility-convention.md. Never copy a method's
update date into the verification field or treat an observable measure as a ranking
weight. Optional campaign_name, goal, audience, growth_motion, team_size, budget_tier,
and duration_days must reflect the supplied plan, not invented precision.

## Full-plan sections

Retain the headings Foundation, Growth Motion, Creative Direction, Pillars,
Angle Bank, Channel Assignments, Channel Execution Briefs, Timeline, Launch Sequence,
Why This Works, and Review Gate. Put the finished plan first, rationale before
Review Gate, and Review Gate last. A bounded parent request includes only its
requested sections and marks other full-plan requirements N/A.

Foundation records the outcome, reader tasks, decisions, proof, constraints, and
assumptions. Growth Motion describes how users reach and adopt the product; it
does not determine a mandatory channel order. Creative Direction cites available
approved house direction and describes campaign-specific choices. Record missing
brand evidence and defer unsupported art calls. Do not invent a brand system.

## Compatible tables

| Section | Columns |
|---|---|
| Pillars | #, Pillar, Type, %, Stage, Evidence |
| Angle Bank | #, Angle, Hook, Stage, Trigger, Score, Class, Pillar |
| Channel Assignments | Channel, Type, Angle, Role, Cadence |
| Channel Execution Briefs | Channel, Objective, Tactic, Budget Type, Success Metric, Owner, First Milestone |
| Timeline | Week, Phase, Channel, Angle, Format, Status |
| Launch Sequence | Phase, Timing, Channels, Action |

Type in Pillars is a free-form information purpose. Stage describes the reader's
actual task and context; it has no mandatory ladder or population distribution.
Trigger records an observed event or question, or unknown; it is not an emotion
category. Hook names the opening choice. Score is an ordinal priority with rationale,
not a /25 sum. Class describes intended use, such as search or conversation, with
the evidence or assumption supporting that use.

Pillar % is optional. When used, name a common allocation unit and sum to 100;
otherwise use N/A. Theme and angle counts follow useful decisions, evidence, and
capacity. Each angle names an existing pillar and includes its decision, evidence,
next action, controls, and rejection condition. No quota overrides missing proof.

## Execution and measurement

Compare only a supplied closed channel set. For open full plans, account for the
nine channel families with selected or skipped reasons. Every selected channel
needs a specific angle and execution brief. Role describes its job; cadence comes
from production effort, review capacity, audience access, and a testable schedule.

Success Metric includes the actual outcome definition, observation window, and
agreed decision rule. If the baseline or target is missing, say so and define the
measurement prerequisite. Do not insert a generic CTR or conversion threshold.
Budget Type is Paid, Organic, Paid + Organic, Bartered, or In-kind. State costs,
permissions, and owner even when no media fee applies. Detailed allocation math
belongs to the budget skill.

Per-channel notes follow legibility-convention.md and the method pack's §0 fit,
§1 opening, §2 task-verified constraints, §3 observable measures, §5 test,
§6 capacity/timing, and §7 CTA. Current task evidence is required before claiming
a format, permission, or platform rule has been verified.

Selected IRL or OOH needs location/vendor, production, readability, capture, and
follow-up requirements. SMS needs applicable consent, message format, suppression,
and unsubscribe checks. Unknown legal or provider requirements remain unresolved;
this document does not certify them.

Timeline Phase is a work/readiness label, not a buyer psychology stage. Name owner,
effort, dependencies, acceptance, and review point for each row. Planned, Live, and
Done require their respective evidence; no plan alone marks work Live. Launch
Sequence orders readiness milestones without a fixed phase count or channel order.

## Rationale and review

Why This Works states the campaign hypothesis, product evidence, material tradeoffs,
and result that would challenge the plan. Use why-this-works-convention.md. Keep
unknowns explicit. Review Gate presents Approve, Reject, and Suggest changes for
human content review. Only a received human response changes decision_state;
that response does not authorize publication, spend, or external account changes.

Before saving, verify pillar-to-angle, angle-to-channel, and channel-to-timeline
references; per-channel briefs; capacity totals; source permissions; and action
boundaries. Max two critic revision cycles. Preserve unresolved failures and the
best draft in optional campaign-plan.critic-notes.md. Record the reason for a rerun
and retain prior evidence instead of silently relabeling it.
