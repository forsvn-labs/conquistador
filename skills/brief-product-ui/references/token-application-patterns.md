# Token Application Patterns

> Canonical mapping conventions for the **token-application-agent** (CP-03 — Token fidelity). Read this file before writing the first row of a Token Application Map. For anti-patterns, skill CPs, and section contracts see `agents/token-application-agent.md` and `references/anti-patterns.md`.

---

## 1. Token Categories and Naming Convention

Preserve the supplied token syntax and names. The patterns below describe semantic roles only; they
are not a default token set. Use CSS custom-property syntax only when the source already uses it.
When a supplied source lacks a role, write it as unresolved rather than creating a new token.

### Color
| Category | Semantic role | Source binding |
|----------|---------|---------|
| Background / page | base and raised surfaces | supplied names only |
| Surface | layered panels | supplied names only |
| Text | primary, muted, disabled | supplied names only |
| Border | default and subtle | supplied names only |
| Accent / brand cue | primary action and focus | supplied names only |
| Interactive states | hover, active, disabled | supplied names only |
| Semantic / status | success, warning, error | supplied names only |

### Space
Use the supplied spacing tokens for padding, margin, gap, and inset. If a supplied source has no
spacing token for a needed role, mark that role unresolved. Do not import a numbered scale, prefix,
or raw unit from this reference.

### Type
Bind screen headings, labels, body, captions, and code-like content to the matching supplied type
roles. This reference supplies no naming pattern or family tokens.

### Radius
Bind corners to supplied semantic radius roles. If none exists, mark the role unresolved.

### Elevation / Shadow
Use only supplied elevation and material tokens. Do not assume matte, glass, blur, or shadow behavior
unless the declared brand source says so.

### Motion / Duration
Use only supplied duration and easing tokens. When none exists, prefer no motion and record the gap.

---

## 2. Per-State Token Deltas

Every interactive element must carry all reachable state deltas. List only the dimensions that change; leave unchanged dimensions implied.

| State | Token binding |
|-------|------------------------|
| Default | supplied base surface and text tokens |
| Hover | supplied hover token; N/A on touch-only surfaces |
| Active / pressed | supplied active token |
| Focus | supplied focus-ring color and width tokens; never omit on keyboard-reachable elements |
| Disabled | supplied disabled text/fill/border tokens; no state transitions |
| Selected | supplied selected-surface, selected-text, and indicator tokens |

---

## 3. Source-specific bindings

This portable reference contains no house values. If and only if the operator declares
`brand_source: house`, load `house-token-bindings.md` as a separate source. Never load that file for
a provided or customer token set.

---

## 4. Cold-Start Protocol

When `brand_source: cold-start-hint` (no DESIGN token file available):

1. Set `brand_source: cold-start-hint` in the artifact frontmatter.
2. Proceed with clearly labeled **named placeholder tokens** derived from semantic role. Their
   syntax belongs to the cold-start artifact and must not be presented as a recovered default.
3. Never invent a literal palette (no hex values, no guessed px values).
4. List every introduced placeholder in the `## Cold-Start Flags` section with its semantic intent.
5. Mark the artifact `status: done_with_concerns` and flag: _"Token file absent — placeholders used; operator must supply DESIGN tokens before production."_

---

## 5. Mapping Table Shape

Use this column order in the Token Application Map:

| Element | Token — color | Token — space | Token — type | Token — radius | Surface / state notes |
|---------|--------------|--------------|-------------|----------------|----------------------|
| Panel background | `[supplied surface token]` | `[supplied inset token]` | — | `[supplied radius token]` | State only supplied material behavior |
| Body text | `[supplied text token]` | — | `[supplied body token]` | — | Disabled: `[supplied disabled-text token]` |
| Primary action | `[supplied action/text tokens]` | `[supplied control spacing]` | `[supplied label token]` | `[supplied control radius]` | Hover, focus, active, and disabled use supplied state tokens |
| Selected item | `[supplied selected tokens]` | `[supplied item spacing]` | `[supplied body token]` | `[supplied item radius]` | Use supplied selected indicator token |
| Path / timestamp | `[supplied muted-text token]` | — | `[supplied code token]` | — | No state change when not interactive |

Write `—` only when a dimension genuinely does not apply. Every row for an interactive element must carry state delta tokens in the last column.
