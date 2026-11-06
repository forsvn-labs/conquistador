---
name: conquistador
description: Plan launches and growth, create GTM and sales work, update visual docs, and manage Conquistador setup, hooks, connections, and workflows. Skip unrelated coding.
argument-hint: "[command] [target or request]"
user-invocable: true
metadata:
  version: 3.1.2
---

Use the playbooks to deliver finished growth and marketing work within user authority.

Core principles:
- Deliver finished work; identify missing user inputs.
- For a method that keeps its craft, write with the [writing guide](references/writing-guide.md):
  lead with the reader's situation or the strongest fact, use specifics over adjectives, make one ask.
- Follow the entry’s loading rules; load only the current method.
- Preserve the customer’s brand and requested scope.
- Before delivery, check the work against [safety](standards/safety.md), and against
  [quality](standards/quality.md) for a method that keeps its craft.
  Never invent metrics, quotes, customers, or product capabilities.

## Setup

1. Identify the requested result. Engineering about marketing systems alone does not qualify.
2. Reuse relevant guidance already in context. Otherwise call `conquistador_brief`, or run
   `conquistador brief "TASK"`. For `none`, keep explicit Conquistador requests with the parent; otherwise continue directly.
3. Apply the current-stage guidance. Read deferred files only when their stage is needed.
   ENTRY.md introduces a command; COMMAND.md holds its detailed procedure.
4. Use accepted facts from PRODUCT.md and GROWTH.md ([context](standards/context.md)). Mark missing facts.

Hooks are advisory, not authority for workflows, builds, or external actions. Manual profiles
require explicit invocation or project-hook opt-in; project profiles permit relevant suggestions.
Off profiles stay silent.

## Commands

Users type `/conquistador <command> [target]` or describe the outcome in plain words.

- **Setup:** [init](commands/init/COMMAND.md) product and growth facts, [connect](commands/connect/COMMAND.md) capabilities,
  [doctor](commands/doctor/COMMAND.md) install drift, [pin](commands/pin/COMMAND.md) a standalone shortcut (`unpin` removes it)
- **Strategy:** [position](commands/position/ENTRY.md), [brand](commands/brand/ENTRY.md), [pricing](commands/pricing/ENTRY.md), [channels](commands/channels/ENTRY.md), [budget](commands/budget/ENTRY.md),
  [funnel](commands/funnel/ENTRY.md), [diagnose](commands/diagnose/ENTRY.md) stalled growth, [prioritize](commands/prioritize/ENTRY.md), [shape](commands/shape/ENTRY.md) one bounded bet,
  [decide](commands/decide/ENTRY.md) a hard decision
- **Plan:** [campaign](commands/campaign/ENTRY.md), [event](commands/event/ENTRY.md) run of show
- **Create:** [copy](commands/copy/ENTRY.md) pages, headlines, emails, [social](commands/social/COMMAND.md), [outreach](commands/outreach/COMMAND.md),
  [article](commands/article/ENTRY.md), [video](commands/video/ENTRY.md), [ads](commands/ads/ENTRY.md), [creative](commands/creative/ENTRY.md) briefs, [ideas](commands/ideas/ENTRY.md) content angles,
  [vietnamese](commands/vietnamese/COMMAND.md)
- **Grow:** [seo](commands/seo/ENTRY.md) search, AI answers, app stores, [convert](commands/convert/ENTRY.md) one surface
- **Review:** [check](commands/check/COMMAND.md) rule-based checker, [audit](commands/audit/ENTRY.md) a package, [critique](commands/critique/ENTRY.md) fresh eyes,
  [factcheck](commands/factcheck/COMMAND.md) sources, [review](commands/review/COMMAND.md) human review
- **Learn:** [measure](commands/measure/ENTRY.md), [results](commands/results/ENTRY.md) real results, [watch](commands/watch/ENTRY.md) a local video
- **Product:** [flow](commands/flow/ENTRY.md) screens and states, [ui](commands/ui/COMMAND.md) brief, [architect](commands/architect/COMMAND.md), [build](commands/build/COMMAND.md)
  (`web`, `ios`), [docs](commands/docs/COMMAND.md)
- **Meta:** [feedback](commands/feedback/COMMAND.md) a redacted public issue, only on request

Plays chain commands for a multi-step outcome; each [play](plays/) lists its steps in front matter:
[launch](plays/launch.md), [gtm](plays/gtm.md), [plan](plays/plan.md), [landing](plays/landing.md), [lifecycle](plays/lifecycle.md), [referral](plays/referral.md),
[outbound](plays/outbound.md), [press](plays/press.md), [content](plays/content.md), [series](plays/series.md), [paid](plays/paid.md), [expand](plays/expand.md),
[answers](plays/answers.md), [pseo](plays/pseo.md), [report](plays/report.md), [trailer](plays/trailer.md), [appstore](plays/appstore.md), [qa](plays/qa.md),
[interactive](plays/interactive.md), [experiment](plays/experiment.md), [spec](plays/spec.md).

## Routing

Plain "Conquistador" owns every included command, play, and management task. Load the brief
or selected entry before drafting; naming the skill or checking afterward is not method use.
Resolve parent-selection results through the catalog. Preserve named choices and stage order.
Document revisions (including "improve them") use docs regardless of storage location; keep
the document's purpose. For management, identify the installed surface/version and use CLI
help within user authority. MCP guidance alone cannot change the host.

- **No argument:** read [references/menu.md](references/menu.md) and show its menu. Never auto-run a command.
- **`/conquistador hooks on|off|status`:** run `conquistador hooks on`, `conquistador hooks off`, or
  `conquistador hooks status` in a terminal tool and report its output. It changes the hooks for every agent.
- **Explicit command or play:** load the file linked above (an entry or a complete method) or its
  play file, and follow it. Old IDs (`write-copy`, `launch-product`) still work as legacy names.
- **Otherwise:** use the brief to launch or grow this; create or improve marketing work;
  learn from these results. Follow play order and `when` conditions; return one integrated
  deliverable. Clarify only when competing routes change the outcome.
- Marketing about an app does not request code. A flow or UI brief does not authorize a build.

## Approvals

- Get the user's explicit approval each time before you send, publish, post, spend, upload, change a
  live account, or write to an external system.
  A brief, a hook, or an approval stamp grants none of these.
- Read connected data freely within host policy. Never ask for keys in chat; use `connect`.
- Offer `feedback` at most once per session, and only after a real failure or correction.

## Deliverable

Return only what the user asked for. Cite methods only on request. For small edits, add one sentence
on the change. For specialist teams, follow
[specialist team execution](orchestration/specialist-team.md).
