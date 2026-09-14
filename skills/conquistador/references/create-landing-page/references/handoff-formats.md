# Hand-Off Formats — Per-Tool Prompt Patterns

> Catalog of hand-off prompt patterns: one requested implementation companion (three `handoff_mode`s) plus four specialty design-tool targets. Each pattern names: structure, length, what to lift verbatim, what to compress, common failure modes.
>
> **Use:** when handoff-agent runs, look up the target's pattern here. Compose the prompt block to match.

---

## Implementation companion (requested handoff — three modes)

**Verified mode tool:** Any frontier coding agent — Claude Code, Cursor, Codex, etc.
Unresolved and desktop-test are not coding-agent blueprints.

**When to use:** Only when the user requests an implementation handoff. A bounded inline page brief
does not emit this file or choose a downstream executor.

**Owner of closings and numbering:** this section. Other files point here. Do not paste a second
closer. Do not invent a "Tested on" line.

Three `handoff_mode` values. Each has its own template. A warning next to the wrong template is not
a mode.

| `handoff_mode` | When | Length | Template |
|---|---|---|---|
| `unresolved` | Public-landing detection at **repo root** finds no framework, and the user did not name one | ~40–80 lines | Needs-input / page argument. **Not** a coding-agent blueprint. |
| `verified` | Public-landing detection at **repo root** verifies a framework | ~200–350 lines | Coding-agent implementation blueprint. |
| `desktop-test` | Operator **selected** desktop (`selected_target: desktop` only). Never inferred by globbing `app/desktop` or by putting `desktop` on `target_handoff`. | ~40–80 lines | Stack-targeting test of `app/desktop`. **Not** a public marketing site inside desktop. |

**Canonical closings (verbatim, one per mode, never combine):**

- Unresolved: `Do not emit code, a file layout, or a chosen stack. Return the page argument and the unresolved inputs only.`
- Verified: `Write production-ready, flawless code. Do not truncate. Do not use placeholder copy or invented imagery (asset placeholders only follow the Asset Placeholder Rule in numbered section 2).`
- Desktop-test: `Do not implement a public marketing site inside the desktop app. Return the stack-targeting result only.`

**Stack detection (handoff-agent runs at write time):**
- **Public landing (default):** read **repo root only** — root `package.json`, root `next.config.*` /
  `vite.config.*` / `astro.config.*` / `svelte.config.*` / `nuxt.config.*`. Do **not** recurse into
  `app/desktop`. Nested desktop Vite does not make a public landing `verified`.
- If a root framework is detected, `handoff_mode` is `verified` (Next.js / Vite+React / Astro /
  SvelteKit / Nuxt / etc.).
- If no root framework can be verified, `handoff_mode` is `unresolved`. Do not choose vanilla HTML, a
  file layout, or a framework. Vanilla `index.html` is allowed only when the repo already is that
  stack or the user explicitly asked for it.
- **Desktop-test:** only when desktop is the selected target. Then read `app/desktop/package.json` and
  `app/desktop/vite.config.*`. On this product that tree is Vite + React + the `motion` package.
  `detected_stack.motion_lib` may be `motion` (not only `framer-motion`).
- `detected_stack.framework` has no `desktop-test` value. Mode is `handoff_mode`, not a framework id.

**Motion-stack selection:**
- Read `brand/DESIGN.md` motion section and, when mode is `desktop-test`, `app/desktop/package.json`
- **Motion:** design source, or the tree that mode selected. If **that tree** is silent, leave the
  motion library unresolved. Unresolved mode does not pin a recipe. Desktop-test reads
  `app/desktop/package.json` even when `DESIGN.md` is silent.

**Emitted numbering (verified only).** Catalog indices that called the Asset Placeholder Rule
`[4]` are retired. The emitted verified prompt numbers the body as:

```
Role prime (unnumbered)
Hypothesis (unnumbered)
1. CORE SETUP & GLOBALS
2. ASSET PLACEHOLDER RULE
3. SECTION BLUEPRINT
DO NOT
OUTPUT
CLOSING
```

Refer to the placeholder rule **by name**, or as **numbered section 2** in that emitted body. Never
"Section 4". Anti-patterns.md "Section 2" is a different document heading.

**Verified role prime (this mode only):**

"Act as an elite Creative Front-End Developer. Implement [page route] for
[audience] on the verified stack [framework]. [Quality target]. Execute the
technical blueprint below with zero omissions."

**Verified body (implementation blueprint):**

```
Hypothesis — 1 line, falsifiable claim from approved hypothesis

1. CORE SETUP & GLOBALS
 Libraries: only libraries verified from the project or design source, with
 version-pinned URLs. If motion_lib is unresolved, list none — specify
 entrance/scroll behavior and a reduced-motion fallback without choosing
 GSAP, Lenis, or another runtime.
 Fonts: from DESIGN.md type tokens, with import method (Google Fonts <link>,
 @font-face, or next/font)
 Theme tokens (from DESIGN.md palette)
 Global treatments (ONLY if brand_digest explicitly declares them)
 ⚠ Sacred-creep guard: do NOT add global treatments brand_digest doesn't require.

2. ASSET PLACEHOLDER RULE — verbatim block below. Always present in verified.

3. SECTION BLUEPRINT — for each section in approved architecture:
 Layout: exact dims in vw/vh/px
 Copy verbatim from section-spec
 Asset: declared path. If missing, render placeholder per numbered section 2.
 Motion mechanic: explicit recipe
 (BUG FIX) where clip-path, mix-blend-mode + transform, or sticky-inside-overflow
 Conversion gates from section-spec

DO NOT — sacred elements, voice forbidden vocab, generic CTA ban, asset-URL
invention ban (placeholders per numbered section 2)

OUTPUT — verified framework route and file layout. Responsive 390 / 768 / 1024 / 1440.

CLOSING — the verified sentence from Canonical closings above. No stop closer.
 No "Tested on" line.
```

**Unresolved template (argument / needs-input — not the verified blueprint):**

Role prime: "Act as a landing-page brief handoff. Stack is unresolved (no
framework verified at repo root; operator did not choose a layout). Do not
build a page. Do not emit index.html, a framework, or a file layout. Name the
missing stack and other labeled gaps. Return the page argument only."

Then: hypothesis, labeled gaps (stack, motion, tokens), page argument (section
list + verbatim copy; **no** vw/vh recipes, **no** GSAP/Lenis, **no** placeholder
CSS). DO NOT: no code, no stack, no file layout. OUTPUT: argument + gaps.
CLOSING: unresolved sentence from Canonical closings. No Asset Placeholder Rule
CSS block. No (BUG FIX) execution recipes. Not ~200–350 lines.

**Desktop-test template (selected target only):**

Role prime **is** this sentence, not a verified Implement opener beside it:

"This is a stack-targeting test of the selected `app/desktop` tree. Do not treat it as
scope to implement a public marketing site inside the desktop app."

Then: which tree was selected (`app/desktop`), selected-tree facts (Vite, React,
`motion`), what public-landing detection at repo root would have returned
(unresolved on this product). OUTPUT: stack-targeting result only. CLOSING:
desktop-test sentence from Canonical closings. No production-ready code closer.
No "Execute the technical blueprint". No marketing-site SECTION BLUEPRINT.

**Asset Placeholder Rule (paste verbatim into every *verified* implementation prompt only):**

```
ASSET PLACEHOLDERS

Use the file paths declared in the section blueprint exactly as written. Do
NOT invent or substitute image URLs from Unsplash, stock photo sites, or any
external source.

Per-asset generation prompts live at `asset-slots/{slot-id}.prompt.md`,
written by `brief-graphic` today and other media-briefing agents as the stack
grows (motion-brief, 3d-brief, video-brief, etc.).

If the file at the declared path does not yet exist, render the slot as a
solid-color placeholder block:
- Background: brand primary color at 12% opacity
- Inside: monospace text overlay showing "{slot-id} — {WxH} — pending
 {generation-route}"
- Border: 1px dashed brand-accent
- Centered both axes; preserve the declared slot dimensions

Honor any slot-specific fallback declared in the brief (e.g., "delete cell if
not real" for logo grids — never use placeholders for proof assets).
```

**Lift verbatim into the prompt:**
- **Verified:** sacred, voice, copy slots, asset paths, tokens, that mode's Canonical closing, Asset Placeholder Rule
- **Unresolved:** labeled gaps + page-argument copy already in the brief; that mode's Canonical closing. No placeholder CSS.
- **Desktop-test:** selected-tree stack facts + desktop Canonical closing. No sacred/copy/SECTION BLUEPRINT lift, no placeholder CSS.

**Compress:**
- Hypothesis (1-line bet, basis, test, and risk stay in brief.md)
- Architecture rationale (list sections, skip why-each)
- Audit findings (1–2 lines on what's being closed)
- Detailed LP review evidence (kept in brief.md)

**Common failures:**
- **Inventing Unsplash URLs** (verified) — explicit ban + Asset Placeholder Rule needed verbatim
- **Code-demand closing on unresolved or desktop-test** — verified closer after a stop OUTPUT
- **Desktop-test using the verified Implement opener** or production-ready closer
- **Public landing inheriting `app/desktop` Vite** because detection globbed nested configs
- **Sacred-creep via global treatments**
- **Truncation mid-section** (verified) — that mode's closing MUST be present and explicit
- **Mixing motion libraries**
- **Copy presented as suggestions**
- **No (BUG FIX) callouts** on verified clip-path / mix-blend-mode + transform / sticky-inside-overflow
- **Stack mismatch** — vanilla when unresolved, or nested desktop stack for a public landing

**Example skeleton — unresolved (needs-input; no code demand):**

\`\`\`
Act as a landing-page brief handoff. Stack unresolved (no framework verified
at repo root; operator did not choose a layout). Do not build a page. Do not
emit index.html, a framework, or a file layout. Name the gap. Return the page
argument only.

Working hypothesis (synthetic): explaining request timing may prevent confusion
between a contact request and an immediate download. Test is unrun.

Labeled gaps
- Stack: unresolved (repo root has no next/vite/astro/svelte/nuxt config)
- Motion library: unresolved (design source silent)
- Fonts / theme tokens: from brand_digest when supplied; else labeled missing

Page argument
Section 1: Hero
Headline (verbatim): "See the price your team actually pays — in 8 seconds"
Asset slot named only: `hero-image` — `growth/pricing/hero.webp` (no render recipe)

DO NOT
- Emit code, index.html, a chosen framework, or a vanilla default
- Invent or substitute asset URLs
- Use these words anywhere: leverage, unlock, seamlessly, robust, cutting-edge
- Use generic CTAs: "Submit", "Click Here", "Learn More"

OUTPUT
- Return the page argument and labeled gaps only

Do not emit code, a file layout, or a chosen stack. Return the page
argument and the unresolved inputs only.
\`\`\`

**Example skeleton — verified stack (implementation; compressed):**

\`\`\`
Act as an elite Creative Front-End Developer. Implement /pricing for
engineering managers at 10–50 person teams on the verified stack named in
CORE SETUP. Awwwards-grade. Execute the technical blueprint below with zero
omissions.

Working hypothesis (synthetic): explaining request timing may prevent confusion
between a contact request and an immediate download. Test is unrun.

1. CORE SETUP & GLOBALS

Stack: [verified framework from write-time detection].
Motion library: [verified] or unresolved behavior-only.

Fonts (Google Fonts <link>):
- Display: Geist Sans (weights 400, 600, 800)
- Body: Inter (weights 400, 500)

Theme tokens (from brand/DESIGN.md):
- BG: #F5F4EE (warm-neutral)
- Text: #1A1A1A
- Primary: #004700 (deep green)
- Accent: #74B36B (leaf)

Global treatments: NONE (brand_digest does not declare noise/cursor/preloader).

2. ASSET PLACEHOLDERS
[pattern-derived]

3. SECTION BLUEPRINT

Section 1: Hero
Layout: Centered headline (clamp(48px, 6vw, 96px)), subhead 20px Inter below,
 primary CTA button below subhead. 100vh, low scroll velocity.
Headline (verbatim): "See the price your team actually pays — in 8 seconds"
Subhead (verbatim): "Quotes by team size. No 'contact sales' detours."
Primary CTA (verbatim): "Get my team's price"
Asset: slot `hero-image` — `growth/pricing/hero.webp`. If file missing,
 render placeholder per the Asset Placeholder Rule (numbered section 2).
Motion: Fade-up entrance (stagger 0.1s, ease-out, 240ms) for headline →
 subhead → CTA. Static after entrance.
(BUG FIX) If a later section uses clip-path or mix-blend-mode + transform,
 use overflow:hidden parent + absolute child; do not clip-path on Safari.

[... remaining sections...]

DO NOT
- Use glass, frost, or transparent overlay surfaces (anti-glass sacred —
 brand/DESIGN.md)
- Modify or paraphrase the tagline
- Use these words anywhere: leverage, unlock, seamlessly, robust, cutting-edge
- Use generic CTAs: "Submit", "Click Here", "Learn More"
- Invent or substitute asset URLs (use declared paths; render placeholders
 per the Asset Placeholder Rule in numbered section 2)
- Add a 3rd primary CTA (one primary, one secondary, zero tertiary)

OUTPUT
- Verified stack route as detected
- Responsive targets stay 390 / 768 / 1024 / 1440 (mobile-first)

Write production-ready, flawless code. Do not truncate. Do not use
placeholder copy or invented imagery (asset placeholders only follow the
Asset Placeholder Rule in numbered section 2).
\`\`\`

**Example skeleton — desktop-test (selected target; not a marketing site):**

\`\`\`
This is a stack-targeting test of the selected `app/desktop` tree. Do not treat it as
scope to implement a public marketing site inside the desktop app.

Selected target: app/desktop
Selected-tree facts: Vite, React, motion (from app/desktop/package.json and
app/desktop/vite.config.ts).
Public-landing detection at repo root: unresolved (do not inherit this tree).

Working hypothesis (synthetic context only, not a build order): clarify the
request commitment. No reader or conversion result has been measured.

OUTPUT
- Report the selected-tree stack facts
- Do not emit a public marketing route, repo-root index.html, or a new app

Do not implement a public marketing site inside the desktop app. Return the
stack-targeting result only.
\`\`\`

---

## Claude Design (`claude-design`)

**Tool:** Anthropic's design assistant at claude.ai/design (or Claude with computer-use for design tools)

**Format:** Natural-language prompt, ~120–180 lines

**Structure:**

```
[1. Page identity + hypothesis — 3–5 lines]

[2. Brand block — palette tokens, type tokens, surface, motion tokens. pattern-derived.]

[3. Architecture summary — section list with one-line purpose each. Reference brief.md for full ASCII.]

[4. Per-section blocks — for each section:
 - Section name + purpose
 - Recommended copy (headline / subhead / CTA) — verbatim
 - Asset reference with file path
 - Layout notes (column structure, type tokens used)
 - Trust signal positioning
]

[5. DO NOT block — sacred elements + voice forbidden vocabulary. Verbatim.]

[6. Output expectation — single layout, multiple variants, code, etc.]
```

**Lift verbatim:**
- Sacred elements
- Voice forbidden vocabulary + preferred phrases
- All recommended copy slots
- Asset file paths

**Compress:**
- Hypothesis (claim + 1-line bet, with its evidence boundary)
- Architecture (ref brief.md for full ASCII; summary list inline)
- Audit findings (1–2 lines on what's being closed)

**Common failures:**
- Prompt too long (>250 lines) → Claude Design loses focus
- Sacred elements paraphrased → drift in output
- Copy presented as "ideas" instead of "use this verbatim" → Claude Design rewrites

**Example skeleton:**

\`\`\`
Build a landing page for /pricing targeting engineering managers at 10–50 person teams.

Working hypothesis (synthetic): clarify the request commitment. No measured result.

BRAND
- Palette: #004700 primary, #74B36B accent, #F5F4EE warm-neutral background
- Type: Geist Sans display (--font-geist-sans), Inter body (--font-inter)
- Surface: matte (no glass, no frost, no transparent overlays)
- Motion: ease-out, duration-md (240ms) for fade-up; static for decision moments

ARCHITECTURE (5 sections)
1. Hero — first-impression gate
2. Segmented social proof — three columns by team size
3. Features — 4 rows, benefit-led
4. Objection — "is this overkill for small teams?" addressed directly
5. CTA block — primary action moment

SECTION 1 — HERO
Headline (verbatim): "See the price your team actually pays — in 8 seconds"
Subhead (verbatim): "Quotes by team size. No 'contact sales' detours."
Primary CTA (verbatim): "Get my team's price"
Asset: growth/pricing/hero.webp — calibrated still-life of pricing receipt
Layout: Headline 64px Geist Sans, subhead 20px Inter, CTA primary button (#004700 bg)
Trust signal in viewport: 6-logo customer grid below CTA

[... per section...]

DO NOT
- Use glass, frost, or transparent overlay surfaces (anti-glass sacred)
- Modify or paraphrase the tagline
- Use these words anywhere: leverage, unlock, seamlessly, robust, cutting-edge
- Use action labels that misstate the destination or commitment
- Include a 3rd primary CTA (one primary; one secondary; zero tertiary)

OUTPUT
Single desktop + mobile layout per section. Use the design system tokens above.
\`\`\`

---

## Pencil MCP (`pencil`)

**Tool:** Pencil MCP (`mcp__pencil__*` tools — works on.pen files, encrypted)

**Format:** High-level brief, ~60–100 lines. Pencil generates the `batch_design` operations itself.

**Structure:**

```
[1. Document goal — what kind of.pen file (LP / single section / asset)]

[2. Section list with layout intent per section]

[3. Tokens — palette + type, named or hex]

[4. Copy blocks — verbatim per slot]

[5. Asset references — file paths]

[6. Sacred / forbidden — compact bullet list]
```

**Lift verbatim:**
- Sacred elements (compact list)
- Copy per slot
- Asset paths

**Compress:**
- Architecture rationale (Pencil doesn't need the why)
- Per-CP reference rationale
- Headline decision rationale

**Common failures:**
- Including operation syntax (`I("parent", {...})`) — let Pencil generate, not the brief
- Over-specifying layout — Pencil's strength is layout decisions
- Missing tokens — Pencil falls back to defaults

---

## Figma (`figma`)

**Tool:** Figma file build, often consumed by a designer post-spec

**Format:** Structured spec, ~200–400 lines (designer reads frame-by-frame)

**Structure:**

```
[1. Project — page slug, file naming convention]

[2. Page setup — frame sizes (desktop 1440, tablet 1024, mobile 390), grid system]

[3. Tokens — palette tokens with hex + variable name, type tokens with size/weight/line-height/letter-spacing]

[4. Component library references — button variants, card variants, input variants. Reference Auto Layout settings.]

[5. Per-frame blocks (one per section):
 - Frame name + purpose
 - Layout grid (cols, gutter, padding)
 - Typography tokens used
 - Color tokens used
 - Component instances + variants
 - Copy verbatim
 - Asset placement (file path or instance reference)
]

[6. Variants — desktop / tablet / mobile differences per frame]

[7. Sacred + voice — non-negotiable callout]
```

**Lift verbatim:**
- All copy slots
- Sacred elements
- Voice forbidden vocab
- Token names + values

**Compress:**
- Hypothesis (1-line in cover frame)
- Audit context (1 paragraph max)
- Detailed review rationales (kept in brief.md; unresolved constraints must remain in the handoff)

**Common failures:**
- Inventing token names not in DESIGN.md → designer creates ad-hoc tokens
- Skipping mobile variants → designer guesses
- Component variants not specified → designer picks defaults that may violate sacred

---

## Human Designer (`designer`)

**Tool:** A human designer working in their preferred tool (Figma, Sketch, Adobe XD, code-first)

**Format:** Narrative + structured spec, ~150–300 lines

**Structure:**

```
[1. The why — hypothesis, audience, what we're betting (~5 lines, narrative)]

[2. The audit context (Route B only) — what's broken, what we're fixing (~3 lines)]

[3. Brand non-negotiables — sacred elements, voice rules, surface language (verbatim)]

[4. Architecture — section list with purpose; ASCII diagram or link to brief.md]

[5. Per-section spec — copy verbatim, layout intent, asset references, type/color tokens]

[6. Reference inspiration (optional) — links to brand/inspiration/]

[7. Pre-flight checklist for the designer — sacred respected, voice clean, copy verbatim, asset paths used]
```

**Lift verbatim:**
- Sacred elements
- Voice rules
- Copy slots
- Asset paths

**Compress:**
- Detailed hypothesis review (preserve material assumptions and risks)
- CP rationale (uses IDs only — they can read brief.md if curious)

**Common failures:**
- Burying sacred elements at end → designer misses them
- Hypothesis without why → designer optimizes wrong dimension
- No reference imagery → designer's taste fills the gap (may not match brand)

---

## Choosing the Format

The **implementation companion** is emitted only when implementation is a requested target. Mode is `handoff_mode`, not a fifth specialty chapter.

`target_handoff` selects **additional** specialty hand-offs (`claude-design` / `pencil` / `figma` /
`designer`) alongside a requested implementation companion. If single specialty value, write one extra
block. If list, write one per specialty. `desktop` is **not** a `target_handoff` value; desktop-test
is `selected_target: desktop`.

**Target selection logic:**
- Project uses Claude Design (claude.ai/design) for visual comps → add `claude-design`
- Project uses Pencil MCP for `.pen` design files → add `pencil`
- Human designer working in Figma → add `figma` + `designer` (Figma for spec, designer for narrative)
- Solo founder, no designer, pure code-first → implementation prompt only (no extras)

**Companion files** at `docs/forsvn/artifacts/marketing/brief-landing-page/[slug]/`:
- `brief.md` — main artifact in file mode
- `handoff-implementation.md` — coding-agent prompt block when requested
- `handoff-claude-design.md` — Claude Design block (if `claude-design` in target_handoff)
- `handoff-figma.md` — Figma spec (if `figma` in target_handoff)
- `handoff-designer.md` — narrative for designer (if `designer` in target_handoff)
- `asset-slots/*.md` — per-asset generative prompts (per slot, written by `brief-graphic` or future media-briefing agents)

## Cross-Format Rules

- **Sacred + voice + copy verbatim** on verified and design-tool blocks, near the end. Unresolved
  and desktop-test do not lift the verified 8-block.
- **Voice forbidden vocab** is the actual list on those blocks — not "avoid corporate-sounding language".
- **Copy slots** on verified/design-tool: "use this verbatim", not "consider this".
- **Asset references include file paths** when a mode names an asset.
- **Quality gates are concrete** for that mode. Unresolved: named gaps. Desktop-test: selected-tree
  stack facts. Verified/design-tool: headline matches brief verbatim.

## Anti-Patterns

- **One block for all targets** — fails all of them. Pick one per block.
- **Pasting brief.md verbatim** — defeats compression. Format-specific compression is the value-add.
- **Inventing format conventions** — if the target tool has docs, follow them. Reference: target's official docs > this catalog > intuition.
- **Skipping sacred / voice for brevity** — these are the most important parts. If you cut anything, cut the rationale, not the rules.
