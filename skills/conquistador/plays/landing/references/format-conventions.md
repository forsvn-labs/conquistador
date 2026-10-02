---
title: LP-Brief Format Conventions
lifecycle: canonical
status: stable
produced_by: lp-brief
load_class: PROCEDURE
---

# LP-Brief Format Conventions

> Format rules for the optional file-mode lp-brief artifact and requested companions. Bounded inline
> delivery uses the workflow Review Packet and does not inherit the file schema or line envelope.

## Output locations

| Path | When | Lifecycle |
|---|---|---|
| `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/brief.md` | File mode only, after its configured review boundary | pipeline |
| `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/handoff-implementation.md` | Only when an implementation handoff is requested | pipeline |
| `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/handoff-claude-design.md` | When `target_handoff` lists `claude-design` | pipeline |
| `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/handoff-figma.md` | When `target_handoff` lists `figma` | pipeline |
| `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/handoff-designer.md` | When `target_handoff` lists `designer` | pipeline |
| `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/asset-slots/{slot-id}.prompt.md` | Per generative slot, written by `brief-graphic` (not by lp-brief itself) | pipeline |
| `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/rejected.md` | When user rejects at Approval Gate 3 | pipeline (terminal) |
| `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/v[N]/brief.md` | Re-run with `--rev=N`; prior versions preserved | pipeline (versioned) |

## File naming + versioning

- **slug** is the page route normalized: `/pricing` → `pricing`, `/services` → `services`, `q3-launch-lp` → `q3-launch-lp`. Slashes stripped.
- **Re-run with `--rev=N`:** writes `v[N]/brief.md`. Prior versions preserved in their own `v[N-1]/` folder. The orchestrator reads `v[N-1]/brief.md` as the prior context for the new run.
- **Single-cycle re-run without `--rev`:** overwrites in place (use sparingly — loses prior history).
- **Rejected briefs:** saved as `rejected.md` at the slug root (not in a `v[N]/` folder) — terminal state, not versioned.

## Completeness by delivery scope

Inline delivery has no line minimum or companion requirement. File-handoff includes the schema and
sections needed for execution. Judge completeness by finished copy, evidence boundaries, actions,
assets, selected target, and acceptance checks, not line count. Do not pad a brief to pass review.
Use `landing-decision-review-v1` and record applicable LP checks; historical CP scores are retired.

## Concerns pinning (DONE_WITH_CONCERNS only)

When status = `done_with_concerns` (cycle-2 residual critic FAIL), the `## Concerns` section is **pinned at top of brief.md** above the body so downstream operators see them before reading the brief body. Critic scores ALSO appear in frontmatter `critic_scores`. No silent FAIL outputs — every critic concern visible in the artifact.

Format (verbatim from brief template):

```markdown
## Concerns (only present if status = done_with_concerns)

> Pinned at top so downstream operators see them before reading the brief body.
>
> **Conversion critic:** [score / verdict] — [each FAIL bullet, verbatim from critic]
> **Brand-voice critic:** [score / verdict] — [each FAIL bullet, verbatim from critic]
>
> Decide before execution: ship as-is, revise manually, or kill.
```

## Frontmatter schema (17 fields)

```yaml
---
skill: brief-landing-page
version: 1
date: [today]
status: [done | done_with_concerns | blocked | needs_context]
stack: marketing
review_surface: md         # html | md | none
decision_state: not_required # pending | approved | denied | suggested | not_required
review_tool: inline        # proof | inline | roughdraft | none
reviewed_at:               # YYYY-MM-DD — empty until reviewed
reviewer:                  # who recorded the review — empty until reviewed
page_route: [/pricing | /services | etc.]
tier: [primary | secondary]
rev: [N — what revision this is]
hypothesis_title: [from approved hypothesis]
target_handoff: [claude-design | pencil | figma | designer | null | list of any]  # specialty design-tool targets only
selected_target: [public-landing | desktop | null]  # desktop-test is this field only; never a target_handoff value
brand_anchors:
  primary_color: [hex with token name]
  primary_type: [font, weight]
  surface: [paper / matte / glass-if-DESIGN.md-permits]
sacred_respected: [list]
critic_scores:
  conversion: [N/M]
  brand_voice: [N/M]
shared_skill_chain: [path to project's _prompts.md if referenced]
provenance:
  skill: brief-landing-page
  run_date: [today]
  input_artifacts:
    - [brand/BRAND.md, brand/DESIGN.md, research/icp-research.md as relevant]
    - [.forsvn/loops/<slug>/context.md if scoped to a loop, otherwise omit]
  output_eval: null  # set by downstream evaluate-landing-page when a cycle scores this brief
---
```

`provenance:` is the **generation-provenance** variant per `format-conventions.md § provenance: — two variants`. Required because `evaluate-landing-page` reads `provenance.input_artifacts` to ground scoring and the promotion script walks `output_eval` to verify the artifact → eval → learning chain.

Date format: ISO `YYYY-MM-DD`. `target_handoff` accepts a single value, list, or `null`. Null skips all
companion handoffs. An implementation prompt is emitted only when requested.

The four `decision_state` / `review_tool` / `reviewed_at` / `reviewer` fields are the human-review layer per [`reviewable-artifact-contract`](../../../../brief-creative/references/reviewable-artifact-contract.md). This is a `pipeline` artifact, so `decision_state` defaults to `not_required` — most briefs are regenerable drafts. The fields and the `## Review Gate` body block ship in the template so the operator (or an eval loop) can opt a run into review by setting `decision_state: pending`; the procedure for running that review is [`roughdraft-review-protocol`](../../../../brief-creative/references/roughdraft-review-protocol.md). Review fields apply to the main `brief.md` artifact only — not the `handoff-*.md` companions or `asset-slots/*.prompt.md` files. They are flat by design (the `manifest-sync` parser reads flat YAML) and additive/orthogonal to the existing schema — adding them does not change how downstream consumers read the brief.

## Body section structure (15 sections, in order)

1. **Title + Page/Tier/Rev/Hand-off-target heading block** — H1 + 4 bold lines
2. **Concerns** — only present if status = done_with_concerns (pinned at top)
3. **IMC Context** — 1–3 lines: where this page sits in the campaign
4. **Hypothesis (Approved)** — Basis + proposed change + test + cost/risk
5. **What Changed from rev N-1** — bullet list, only present if rev > 1
6. **Page Architecture** — Surface Rhythm + Section List + ASCII Diagram + Scroll Velocity Plan
7. **Section-by-Section Spec** — per-section: purpose + finished headline and optional decision alternative + subhead + CTA + visual + layout + motion + conversion-checklist
8. **Asset Slots** — table with Slot / Section / Dimensions / Format / File path / Fallback / Generation prompt columns + per-slot prompt-file note
9. **What NOT to Do** — sacred elements + page-specific failure modes + voice violations
10. **Implementation companion** — optional pointer when an implementation handoff was requested
11. **Hand-Off (Specialty Targets)** — optional; only when `target_handoff` lists `claude-design` / `pencil` / `figma` / `designer`. Per-target prompt block + an **Iteration Guide** (follow-up-prompt guardrail per `design-handoff-prompting.md`). Omit entirely when `target_handoff` is null.
12. **Pre-flight Checklist** — 5 GFM checkboxes
13. **Skill Chain** — referenced (if project has shared chain doc) OR generated per-page inline (no project-level default created)
14. **Launch Plan + Results + Why This Works** — 3 short closing sections
15. **Review Gate** — optional file-mode review block. It records a human decision when the operator
opts the artifact into review; it is not a prerequisite for producing an inline brief.

## Full artifact template (byte-identical)

> This is the canonical brief.md template. Sub-agents (section-spec, asset-slot, handoff) populate it; orchestrator assembles. Schema changes require atomic update across upstream callers (campaign-plan if it inlines brief structure) + downstream consumers (design-brief reads Asset Slots; coding agents read Implementation Prompt companion; lp-eval reads loop-local strategy artifacts that may reference brief.md).

Save to `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/brief.md`:

```markdown
---
skill: brief-landing-page
version: 1
date: [today]
status: [done | done_with_concerns | blocked | needs_context]
stack: marketing
review_surface: md         # html | md | none
decision_state: not_required # pending | approved | denied | suggested | not_required
review_tool: inline        # proof | inline | roughdraft | none
reviewed_at:               # YYYY-MM-DD — empty until reviewed
reviewer:                  # who recorded the review — empty until reviewed
page_route: [/pricing | /services | etc.]
tier: [primary | secondary]
rev: [N — what revision this is]
hypothesis_title: [from approved hypothesis]
target_handoff: [claude-design | pencil | figma | designer | null | list of any]  # specialty design-tool targets only
selected_target: [public-landing | desktop | null]  # desktop-test is this field only; never a target_handoff value
brand_anchors:
  primary_color: [hex with token name]
  primary_type: [font, weight]
  surface: [paper / matte / glass-if-DESIGN.md-permits]
sacred_respected: [list]
critic_scores:
  conversion: [N/M]
  brand_voice: [N/M]
shared_skill_chain: [path to project's _prompts.md if referenced]
provenance:
  skill: brief-landing-page
  run_date: [today]
  input_artifacts:
    - [brand/BRAND.md, brand/DESIGN.md, research/icp-research.md as relevant]
    - [.forsvn/loops/<slug>/context.md if scoped to a loop, otherwise omit]
  output_eval: null
---

# Landing-Page Brief: [Title]

**Page:** [route + name]
**Tier:** [primary / secondary]
**Rev:** [N — what changed from rev N-1, if applicable]
**Hand-off target:** [Claude Design / Figma / designer]

## Concerns (only present if status = done_with_concerns)

> Pinned at top so downstream operators see them before reading the brief body.
>
> **Conversion critic:** [score / verdict] — [each FAIL bullet, verbatim from critic]
> **Brand-voice critic:** [score / verdict] — [each FAIL bullet, verbatim from critic]
>
> Decide before execution: ship as-is, revise manually, or kill.

## IMC Context

[1–3 lines: where this page sits in the campaign, traffic source, awareness stage, role in funnel.]

## Hypothesis (Approved)

**Claim:** [single sentence — falsifiable]
**Basis:** [observed source or explicit assumption]
**Test:** [supporting/challenging observation; unrun until executed]
**Cost/risk:** [dependencies and possible harm]
**Why this:** [argument tied to evidence signals or audience signals]
**What we're betting:** [the falsifiable bet — what success looks like, what failure looks like]

## What Changed from rev N-1 (if rev > 1)

[Bullet list — only present if --rev=N. Tied to page-state changes, post-launch evidence, or new ICP signals.]

## Page Architecture

### Surface Rhythm

[3–5 lines: how the page reads at scroll speed. Fast / slow / pause beats.]

### Section List

1. **Hero** — [purpose + headline pull]
2. **[Section name]** — [purpose]
...
N. **CTA Block** — [purpose]

### ASCII Diagram

```
┌─────────────────────────────────────┐
│  HERO    [headline]    [hero CTA]   │  ← 100vh, low velocity
├─────────────────────────────────────┤
│  VALUE PROP — 3 columns             │
├─────────────────────────────────────┤
│  SOCIAL PROOF — logo grid + quote   │
├─────────────────────────────────────┤
│  ...                                 │
└─────────────────────────────────────┘
```

### Scroll Velocity Plan

| Section | Velocity | Why |
|---------|----------|-----|
| Hero | Slow / pause | First-impression gate |
| Value prop | Medium | Argument scan |
| Social proof | Slow | Decision moment |
| Features | Fast | Detail layer |
| Objection | Slow | Decision blocker |
| CTA | Pause | Action moment |

## Section-by-Section Spec

### 1. Hero

**Purpose:** [first-impression conversion gate]

**Headline:** "[finished copy]"
**Decision rationale:** [question answered, evidence boundary]
**Alternative (only if useful):** [different decision emphasis and what would choose between them]

**Subhead:** "[copy]"

**Hero CTA:** "[copy]" — primary, accurate destination and commitment

**Visual:** [reference to asset slot — see Asset Slots section]

**Layout:**
- Heading: [type token, size]
- Subhead: [type token, size]
- CTA position: [above-fold, button style, contrast pair]
- Background: [hex / asset slot]

**Motion:** [duration token from DESIGN.md if applicable; static otherwise]

**Review checklist (`landing-decision-review-v1`):**
- LP-01/02: reader task and actual offer clear; cite wording
- LP-03: action label matches destination and commitment
- LP-05: supplied entry promise preserved or traffic assumption marked
- LP-09/11: evidence and assurances supported; missing items visible
- LP-13: comprehension check planned or actually recorded, never assumed executed
- Voice: supplied brand constraints respected

### 2. [Next Section]

[Same structure: visitor question, finished copy, evidence boundary, action, visual, layout, motion, applicable LP checks.]

[Continue per section...]

## Asset Slots

| Slot | Section | Dimensions | Format | File path | Fallback | Generation prompt |
|------|---------|-----------|--------|-----------|----------|-------------------|
| Hero image | Hero | 1920×1080 | WebP | `growth/[slug]/hero.webp` | solid #004700 | [link to prompt template, see asset-slots/] |
| Logo grid | Social proof | 6 cells × 60px | SVG | `growth/[slug]/logos.svg` | "delete cell if not real" | — |
| Founder portrait | Story | 600×600 | WebP | `growth/[slug]/founder.webp` | spot illustration | [link if generative] |

**Generation prompts** for asset slots that use generative AI live at `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/asset-slots/[slot-name].prompt.md`. Each is written by `brief-graphic` against the slot's spec — the prompt is the actionable handoff to an image-generation tool.

## What NOT to Do

- [Sacred element 1 — verbatim "do not touch" line]
- [Sacred element 2]
- [Page-specific failure mode — e.g., "do not use stock-photo office imagery; ICP rejects it"]
- [Voice violations — e.g., "no leverage / unlock / seamlessly anywhere"]

## Implementation companion (requested)

> Emit as a companion only when the user requests an implementation handoff. Otherwise omit it.
>
> - **handoff_mode:** `[unresolved | verified | desktop-test]`
> - **Stack:** `[detected framework | unresolved]` — verified from the **mode's tree** at write time; never a silent vanilla default
> - **Motion stack:** `[the tree that mode selected | unresolved]`
> - **Recipients:** unresolved = argument; verified = any frontier coding agent; desktop-test = stack-targeting result only

## Hand-Off (Specialty Targets)

> Optional — only present when `target_handoff` lists `claude-design` / `pencil` / `figma` / `designer`. **Omit this entire section when `target_handoff` is null.** The implementation companion is emitted only when requested; these are supplements for projects that also use a design tool or human designer.

### To: [Claude Design / Figma / designer]

**Prompt block (paste verbatim):**

```
[Hand-off prompt composed by handoff-agent — opening clears the 9 Required Fields
and repeats DESIGN.md visual values verbatim, per references/design-handoff-prompting.md]
```

### Iteration Guide (design-tool targets only)

> Operator note for the follow-up prompts after the opening block above. Omit when `target_handoff` is `null` or coding-agent only. Moves classified by the edit-prompt taxonomy in `references/design-handoff-prompting.md`.

- **Refinement** (expected): [the one property the operator will likely adjust first — e.g., "hero vertical padding"]
- **Additive** (expected): [the next section or component likely to be added]
- **Corrective** (if it drifts): [the constraint most at risk — e.g., "restore matte surfaces"]
- **Do NOT type:** broad meta prompts ("reconsider the page", "rethink the layout") — the tool reads them as discard and the session rarely recovers. To restart, paste a full new opening block.

### Pre-flight Checklist

- [ ] All copy in brief is final (or marked "candidate — pick one")
- [ ] All asset slots have file paths and fallbacks
- [ ] All sacred elements listed under What NOT to Do
- [ ] Critic scores both ≥ pass threshold
- [ ] Shared skill chain referenced (if project uses one) — not duplicated

## Skill Chain

**If project has a shared chain doc:** "See `growth/page-redesigns/_prompts.md` § Phase A — Hero Build" (etc.). List only page-specific overrides under each referenced phase.

**If project does not:** generate a per-page chain inline — list the downstream skills/prompts in execution order, each with one-line scope:

1. `brief-graphic` — spec hero asset (slot: `hero-image`), then run image-gen against the produced prompt at `asset-slots/hero-image.prompt.md`
2. `write-copy` — review finished headline for evidence, clarity, and supplied voice
3. [implementation step — Claude Design / Figma / designer]
4. `humanmaxxing` — final pass on any AI-generated body copy
5. [post-launch] collect analytics/recordings/experiment notes → run `evaluate-landing-page` inside the page's eval loop, then feed the resulting eval into next `lp-brief --rev=N`

Page-scoped only. No project-level default is created.

## Launch Plan

[3–5 lines: when, traffic ramp, instrumentation (UTMs, events to fire), success criteria from hypothesis.]

## Results (filled post-launch)

[Empty until launched. After: actual metrics, hypothesis verdict, what to take into rev N+1.]

## Why This Works (sanity check)

This is the why-this-works block per [`_shared/why-this-works-convention.md`](../../../../write-social/references/why-this-works-convention.md) — placed correctly (after the artifact spec, before the Review Gate). **Product-fit, not generic** (2–4 lines): the bet (the hypothesis, stated so it can fail), then the load-bearing arguments — why *this* hero / architecture / CTA hierarchy lands the hypothesis for *this* product — each traced to a source (`ICP.md` pain/VoC, `BRAND.md`/`CREATIVE-DIRECTION.md`, the campaign plan). Each line must explain why this change addresses the supplied task; uniqueness is not required. No ICP/brand foundation → the convention's Absent state (general principles only; never a fabricated pain or positioning claim).

## Review Gate

- [ ] Approve
- [ ] Reject
- [ ] Suggest changes

Comments and suggested edits use Proof or inline CriticMarkup, depending on `review_tool`.
```

> Re-run with `--rev=N`: write to `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/v[N]/brief.md`, preserve prior versions.

## Companion file conventions

### `handoff-implementation.md` (requested implementation handoff only)

Mode-dependent companion from `handoff-formats.md`. **Not** a universal coding-agent block.

**Stack detection at write time:**
- **Public landing:** **repo root only** — root `package.json` and root `next.config.*` /
  `vite.config.*` / `astro.config.*` / `svelte.config.*` / `nuxt.config.*`. Do **not** recurse into
  `app/desktop`. Nested desktop Vite does not verify a public landing.
- Root framework found → `handoff_mode: verified` (that stack).
- No root framework, user did not name one → `handoff_mode: unresolved`; do not emit an `index.html` layout.
- **Desktop-test:** only when `selected_target` is `desktop`. Then read `app/desktop/package.json` and
  `app/desktop/vite.config.*`. Never inferred from `target_handoff`.
- **Motion:** design source, or the tree that mode selected (`motion` is valid). If that tree is silent,
  leave motion unresolved. Unresolved mode does not pin a recipe.

Must include from `references/handoff-formats.md` **for that `handoff_mode`** (owner: Canonical
closings + templates there). G8b scores the matching mode. It does not apply the verified
blueprint to unresolved or desktop-test.

- **unresolved:** argument opener + unresolved closer. No Asset Placeholder CSS, no (BUG FIX)
  recipes, no verified closer.
- **verified:** Asset Placeholder Rule verbatim; "Invent or substitute asset URLs" in DO NOT;
  verified closer from Canonical; (BUG FIX) where those mechanics appear.
- **desktop-test:** test opener + desktop closer. No verified Implement opener, no verified closer,
  no Asset Placeholder CSS, no `(BUG FIX)` recipes, no 200–350 SECTION BLUEPRINT.

### `handoff-{claude-design,figma,designer}.md` (optional per `target_handoff`)

Per-target hand-off prompt block. The opening of each block follows the design-tool opening-prompt protocol in `references/design-handoff-prompting.md`: clear all nine Required Fields and **repeat the exact visual values from `DESIGN.md` verbatim** (palette hex + token names, type, spacing, surface, motion) — the design tool will not apply an already-approved system on its own. Lift sacred elements + voice rules verbatim from brand_digest into each — never paraphrase. Brand-voice critic G8 FAILs on paraphrase, on missing visual values in a design-tool opening, or on a design-tool target with no Iteration Guide in the brief.

### `asset-slots/{slot-id}.prompt.md` (written by downstream `brief-graphic`)

Per-asset generation prompt for image-gen / vector-gen tools. Written by `brief-graphic` against the slot's spec from `Asset Slots` table. lp-brief itself does NOT write these — slots with `route: pending-media-skill` have no prompt file yet. **Verified** implementation prompts render those slots as solid-color placeholders until the appropriate media-briefing skill catches up. Unresolved and desktop-test do not carry that CSS recipe.

## Cross-stack contract

This skill produces:
- `brief.md` — consumed by human designers + coding agents + `brief-graphic` (per slot) + indirectly by `evaluate-landing-page` cycles (when the brief is referenced from a loop's `strategy/` directory)
- `handoff-implementation.md` — consumed per `handoff_mode` (argument, verified coding-agent, or desktop-test)
- `handoff-{target}.md` — consumed by Claude Design / Figma / designer
- `asset-slots/{slot-id}.prompt.md` paths — written by `brief-graphic`; lp-brief just declares the slot IDs

Schema changes (frontmatter fields, body section structure, table column structures, companion file naming) require atomic update of `format-conventions.md` + downstream callers — never silently drift.
