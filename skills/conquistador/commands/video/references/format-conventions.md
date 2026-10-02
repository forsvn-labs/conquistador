---
title: Create Shortform — Format Conventions
lifecycle: canonical
status: stable
produced_by: create-shortform
load_class: PROCEDURE
---

# Format Conventions

**Load when:** synthesis/storyboard/hook/copy-pack agents are composing artifact content OR critic agent is verifying formatting. These conventions are enforced by critic Production + Algorithm-fit + Brand-fit sub-critics.

---

## Date format

All dates ISO 8601 (`YYYY-MM-DD`). No locale variants, no "May 18, 2026" prose. Frontmatter date fields + inline `last_updated` citations both use this format.

## Timing format

All shot/scene timings in seconds, using the `0:XX–0:YY` range syntax (en-dash, not hyphen-minus):

```
0:00–0:01 — Hook visual hits (ECU on hand pulling latch)
0:03–0:05 — Latch click audible; cut to MCU on founder face
0:05–0:08 — Founder verbal: "Standup là họp lại để báo cáo lại"
```

Vague phrases like "early on," "after the hook," "near the end" auto-FAIL on critic Production. Every shot/scene block has a timing range; total brief length matches the planned duration from the read-through and verified upload constraints.

## Framing tags

All shots specify framing per `references/storyboard-grammar.md`:

- ECU — Extreme Close-Up
- CU — Close-Up
- MCU — Medium Close-Up
- MS — Medium Shot
- MLS — Medium Long Shot
- LS — Long Shot
- WS — Wide Shot
- EWS — Extreme Wide Shot

"Close-up" alone is ambiguous — specify ECU/CU/MCU. Motion-graphic scenes use composition tags (full-frame, split-frame, layered) instead of framing tags; the storyboard-agent picks the convention per resolved production_mode.

## Action specificity

All actions are verb + object, not vague labels. Auto-FAIL on critic Production:

- ❌ "Show product"
- ❌ "Talk to camera"
- ❌ "Transition"
- ❌ "Cutaway"
- ❌ "B-roll"

Pass examples:

- ✓ "Hand pulls latch on case; latch click audible at 0:03"
- ✓ "Founder makes eye contact, leans into MCU framing"
- ✓ "Cut on impact — match-cut from product reveal to UI screenshot"

## Audio specification

Every audio block names either a track OR VO direction — never "use trending music" or "background music."

**Named track:**
```
Track: [exact approved track identity and asset path; rights and verification evidence required]
Usage: full-piece bed, sync drop to product reveal at 0:05
```

**VO direction:**
```
VO: Founder voice, semi-casual register, mic close (less than 6 inches), slight room tone preserved.
Pacing: 165–175 wpm. Sync: line 1 lands 0:00–0:03, line 2 lands 0:05–0:08.
```

## Opening decision record

Each variation records the intended viewer, opening promise, supporting shot or source, exact visual/speech/text specification and timing. Use a descriptive choice name when useful. A novel approach does not need operator permission solely because it is absent from the catalog.

Do not add a sample frequency or performance claim unless an actual, relevant dataset supports it. The critic checks promise delivery and production readiness.

## VoC exact-quote rule

Every audience quote in the brief is reproduced VERBATIM from `research/icp-research.md`. No paraphrasing, no "tightening," no translation. Critic Brand-fit checks character-for-character match.

If a quote needs translation (e.g., VN ICP quote → EN brief for a multi-market campaign — though Critical Gate 2 of short-form-research forbids mixing markets, this skill can still produce briefs in a market different from ICP language), the brief includes BOTH the original and the translation, attributed:

```
"Standup là họp lại để báo cáo lại" (VN ICP, voice-of-customer §2.3)
  → "Standup is just meeting to report back" (translation, brief-internal)
```

## Variant "What Changed From Hero" guard

Each variant starts with a table of element, primary choice, variant choice, retained/changed decision and reason. Cover the opening, audio, caption, CTA, duration and framing. Reassess the whole destination even when a working choice remains unchanged. Follow the table with a complete production brief; do not label a resized caption as a completed assessment.


## Frontmatter field order

Per the Output Artifact Structure block in SKILL.md body. Required fields (in this order):

```yaml
type: create-shortform
role: hero | variant
status: done | done_with_concerns | blocked | needs_context
stack: marketing
review_surface: md         # html | md | none
decision_state: not_required # pending | approved | denied | suggested | not_required
review_tool: inline        # proof | inline | roughdraft | none
reviewed_at:               # YYYY-MM-DD — empty until reviewed
reviewer:                  # who recorded the review — empty until reviewed
date: YYYY-MM-DD
slug: <kebab-case>
angle: <free text, 1 sentence>
brand_mode: founder | company
production_mode: live-action | motion-graphic | mixed
market: <region>
hero_platform: tiktok | reels | shorts | x | linkedin
variants: [list]
research_artifact: .forsvn/artifacts/mkt/research-content-ideas/[slug].md
research_trend_signals_date: YYYY-MM-DD
research_mechanics_date: YYYY-MM-DD
campaign_tie_in: <slug or null>
frame_direction: present | absent   # whether brand/FRAME.md grounded the frame composition
critic_passes: [hook, production, algorithm-fit, brand-fit]
critic_loop_count: 1 | 2
polish_chain_applied: polish-vietnamese | operator-named-tool | none
pack_verified:               # YYYY-MM-DD | none — applicable platform check date; `none` when unverified or absent
applied_tactics: []          # specific §1/§2 tactics narrated in Format Specification; may be nonempty for a method-only pack
```

For variant artifacts, `role: variant` and additional field `variant_platform: <platform>`. The four review fields apply to the **hero `brief.md`** only — variant artifacts do not carry them.

The `decision_state` / `review_tool` / `reviewed_at` / `reviewer` fields are the human-review layer (reviewable-artifact contract; ceremony left in Git). The short-form brief is a `pipeline` artifact, so `decision_state` defaults to `not_required` — most briefs are regenerable drafts. The fields and the `## Review Gate` body section ship in the hero template so the operator (or an eval loop) can opt a run into review by setting `decision_state: pending`; the optional Markdown UI fallback is the roughdraft-review protocol (ceremony left in Git). The fields are flat (the `manifest-sync` parser reads flat YAML) and additive/orthogonal to the existing schema.

## Body section headers (verbatim)

The 15 hero body sections appear in this order with these exact headers (downstream consumers — currently human producers; potentially `evaluate-shortform` if it expands — match on H2):

1. `## TL;DR for the Producer`
2. `## What This Brief Bets On`
3. `## Audience & Voice`
4. `## Format Specification`
5. `## Hook`
6. `## Storyboard`
7. `## On-Screen Text Choreography`
8. `## Audio Plan`
9. `## Caption`
10. `## CTA`
11. `## Production Notes`
12. `## What NOT To Do`
13. `## Success Criteria`
14. `## Variant Roadmap`
15. `## Review Gate`

Variant artifacts start with `## What Changed From Hero`, followed by a complete destination brief. Retained assets may use explicit source paths, but their applicable timing and instructions remain clear. The `## Review Gate` section is on the **hero `brief.md`** only — variant artifacts do not carry it.

## Legibility block within Format Specification

End Format Specification with the Legibility block from `legibility-convention.md`. Record the local pack, method revision, task-local platform verification or none, decisions applied and pending checks. A present pack with no external check uses method-only, not absent. `pack_verified: none` can coexist with an accurate list of applied method decisions.

Mirror those facts into the artifact fields. Each variant records its own account and destination checks. Do not claim a performance effect from a method citation.

## Why-this-works block (`## What This Brief Bets On`)

Section 2, `## What This Brief Bets On`, **is** this brief's why-this-works block per
[`why-this-works-convention.md`](why-this-works-convention.md) — the brief-style
"the bet" opening the convention explicitly allows. It carries **product-fit** reasoning (distinct
from the channel-fit Legibility block in Format Specification): the one core wager, then the 2-4
load-bearing creative choices each traced to a real source — the ICP pain / VoC phrase
(`research/icp-research.md`), the brand voice/positioning (`BRAND.md` / `CREATIVE-DIRECTION.md`), or
the campaign tie-in. The bet must be **falsifiable** (what would make this video flop), so
`evaluate-shortform` can test it next cycle. No foundation → the convention's Absent state (general
principles only; never a fabricated pain or VoC quote). It stays short — it must not bury the brief.

## Review Gate block (hero only)

The hero `brief.md` ends with a `## Review Gate` block as its final section, after `## Variant Roadmap`:

```markdown
## Review Gate

- [ ] Approve
- [ ] Reject
- [ ] Suggest changes

Comments and suggested edits use Proof or inline CriticMarkup, depending on `review_tool`.
```

This is the human-review layer (reviewable-artifact contract; ceremony left in Git); the roughdraft-review protocol is only the optional Markdown UI fallback. The short-form brief is a `pipeline` artifact, so frontmatter `decision_state` defaults to `not_required` — most briefs are regenerable drafts. The block and the four review frontmatter fields ship in the hero template so the operator (or a loop) can opt a run into review by setting `decision_state: pending`. The operator checks exactly one box; the agent reads it to set `decision_state`. The block and review fields are additive and orthogonal — downstream consumers match sections by H2 heading, so a new trailing heading does not affect them.

## When critic catches a format violation

Critic FAIL → re-dispatch the named source agent with the specific format rule cited. Format violations are usually one-shot fixes; do not loop past cycle 1 for format-only issues unless the underlying craft is also failing.
