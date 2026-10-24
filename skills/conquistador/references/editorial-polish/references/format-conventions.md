---
title: Humanmaxxing — Format Conventions
lifecycle: canonical
status: stable
produced_by: humanmaxxing
load_class: PROCEDURE
---

# Format Conventions

**Load when:** compression-agent / soul-injection-agent / strip-agent compose artifact content OR critic-agent verifies typography/format. These conventions are enforced by the critic's Hard Tell gate and Pass 3 (Density + Authenticity dimensions).

---

## Date format

Frontmatter `date:` field uses ISO 8601 (`YYYY-MM-DD`) for machine-readable consistency with the rest of the artifact ecosystem. Content dates inside the humanmaxxed text follow the source convention (don't reformat dates inside quoted passages or named-entity references).

## Typography and tells (critic Hard Tell gate)

The [writing guide](../../writing-guide.md) owns these rules; `conquistador check` enforces its warnings.

| Rule | Detection | Severity |
|---|---|---|
| Fix every time tells | `conquistador check` `ai-*` warnings, plus the rest of `writing-guide.md` § Fix every time | Hard Tell: auto-FAIL |
| "It's not just X, it's Y" | `ai-not-just`. A contrast with the reader's real, named alternative is allowed. | Hard Tell |
| Heavy em dashes | `ai-em-dash`: three or more at over one per 100 words. One or two are fine. | Advisory |
| Empty rhetorical question hooks | Paragraph-leading `Sound familiar?`, `The best part?` | Soft Tell |
| Colon labels in social copy | `ai-colon-label`. Colons in lists, times, metadata, and docs are fine. | Hard Tell (social only) |
| Emoji bullets | `ai-emoji-bullets`. Emoji are fine where the channel expects them. | Advisory |
| Staccato taglines | `Your X, Y'd` or `X. Y.` two-word headlines with no claim | Soft Tell |
| Unsourced numbers | Any figure with no traceable source | Facts check: [safety standard](../../../standards/safety.md) |

A single Hard Tell = critic auto-FAIL regardless of total score.

## Frontmatter field order (Artifact Template)

Per the Artifact Template block in SKILL.md body. Required fields in this order:

```yaml
skill: humanmaxxing
version: 1
date: YYYY-MM-DD
status: done | done_with_concerns | blocked | needs_context
compression: N%
protected_tokens_preserved: true | false | N/A
```

For Route C (called by another skill), `version` may carry the calling skill's version semantics (e.g., `version: copywriting-v2`); orchestrator sets at compile time.

## Body section headers (verbatim)

The polished artifact body sections appear in this order with these exact headers (downstream consumers — currently human readers + upstream calling skills — match on H2):

1. `## Humanization Summary` (9-row table: Words original / Words humanmaxxed / Compression / Tells found / Tells fixed / Hard Tells remaining / Soft Tells remaining / Quality score / Protected tokens preserved)
2. `## Change Log` (4-column table: Location / Original / Change / Rule)
3. (Humanmaxxed content body — H2 sections from the original preserved as-is, no re-titling)

On re-run: rename existing artifact to `[slug].humanmaxxed.v[N].md` and create new with incremented version (`vN+1`).

## Change Log row format

Each row in the Change Log table is one edit:

```
| Location (para/section) | "[original text]" | "[new text]" or [deleted] | Tell / Compression / Voice |
```

- **Location:** paragraph-section reference (e.g., `Para 1, S1` = paragraph 1, sentence 1; or `H2 "Onboarding section"`)
- **Original / Change:** exact verbatim quotes from before/after; for deletions, write `[deleted]` in the Change cell
- **Rule:** cite the rule by name from `writing-guide.md` (e.g., `Tell: stock opener`; `Compression: merge`; `Voice: specificity`) — the critic verifies rule citations are concrete, not vibes-based

## Quality score format

Frontmatter `quality_score` (also shown in Humanization Summary table) follows this format:

```
Quality score | [X]/50 (Di:[n] R:[n] T:[n] A:[n] De:[n])
```

Where:
- Di = Directness (0-10) — strip-agent owns
- R = Rhythm (0-10) — soul-injection-agent owns
- T = Trust (0-10) — soul-injection or strip owns (depending on cause)
- A = Authenticity (0-10) — soul-injection-agent owns
- De = Density (0-10) — soul-injection (add specificity) or revert compression owns

PASS threshold: total ≥35/50 AND zero Hard Tells. Below either → FAIL → re-dispatch named agent.

## protected_tokens_preserved field values

| Value | When |
|---|---|
| `true` | `protected_tokens` list was passed by upstream caller AND every token appears verbatim in final output |
| `false` | `protected_tokens` list was passed BUT one or more tokens missing or paraphrased in final output (= critic auto-FAIL, re-dispatch responsible agent) |
| `N/A` | No `protected_tokens` list passed (typical for Route A and Route B without upstream caller) |

## When critic catches a format violation

Critic FAIL on a Hard Tell → re-dispatch strip-agent with the specific tell cited. Format violations are usually one-shot fixes; do not loop past cycle 1 for format-only issues unless other dimensions also fail.
