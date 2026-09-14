# Sequential fallback

Use when the host cannot run strategy, personality, voice, visual, token-architect, component-token,
accessibility, and critic as separate agents.

Keep the same method. Change only the machinery.

## Hard blocks

Stop before drafting when:

- target platforms (Q6) are unresolved — ask the operator to enumerate (never accept "cross-platform" /
  "everywhere" / "mobile" without naming hosts). If after asking the operator still cannot name
  hosts, do not dead-end: proceed with an explicitly labeled assumed set — use only the surfaces
  implied by the request, or `Web + Email` when none are implied —
  product clearly implies otherwise — record it in BRAND.md as `Platforms assumed, pending operator
  confirmation`, and flag every platform-projected output as needing confirmation. The three-way
  platform-set equivalence still holds against this assumed set; a later confirmed declaration
  replaces it.
- the product described is not owned by the operator (this skill builds identity for owned products;
  competitor teardowns belong to `research-positioning`).

Strongly recommend `research-positioning` first when both product-context and ICP research are
absent. If the operator insists, continue and label character output as provisional.

Warn (do not block) when upstream research artifacts are older than 30 days; recommend a fresh
`research-positioning` run.

`--fast` collapses to Route A only. It does **not** skip Cold Start, hard blocks, or the critic.

## Intake (7 dimensions)

Resolve before any lens runs:

1. Product — one line: what it does, who pays.
2. Audience — primary persona + 1–2 pains.
3. Competitive landscape — 3–5 brand names (compete with or admire / anti-admire).
4. Voice intuition — 3 adjectives or one reference brand.
5. Aesthetic intuition — 3 visual references.
6. Target platforms — mandatory multi-select from: Web, iOS, iPadOS, Android, macOS, Windows, Linux
   desktop, watchOS/Wear OS, tvOS, CarPlay/Android Auto, Browser extension, CLI/terminal, Email,
   Embedded app. Disambiguate shells and hosts before accepting.
7. Positioning intent — premium / accessible / disruptive / trusted.

Keep answers inline by default. When the host provides durable context storage and the operator wants
it, use the host's existing product, audience, brand, business, and technical fields.
Per-run inventiveness stays out of the experience store.

## Sequence

Choose Route A (Quick Brand) when the ask is MVP foundation or `--fast` is set. Choose Route B (Full
Brand System) otherwise.

### Route A

1. Run `agents/strategy-agent.md` (foundations + narrative; platforms still declared).
2. Run `agents/visual-agent.md` for color + typography only (logo deferred).
3. Merge into a `BRAND.md`-shaped prose section. Return it inline unless the host supplies a durable
   destination and persistence was requested.
4. Gate with `agents/critic-agent.md` on strategy↔visual coherence and BRAND narrative quality.
5. On FAIL, re-work the named unit (max 2 cycles). Cycle-2 FAIL → stop for the human: deliver the
   best attempt with the critic's concerns pinned verbatim for a human decision. The internal grade
   (`done_with_concerns`) records the standing failure — it never authorizes publish/send/deploy,
   which stay behind explicit human approval.

### Route B

1. Layer 1 as sequential passes: `strategy-agent`, `personality-agent`, `voice-agent`,
   `visual-agent`. Load matching references (`brand-character`, `brand-voice`, `color-emotion`,
   `typography-psychology`, `visual-identity`, `platform-surfaces`, `narrative-tension`).
2. Merge into BRAND.md + DESIGN.md draft sections. Coherence-check before Layer 2.
3. Layer 2 as sequential passes: `token-architect-agent` → `component-token-agent` →
   `accessibility-agent`.
4. Gate with `critic-agent` (full checklist + cross-element coherence + AI-slop). Load
   `references/ai-slop-detection.md`, `references/anti-patterns.md`, and
   `references/anti-sycophancy.md`.
5. On PASS: project ASSETS.md from declared platforms × `references/assets-inventory.md`. Preserve
   human `[~]` / `[!]` markers. Move dropped-platform rows to `## Orphaned`.
6. Optional Step 9 renderings stay outside `brand/` source of truth
   (`references/brand-kit-rendering.md`, `references/artboard-generation.md`).

## Critical gates (binary)

1. No colors/fonts before strategy grounding.
2. No Layer 2 before Layer 1 completes.
3. Critic cross-element coherence is mandatory.
4. Stale upstream (>30 days) → recommend `research-positioning`.
5. BRAND.md is prose; DESIGN.md is specification — never mix registers.

## Deliverable

Return the artifacts inline by default. If the host supplies a durable artifact location and the
operator asks for persistence, write the same artifacts there:

- Route A: `BRAND.md`
- Route B: `BRAND.md`, `DESIGN.md`, `ASSETS.md` (+ optional `CREATIVE-DIRECTION.md` / `FRAME.md` when
  those layers are in scope)

Follow `references/format-conventions.md` and `references/brand-system-method.md`. Run the application
acceptance check on homepage hero, product description, and social introduction from the live
SKILL.md front door.

Label this single-context. Do not call it independent corroboration. Do not invent product claims,
customer evidence, or endorsements. No sibling outcome or canonical project tree is required.
Publication and external writes stay behind explicit approval.
