# Layout Conventions — Grid, Density, State & Accessibility

> Domain reference for the **layout-state-agent** (CP-04 layout system, CP-05 state coverage,
> CP-06 accessibility floor). Spec only — no rendering. Every value here is a convention; actual
> token names come from the upstream token-application-agent output. Never hard-code raw px/hex.

## How to use this file

1. **At grid time:** Use the supplied grid, gutter, margin, and breakpoint tokens. If a role is
   missing, name a semantic placeholder and flag it instead of taking a default from this file.
2. **At density time:** Pick a density tier per surface. State it explicitly in the Per-Screen
   Layout Spec block — never omit it.
3. **At state time:** Apply the five interaction states per interactive component and the three
   mandatory screen-level states per screen that holds data or async work.
4. **At accessibility time:** Emit a contrast table, enumerated focus order, named touch targets,
   and reduced-motion fallbacks. Ratios must be stated numerically; "logical order" is not a spec.

---

## 1 · Grid + Spacing

### Grid roles by surface class

| Surface class | Columns | Gutter token | Margin token | Max-width cap |
|---------------|---------|--------------|--------------|---------------|
| Desktop web | `[supplied]` | `[desktop gutter token]` | `[desktop margin token]` | `[desktop max token]` |
| Tablet web | `[supplied]` | `[tablet gutter token]` | `[tablet margin token]` | `[tablet max token]` |
| Mobile web | `[supplied]` | `[mobile gutter token]` | `[mobile margin token]` | viewport |
| Native desktop | `[supplied]` | `[window gutter token]` | `[window margin token]` | `[window size token]` |
| Native mobile | `[supplied]` | `[safe gutter token]` | `[safe margin token]` | viewport |

Gutter and margin token names are resolved at token-application-agent time. If the upstream
merged spec declares different names, use those; flag a mismatch as `[BLOCKED: token name drift]`.

### Spacing rhythm

Every margin, padding, and gap uses a supplied named token. Do not assume a base unit or numbered
scale. A raw value is an automatic CP-04 FAIL.

| Token | Value | Typical use |
|-------|-------|-------------|
| `[inline-gap token]` | supplied | icon-label gaps, tight inline spacing |
| `[control-inset token]` | supplied | component padding |
| `[list-row token]` | supplied | list-row padding |
| `[section-gap token]` | supplied | section separation |

The role labels above are placeholders, not token names. Use the upstream names verbatim.

---

## 2 · Density Tiers

Pick one tier per surface — or declare your own named tier and define its row height + spacing multiplier. State it in the Per-Screen Layout Spec; never leave it implicit.

| Tier | Base row height | Spacing multiplier | When to use |
|------|-----------------|--------------------|-------------|
| **compact** | `[compact-row token]` | `[compact-spacing token]` | Data-dense tables and lists |
| **default** | `[default-row token]` | `[default-spacing token]` | Standard app chrome, forms, cards, and navigation |
| **comfortable** | `[comfortable-row token]` | `[comfortable-spacing token]` | Onboarding, modal dialogs, and empty states |

Rule: if a screen contains both a dense table and a comfortable hero, split the spec —
declare `compact` for the table region and `comfortable` for the hero region, named per zone.

---

## 3 · Responsive / Adaptive Behavior

Four named patterns — declare exactly one per screen, or declare your own named pattern and define it explicitly:

| Pattern | Description | Typical trigger |
|---------|-------------|-----------------|
| **Fixed** | Single layout, no reflow. Breakpoints do not apply. | Native mobile screens, macOS windows at a declared min-width |
| **Fluid** | Columns + gutters scale with viewport width up to a max-width cap. | Web surfaces within a single breakpoint tier |
| **Adaptive** | Discrete layout variants at declared breakpoint tokens. Name which variant fires at which token. | Web surfaces that span multiple breakpoint tiers |
| **Platform-split** | Separate layout spec per declared surface (e.g., desktop vs. mobile vs. tablet). | Any feature shipping on 2+ surface classes |

### Adaptive roles

Bind adaptive behavior to the supplied breakpoint names and product flow. The table describes possible
relationships, not defaults.

| Element | Collapses to | Breakpoint |
|---------|--------------|------------|
| Side navigation / rail | Drawer (hamburger or slide-over) | supplied compact breakpoint token |
| Multi-column data table | Stacked cards or single-column list | supplied compact breakpoint token |
| Top navigation bar | Bottom nav bar (native mobile) | supplied mobile breakpoint token |
| Horizontal tab row | Scrollable pill strip | supplied compact breakpoint token |
| Two-column form layout | Single column | supplied compact breakpoint token |

Name the breakpoint tokens from the upstream token set; never hard-code px widths.

---

## 4 · State Visual Treatments

### Interaction states — five per interactive component

Spec every component with all five. Omit none; if a state is structurally impossible on a
surface (e.g., `hover` on a touch-only native screen), note that explicitly.

| State | Convention |
|-------|-----------|
| **default** | Resting; most visually neutral. Declare the surface token + foreground token. |
| **hover** | Cursor-driven platforms only. Use a supplied hover token or mark the role unresolved. |
| **active** | Use a supplied pressed/active token or mark the role unresolved. |
| **focus** | Keyboard / switch access. Must include the focus-ring token (`focus-ring` or equivalent). Never remove outline. |
| **disabled** | Use a supplied disabled token and a non-color cue. If absent, mark the role unresolved. |

### Screen-level states — three mandatories

Every screen that holds data, performs async work, or is recoverable from an error must have all
three. Static screens (e.g., a confirmation splash with no async load) need only what is
structurally possible — state `none` only where the condition is impossible and say why.

| State | Convention |
|-------|-----------|
| **empty** | Name the component filling the void (e.g., `EmptyState`), placeholder copy slot, and recovery CTA if one exists. Never just "show empty." |
| **loading** | Name the product-appropriate progress component and its supplied tokens; do not import a component or motion default. |
| **error** | Name the error component, supplied status token, body copy slot, and recovery action. "Show an error" fails CP-05. |

---

## 5 · Accessibility Floor (CP-06)

### Contrast minimums (WCAG 2.1 AA)

| Text / element type | Minimum contrast ratio |
|--------------------|----------------------|
| Body text (< 18pt / < 14pt bold) | 4.5 : 1 |
| Large text (≥ 18pt / ≥ 14pt bold) | 3 : 1 |
| UI components and graphical objects | 3 : 1 |

State the ratio numerically in the contrast table — do not write "passes" without the number.
Compute against the token-application-agent token pairs; flag any pair below minimum as FAIL.

### Focus order

Enumerate tab stops per screen as a numbered list. Arrow-key clusters (e.g., a radio group,
toolbar) are noted as a single group with one tab stop, arrow-navigable internally.
"Follows DOM order" or "logical order" is not an acceptable spec — enumerate the stops.

### Interaction targets

Use the supplied interaction-size token or the named target-platform accessibility rule. Do not copy
a size from this reference. When neither the token nor the platform is supplied, mark target-size
verification unresolved. Measure the rendered hit area, not the icon glyph, during implementation.

### Reduced-motion fallback

Every motion spec must declare what it degrades to when reduced-motion is active. When the supplied
source has no motion token, use an instant state change. Otherwise bind the fallback to supplied
duration/easing roles. Never import a duration from this reference.

---

## 6 · Motion

Use only supplied motion and easing tokens. If none are supplied, specify an instant state change and
do not invent a duration, easing, material, or house aesthetic.

### What animates vs. what does not

| Animate | Do not animate |
|---------|---------------|
| State transitions (focus ring, hover fill, active press) | Layout reflows or content shifts |
| Enter/exit of overlays and drawers | Loading skeletons (shimmer is CSS, not JS motion) |
| Micro-interactions (checkboxes, toggles) | Data refreshes or background sync |

Declare motion per component in the Interaction & State Spec using supplied tokens. Fallback
every transition with a `prefers-reduced-motion` note — no exception.
