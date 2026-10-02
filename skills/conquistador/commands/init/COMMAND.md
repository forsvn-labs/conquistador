---
name: init
description: "Record durable product and growth truth in PRODUCT.md and GROWTH.md, so every later command starts from it"
metadata:
  version: 1.0.0
---

# init

Record what is true about the product and its growth once. Every later command reads it.
`init` writes `PRODUCT.md` and `GROWTH.md`. It does not write strategy, copy, or plans.

When `conquistador` is not on PATH, run `npx @forsvn/conquistador` in its place.

## 1. Load the current state

Run `conquistador context --json`. It returns the project root and the existing context files.

| State | Do this |
|---|---|
| No `PRODUCT.md` and no `GROWTH.md` | Explore, interview, then write both. |
| `PRODUCT.md` exists | Keep it. Add only missing facts. Ask what is stale or missing. |
| `PRODUCT.md` has `<!-- impeccable:product-schema N -->` | Impeccable wrote it. Never rewrite, reorder, or delete its content. Append missing facts under its existing headings. |
| `GROWTH.md` exists | Ask what changed. Do not reopen confirmed facts without a reason. |
| A child app has its own file | Ask whether the fact is shared (root file) or app-only (app file). |

Never overwrite a file another tool or a person wrote. If a fact conflicts with the file, show
both and ask which is true.

## 2. Explore before you ask

Run `conquistador signals --json` once. Then read what it points to. Read enough that the user
does not repeat a known fact:

- Product docs, `README.md`, and existing `PRODUCT.md`, `GROWTH.md`, and `DESIGN.md`.
- The landing page, pricing page, blog, docs, changelog, and app store metadata that signals found.
- Package manifests: the analytics, product analytics, email, payments, CMS, and auth tools in `stack`.
- `CHANGELOG.md` and recent tags: what shipped, and what is about to ship.
- Real proof on hand: testimonials, case studies, logos, press, metrics with a source.

Treat repository evidence as a hypothesis. Confirm it before you record it as fact.

## 3. Interview for material gaps only

Ask about gaps that change future work and that the repository does not answer. Ask at most
three focused questions per round. Use the host's question tool when it has one. Wait for the
answer. Confirm inferences instead of asking open questions ("The pricing page shows three
tiers. Is Team the plan you most want to sell?").

Start with the gaps that change the most decisions:

1. Who buys and who uses, in what situation, and what job they do.
2. The growth goal for the next 90 days, and the one metric that shows it.
3. What has worked and what has not, by channel.

Add a round only for a material gap: voice samples, budget, compliance, approvals, or proof.
Write after one real answer round. If no one answers after one probe, write only what the
repository proves, mark every inference as `Inferred`, and say so in your first reply.

Record an undecided fact as open: `- Open: monthly paid budget.` Never invent a user, a metric,
a quote, a customer, a price, or a result.

## 4. Write PRODUCT.md

Product truth. The headings match Impeccable's `PRODUCT.md`, so both tools share one file. Omit
a section that has no confirmed fact. New files go at the project root.

```markdown
# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
[Primary buyer and user, their situation, and the job they hire the product for.]

## Product Purpose
[What the product does, why it exists, and what success means for the user.]

## Positioning
[The mechanism or claim a competitor could not truthfully copy. The category and the alternative.]

## Operating Context
[Where and how people evaluate and use the product: workflows, tools, rituals, buying process.]

## Capabilities and Constraints
[Confirmed features, limits, and terminology. Open product facts.]

## Brand Commitments
[Name, voice, assets, and identity rules the user made binding.]

## Evidence on Hand
[Real proof with paths or links: testimonials, case studies, data, press. State what does not exist.]

## Product Principles
[Three to five durable principles from confirmed answers.]
```

`Platform` is one bare value: `web`, `ios`, `android`, or `adaptive`. Write the schema comment
only in a file you create. In a file that has one, keep it as it is.

## 5. Write GROWTH.md

Growth truth. Copy the schema comment exactly.

```markdown
# Growth

<!-- conquistador:growth-schema 1 -->

## Goals and Metrics
[The goal for the next 90 days, the one metric that shows it, its current value and source, and the target.]

## Audience and Segments
[Segments in priority order: who, the trigger that makes them look, and where they are reachable.]

## Channels
### What has worked
[Channel, what was done, the result, and the source of the number.]
### What has not worked
[Channel, what was done, and why it stopped.]
### Not tried
[Channels the team wants to test.]

## Proof and Assets
[Usable proof and assets with paths: testimonials with permission, case studies, demos, screenshots, logos.]

## Voice
[Three to five rules, plus two or three real samples the user wrote or approved, with their source.]

## Limits
- Budget: [monthly amount, or Open]
- Compliance: [rules that apply, for example CAN-SPAM, GDPR, or industry claims rules]
- Approvals: [who approves sends, publishes, and spend]

## Stack
[Connected tools by job: analytics, CRM, email, ads, payments, CMS. Run `conquistador connect` to
add or verify a tool. Record only tools the user confirmed.]
```

## 6. Add the .gitignore block

Run `conquistador context --gitignore`. It adds this block once and updates it in place later:

```gitignore
# conquistador:start
# Ephemeral Conquistador files. PRODUCT.md, GROWTH.md, and .conquistador/config.json stay in Git.
.conquistador/runs/
.conquistador/cache/
.conquistador/logs/
.conquistador/tmp/
.conquistador/*.local.json
# conquistador:end
```

Do not edit lines outside the markers.

## 7. Finish

Check that both files exist at the paths from step 1 and hold the confirmed facts. If a file is
missing, `init` is not done.

Report in three short lists: recorded, inferred, and open. Then suggest the next command from
the signals, as in [the menu](../../references/menu.md). If another command started `init`,
return to that command now.
