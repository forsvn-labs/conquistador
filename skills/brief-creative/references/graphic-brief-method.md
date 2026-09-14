# Playbook — Brief-Creative

> Why this skill exists, philosophy, methodology, principles, scope boundary, when NOT to use, what it pulls from elsewhere, history.

[PLAYBOOK] — read once at first invocation; re-read when scope feels off.

## Why this skill exists

Most visual assets fail at one of three places: **brand fidelity** (the asset doesn't read as the brand it's supposed to be), **platform fitness** (the asset breaks at the platform's crop / format / mobile readability), or **downstream ambiguity** (the brief was vague, the renderer guessed, the result drifted). Design-brief exists to close all three: every visual decision binds to a brand anchor in DESIGN.md AND to a platform constraint AND to a downstream-route-specific handoff spec (image-gen prompt / vector-tool grid / designer-handoff sheet).

The brief is the deliverable. Rendering happens downstream — Claude Design / Midjourney / Imagen / DALL·E / Pencil / Figma / a human designer. Quality of the rendered asset is bounded by quality of the brief.

## Core philosophy

**A great brief eliminates downstream ambiguity.** Render quality is bounded by brief quality — a vague brief produces drift no matter how good the renderer. The brief is the deliverable; every visual decision binds to a brand anchor and a platform constraint.

**Brand fidelity > aesthetic novelty.** A boring on-brand brief beats a striking off-brand one.

**Platform fitness > generic polish.** The asset has to survive the platform it ships on — IG's crop behavior, YouTube's thumbnail size at 100px, LinkedIn's document-post navigation. Platform-aware specs are non-optional, not nice-to-have.

**Stock-AI defaults are a tax.** Default purple-blue gradients, centered-isolated-on-white, glassmorphism, faux-3D bevels — these are signals the brief was lazy. Critic-agent runs a 13-pattern detector specifically because LLMs trained on AI-generated images regress toward these patterns silently.

## Methodology

The full standalone production mode is a **multi-stage interactive orchestrator** with two human-
approval gates. Those gates protect render or production spend. A bounded inline parent-composed brief
is advisory: it may use supplied facts/tokens, return one concept, and stop before execution without
brand files, three candidates, or intermediate approval.

```
Pre-Dispatch (standalone production: hard gate on BRAND.md + DESIGN.md; bounded inline: supplied source)
  ↓
Step 0.5: Route Detection (auto-detect downstream-route from asset type)
  ↓
LAYER 1 (parallel): brand-anchor + concept + copy-anchor
  ↓
LAYER 1.5: brief-synth → 3 candidate briefs
  ↓
APPROVAL GATE 1: user picks A / B / C / revise / switch route / stop
  ↓
LAYER 2 (route-dependent): prompt-craft OR figma-spec OR (none for vector-tool)
  ↓
LAYER 3: critic-agent (visual rubric + AI-aesthetic detector + platform-fit)
  ↓
APPROVAL GATE 2: user approves / revises / rejects
  ↓
Write artifact + ASSETS.md auto-tick (literal path match only)
```

Multi-agent value here: **brand specialist + concept variety (3 distinct options) + format-aware synth + route-specific handoff + critical evaluator** — five different lenses, each with a focused contract. Single-agent fallback collapses all five into one inline pass with the same critic rubric self-applied.

## Three guiding principles

1. **Match the brand gate to delivery mode.** Standalone asset production requires the applicable
   brand artifacts before rendering. Bounded inline parent composition may use supplied brand facts
   and semantic tokens; missing visual values or assets are labeled execution gaps, not invented and
   not a reason to suppress the brief.
2. **Never invent tokens.** Every color, font, spacing token traces to DESIGN.md. If DESIGN.md doesn't cover what's needed (e.g., illustration style for an asset DESIGN.md never anticipated), flag it in the brief — don't guess. Expanding DESIGN.md is `create-brand`'s job.
3. **Approval follows consequence.** Both approval gates remain mandatory before standalone render or
   production. They do not interrupt a bounded advisory brief whose terminal Review Packet explicitly
   stops before implementation, publication, or external action.

## Scope boundary

**In scope:** per-asset graphic-design briefs — social posts (IG carousel / post / story, LinkedIn doc / single, FB ad), thumbnails (YouTube, X card), banners / display ads, OOH / billboard, OG / share cards, hero illustrations. Platform-aware specs (aspect ratio, safe zones, type scale, contrast, file format, size cap, anti-patterns). Image-gen prompt OR vector-tool layout grid OR designer-handoff sheet OR per-format template pack.

**Out of scope:**
- **Rendering the asset** — brief-creative produces the BRIEF; downstream tools render. (Claude Design / Midjourney / Imagen / DALL·E / Pencil / Figma / human designer.)
- **Brand identity definition** → use `create-brand`. Design-brief CONSUMES brand/BRAND.md + brand/DESIGN.md; it does not produce or modify them. Inventing palette / typography / motion tokens for an asset = anti-pattern.
- **Whole-page redesigns** → use `brief-landing-page`. Design-brief is per-asset; lp-brief is per-page (with per-asset slots it can route to brief-creative).
- **Writing the copy that goes IN the asset** → use `write-copy`. Design-brief composes the asset around copy; copywriting writes the headline / body / CTA.

## When NOT to use

- A standalone render or production request lacks the brand source needed to execute faithfully. A
  bounded inline advisory brief may proceed with supplied facts and labeled gaps.
- The request is to render an asset, not to brief one. brief-creative is brief-only; rendering happens downstream.
- The user wants an entire page or interface. Use `brief-landing-page` (per-page) or coordinate with the design system rather than producing isolated per-asset briefs.
- The user wants brand identity work (logo, palette, voice). Use `create-brand`; brief-creative produces no brand decisions, only applies them.
- The asset is a wireframe / interface mockup. brief-creative targets graphic assets, not UI flows. Use `map-user-flow` for screen mapping; use `architect-system` for UI architecture.

## What it pulls from elsewhere

- `brand/BRAND.md` — voice, brand character, required elements (from `create-brand`)
- `brand/DESIGN.md` — palette, typography, surface language, motion (from `create-brand`)
- `brand/ASSETS.md` — per-platform production inventory; pre-fills format/dimensions if asset matches a row, auto-ticks checkbox on completion (from `create-brand`)
- `.forsvn/artifacts/mkt/lp-brief/[slug]/asset-slots/[slot-id].md` — slot spec when brief is for an LP asset (from `brief-landing-page`)
- `.forsvn/artifacts/mkt/content/[slug].copy.md` — copy used IN the asset (from `write-copy`)
- `.forsvn/artifacts/mkt/campaign-plan.md` — campaign context, channel placement, awareness stage (from `plan-campaign`)
- `research/icp-research.md` — audience visual preferences (from supplied audience research)
- `references/asset-types.md` — per-asset format specs
- `references/platform-modules.md` — production checklists; verify platform requirements and vendor specifications for the selected output.
- `references/prompt-patterns.md` — image-gen prompt structures + tool → asset type table
- `references/visual-rubric.md` — critic scoring dimensions + 13-pattern generic-AI-aesthetic detector
- `references/failure-modes.md` — generic-AI catalog + brand drift patterns
- `references/examples.md` — end-to-end worked examples per asset type

## Downstream consumers

The brief at `.forsvn/artifacts/mkt/brief-creative/[slug].md` is consumed by:

- **Image-gen tools** (Claude Design / Midjourney / Imagen / DALL·E / Ideogram / Veo / Suno) — read the Image-Gen Prompt block when `downstream_route: image-gen`
- **Vector tools** (Pencil / Figma) — read the Layout Grid + Component References block when `downstream_route: vector-tool`
- **Human designers** — read the Designer-Handoff Spec block when `downstream_route: designer-handoff`
- **`brief-landing-page`** — when a landing-page asset slot needs a per-asset brief, lp-brief invokes brief-creative on the slot
- **ASSETS.md auto-tick** — completion of a brief with a literal-path match in ASSETS.md flips `[ ]` → `[x]`
