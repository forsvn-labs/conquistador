# Format Conventions — interactive campaign

## Artifact frontmatter (11 fields — v3 contract)

```yaml
skill: interactive
version: 1
date: YYYY-MM-DD
stack: marketing
type: execution
id: interactive-<interaction_type>-<slug>
review_surface: md
status: done | done_with_concerns | blocked | needs_context
interaction_type: assessment | calculator | quiz | simulator | challenge | product-demo | chance-game | other
capture_mode: email | none
keywords: [interactive, <interaction_type>, <campaign-job>]
```

Conforms to `format-conventions.md`.

## Body sections (in order)

1. **`## Concept`** — the game · the marketing goal · the success metric.
2. **`## Mechanic`** — one action · meaningful success and failure · result logic or honest odds when
   applicable · fairness/integrity note.
3. **`## Value and Cost`** — useful takeaway · variable cost at test volume · prize tiers, odds, and
   redemption cap only for a chance game.
4. **`## Funnel`** — entry → interaction → useful result → optional value-exchange capture → next
   step. State `capture_mode`.
5. **`## Compliance Flags`** — applicable privacy, consent, accessibility, age, and jurisdiction
   questions; prize-law flags only for a chance game.
6. **`## Build Notes`** — idle, input, active, meaningful success, meaningful failure, error, and
   recovery states · keyboard and reduced-motion support · integrity controls.
7. **`## Measurement Hooks`** — exposure · start · completion · meaningful outcome · optional
   capture · qualified next action · guardrail.
8. **`## Critic Verdict`** — 6-row table (5 dims + total).

## Rules
- Rules, data, scoring, limitations, and odds when applicable are stated honestly.
- Capture follows the useful result and has an explicit value exchange.
- Every promise is sustainable at the bounded test volume; every prize is honorable when prizes
  exist.
