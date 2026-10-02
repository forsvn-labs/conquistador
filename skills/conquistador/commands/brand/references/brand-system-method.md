---
title: Brand-System Method
lifecycle: canonical
status: stable
produced_by: create-brand
load_class: PLAYBOOK
---

# Brand-System Method

## Why this skill exists

create-brand produces three complementary files — **BRAND.md** (narrative brand book), **DESIGN.md** (AI-readable spec), and **ASSETS.md** (per-platform production inventory) — from a small set of strategy + audience + competitive inputs. The output is the source of truth that every downstream marketing and product skill grounds against (`write-copy`, `create-paid-campaign`, `write-outreach`, `brief-landing-page`, `brief-graphic`, `plan-campaign`, `editorial-polish`, `polish-vietnamese`, `brief-shortform`, `map-user-flow`). Without a real brand system, downstream skills silently default to generic character output ("warm, friendly, trusted") and the work drifts off-brand cycle after cycle.

The orchestrator coordinates 8 specialized sub-agents across two layers: **Layer 1 parallel** (strategy + personality + voice + visual) lays the brand foundation; **Layer 2 sequential** (token-architect → component-token → accessibility → critic) builds the design system on top of the visual foundation. ASSETS.md is projected deterministically after the critic gate passes — no extra agent — by reading BRAND.md + DESIGN.md + declared platforms against `references/assets-inventory.md` templates.

This skill is the canonical producer of `.forsvn/artifacts/mkt/create-brand/{BRAND,DESIGN,ASSETS}.md` (ids `brand`, `design`, `assets`) when that store exists; when it does not, return the same artifacts inline and skip persistence. These are canonical artifacts (not pipeline outputs) — edited in place over time by humans and re-amended on major product pivots.

## Why this skill exists at all

Six failure modes it prevents:

1. **Generic character output.** "Warm, friendly, trustworthy" describes nobody specifically. Strategy + personality + voice agents work in parallel from real audience data; critic FAILs if values lack tradeoffs, if character priorities contradict, or if voice attributes have no Do/Don't examples.
2. **Aesthetics-before-strategy drift.** Color/font/radius chosen because they "look nice" with no trace to character. Visual-agent runs parallel with strategy-agent so the visual decision is already grounded in the brand brief; critic enforces strategy-to-visual traceability in scoring.
3. **Design system that isn't AI-readable.** A "design system" written as 4,000 words of prose can't be consumed by an AI coding agent and turned into on-brand UI. DESIGN.md is specification (tables, OKLCH values, CSS formulas, named animations with physics) — never prose-only. The "an AI reading this alone should produce on-brand UI" rule lives in critic Pass 2.
4. **Asset inventory drift.** Designers ship logos / favicons / app icons / OG cards without anyone tracking what's done vs missing. ASSETS.md auto-scans the `brand/` folder each run and emits per-row `[x]`/`[ ]`/`[~]`/`[!]` status; the Orphaned block preserves tracking state when a platform is dropped between runs.
5. **Per-platform sections invented or dropped silently.** Brand systems that pad with Android/Windows sections when the team only ships iOS, or drop the per-platform icon spec when "we'll figure it out later." Pre-Dispatch enumerates target platforms as mandatory Q6; strategy-agent + visual-agent + Step 8.5 ALL gate on the same declared list. Undeclared platforms MUST NOT appear in any artifact.
6. **Round-tripping Claude Design exports into `brand/`.** Renderings are derivative presentations, not source of truth. Step 9 emits them outside `brand/`. Re-running create-brand updates the source; Claude Design re-renders from updated source next session.

The structural answer is the **7-dimension critic rubric** (in `agents/critic-agent.md` — BRAND.md narrative quality / DESIGN.md AI-readability / strategy-to-visual traceability / character consistency / token system correctness / accessibility compliance / cross-element coherence). Threshold: average ≥3.5 across all dimensions AND no dimension below 3.

## Philosophy

Brand is a system of decisions, not a collection of artifacts. Every choice — radius, primary color, body font, voice attribute — has a reason that traces back to who the brand is for and what it stands against. The critic's job is to verify those traces.

BRAND.md is prose; DESIGN.md is specification. Never mix the registers. A brand book reads like a story a founder would share with investors. A design system reads like an API reference an engineer would implement against. The two files serve different audiences and use different conventions.

Three-layer token architecture is load-bearing for downstream usability. Primitives (raw OKLCH scales) → Semantic tokens (`--primary`, `--background`, `--card`, `--popover`) → Component tokens (`--button-primary-bg`). Skipping the semantic layer makes the design system unmaintainable. The bg/fg pair convention (`bg-primary text-primary-foreground`) is non-negotiable.

## Methodology

**Two-layer orchestration, deliberate.**

- **Layer 1 (parallel):** strategy-agent + personality-agent + voice-agent + visual-agent. Run simultaneously because they consume the same brief and produce non-overlapping sections of BRAND.md (plus visual-agent populates DESIGN.md §1-3 + §6-8 + §11 atmosphere/colors/typography/shadows/imagery/do's-don'ts and BRAND.md brand-mark).
- **Layer 2 (sequential):** token-architect-agent receives visual-agent output (colors + fonts + complete theme palettes) AND personality-agent output (chosen behaviors and boundaries); geometry remains visual-agent-owned. Component-token-agent receives token-architect output (semantic token map). Accessibility-agent receives token-architect + component-token outputs. Critic-agent receives the full assembled brand system.
- **Merge step between Layer 1 and Layer 2:** orchestrator assembles Layer 1 outputs into BRAND.md (11 sections) + DESIGN.md (sections 1-3 + 6-8 + 11). Coherence check before dispatching Layer 2.
- **Step 8.5 (after critic PASS, Route B only, deterministic — no agent):** project declared-platforms × `assets-inventory.md` templates into `.forsvn/artifacts/mkt/create-brand/ASSETS.md` when that store exists — otherwise emit the ASSETS.md content inline and skip persistence (stamps `id: assets`). Auto-scan `brand/` for file existence; preserve human `[~]`/`[!]` markers verbatim; move dropped-platform rows to `## Orphaned`.
- **Step 9 (optional):** Visual Renderings via Paper MCP artboards (9a), Claude Design handoff (9b), or none (9c).

**Two routes by scope.**

- **Route A — Quick Brand (MVP).** Dispatch only strategy + visual (color + typography only — logo deferred) + critic. Produces BRAND.md only. Target platforms still captured at intake as a one-liner so Route B picks them up later. Defers character, voice/tone, messaging architecture, token architecture, component tokens, accessibility audit, dark mode, ASSETS.md, Visual Renderings, per-platform Digital Touchpoints surfaces and icon specs.
- **Route B — Full Brand System.** Full pipeline. Produces BRAND.md + DESIGN.md + ASSETS.md.

**Two-cycle rewrite cap.** Critic FAIL → re-dispatch named agent(s) per the Rewrite Routing table (in `agents/critic-agent.md`) with feedback. Max 2 cycles. Cycle 2 FAIL → stop for the human: deliver the best attempt with the critic's concerns pinned verbatim for a human decision. The internal grade (`done_with_concerns`) records that the critic gate never passed — it is a score-band label, not a delivery authorization; it never authorizes publish/send/deploy, which stay behind explicit human approval.

**Palette ownership.** Visual-agent is authoritative for color choices and theme palette values. Token-architect systematizes them into the three-layer architecture and adds missing infrastructure tokens. On conflict, visual-agent wins.

**Accessibility hand-back.** Accessibility-agent OWNS the audit, NOT the fix. If the audit demands changes to upstream values (shadow color failing contrast, primary lightness failing 3:1 against `--primary-foreground`), it reports the failing pair to the critic, which fails the gate and re-dispatches the upstream owner (visual-agent / token-architect / component-token).

## Principles

- **Critical Gates are binary.** 5 gates so load-bearing that violation = re-dispatch BEFORE delivery. (1) No colors/fonts before strategy. (2) No Layer 2 before Layer 1 completes. (3) Don't skip critic's cross-element coherence check. (4) Stale upstream data >30 days → recommend re-running `research-positioning`. (5) BRAND.md is prose, DESIGN.md is specification — never mix registers.
- **Declared platforms gate per-platform content.** Target platforms enumerated at Pre-Dispatch (Q6) are the SINGLE source of truth for what appears in BRAND.md Digital Touchpoints, DESIGN.md Platform Icon Specifications, and ASSETS.md platform blocks. Undeclared platforms MUST NOT appear. Three-way platform-set equivalence is a critic gate.
- **ASSETS.md is living.** Overwrite `.forsvn/artifacts/mkt/create-brand/ASSETS.md` in place + increment the integer `version:` (prior versions in git history). Dropped-platform rows move to `## Orphaned` (preserved, not deleted). Never a `.v[N].md` sibling under `canonical/` — the UPPERCASE name grammar forbids dots. BRAND.md and DESIGN.md re-run the same way — overwrite in place + bump the integer `version:` (prior versions live in git history; no `.v[N].md` sibling under `canonical/`).
- **Human markers are sacred.** Auto-scan only flips `[ ]` ↔ `[x]` based on file existence. `[~]` (in progress) and `[!]` (blocked) are human-owned and preserved verbatim across re-runs.
- **No invented rows.** Every ASSETS.md row traces to BRAND.md / DESIGN.md / `platform-surfaces.md`. No invented assets.
- **Reference examples teach quality, not direction.** `example-brand.md` + `example-design.md` show structural quality (sections, depth, format). They are NOT a style guide. If output shares visual language with examples (glass surfaces, amethyst palette, geometric type) without justification from the brief, that's anchoring bias and the critic flags it.
- **Single-agent fallback exists.** If multi-agent dispatch is unavailable, execute each agent's instructions sequentially in-context per the same layer order.
- **The artifact IS the contract.** Three files with fixed schemas. Frontmatter + section structure + naming conventions live in `format-conventions.md`. Schema changes require atomic update across upstream callers.

## When NOT to use this skill

- **Need user flow mapping.** Use `map-user-flow` — screen-by-screen, not brand identity. user-flow consumes create-brand's design tokens and component context.
- **Need marketing copy.** Use `write-copy` — voice consumer, not voice definer. copywriting reads BRAND.md voice attributes + lexicon.
- **Need a single visual asset (social post, OG card, thumbnail).** Use `brief-graphic` — per-asset brief, consumes BRAND.md + DESIGN.md.
- **Need a landing page architecture.** Use `brief-landing-page` — page-level, consumes create-brand as ground truth.
- **Audience research missing.** Run `research-positioning` FIRST — brand without audience research → generic character priorities. create-brand flags this at Pre-Dispatch when `research/product-context.md` is absent.
- **Just need a logo.** create-brand produces a brand mark spec (commission/generation-ready description in BRAND.md) but does NOT render. Use a downstream renderer (Paper MCP, Claude Design, designer) to produce the asset.

## Further reading

- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) [PROCEDURE] — needed dimensions, read order, Warm/Cold Start prompts, Target Platforms catalog (13 platforms with disambiguation rules), Write-back map (7 dimensions × 4 experience files), Context to Pass to All Agents
- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) [PROCEDURE] — how to spawn a sub-agent, single-agent fallback, Layer 1 parallel dispatch table, Merge Step assembly tables (BRAND.md + DESIGN.md), Layer 2 sequential dispatch + palette ownership + accessibility hand-back, Critic Gate + rewrite loop, Step 8.5 ASSETS.md projection 7-step procedure (load prior state → project fresh inventory → auto-scan → merge human markers → compute summary → write → re-run versioning) + orchestrator self-check, Step 9 Visual Renderings (9a Paper MCP + 9b Claude Design + 9c None) with pre-flight checks + handoff message
- [`anti-patterns.md`](anti-patterns.md) [ANTI-PATTERN] — 13 create-brand failure modes (aesthetics without strategy, generic values, character confusion, voice without examples, token soup, skipping semantic layer, mismatched bg/fg, dark mode as inversion, dispatching all agents for Quick Brand, inventing ASSETS.md rows, overwriting human markers, silently dropping rows on platform drop, round-tripping Claude Design exports) + 4 cross-cutting marketing-stack patterns (upstream-context skipped, cross-stack contract drift, polish-chain misroute, undeclared platforms padded)
- [`format-conventions.md`](format-conventions.md) [PROCEDURE] — frontmatter schema (3 files), file naming + versioning rules, BRAND.md 11-section structure + Lexicon Rules block + Digital Touchpoints platform subsection format, DESIGN.md 11-section structure + Font Loading & Licensing table + Forbidden Icons YAML + Platform Icon Specifications block, ASSETS.md 5-section structure (Universal / Social & Sharing / Favicon & Web Metadata / Imagery & Illustration / per-platform blocks) + Legend + Summary + Orphaned block + checkbox marker semantics
- [`examples/brand-system-walkthrough.md`](examples/brand-system-walkthrough.md) [EXAMPLE] — Route B end-to-end walkthrough (FinLit personal finance app, 3 platforms: iOS + Web + Email, 8-agent dispatch, 74-row ASSETS.md projection) + Route A walkthrough (TaskFlow MVP, 2 platforms: Web + macOS, reduced critic, BRAND.md only)
- Domain catalogs (loaded by agents at dispatch): `references/{brand-character, brand-voice, visual-identity, token-architecture, token-templates, component-tokens, component-patterns, implementation-rules, platform-surfaces, typography-psychology, color-emotion, ai-slop-detection, paper-artboard-templates, artboard-generation, artifact-templates, assets-inventory}.md`
- Quality-bar examples: `references/{example-brand, example-design}.md`
- Shared: `references/anti-sycophancy.md, references/thin-critic-rubric.md, fallbacks/sequential.md`
- Agents: 8 sub-agents in `agents/` — see Agent Manifest in SKILL.md. `critic-agent.md` holds the canonical 13 + 13 + 4 gate checklist + 6-row Cross-Element Coherence Matrix + 7-dimension Scoring Rubric + 8-row Rewrite Routing table
- `marketing-skills/CLAUDE.md` §"Pre-Dispatch Protocol" + §"Complexity Routing" + §"Multi-Agent Skills" — stack-level conventions this skill inherits

## Character method revision

Current character contract is `brand-character-v1`; see [brand character](brand-character.md).
Old personality labels and percentage blends do not authorize visual mappings. Agent and artifact
contracts now record chosen behavior, basis, boundaries, and intended experiences as hypotheses.
Historical source methods are preserved privately and are not live instructions.
