# Format Conventions — `measure`

## Artifact frontmatter (12 fields, verbatim — v3 artifact contract)

```yaml
skill: measure
version: 1                      # artifact-schema version (integer)
date: YYYY-MM-DD
stack: marketing
type: evaluation
id: measure-<channel>-<slug>    # stable kebab id, unique
review_surface: md
status: done | done_with_concerns | blocked | needs_context
channel: producthunt | x | reddit | facebook | linkedin | ...
pack_verified: none   # null last_verified or no pack; not method_updated
applied_tactics: [<tactic>, ...]      # tactics the read attributed against (empty if no pack)
keywords: [measure, <channel>, launch, loop]
```

Conforms to `COMMAND.md`. `validate-artifacts --strict` enforces it.

## Body sections (in order)

1. **`## Results`** — the normalized metrics table (metric · value · unit · vs-expected · confidence) + a `Gaps` line for missing metrics.
2. **`## What Worked`** — each line: tactic (pack §) + the supporting number + confidence class.
3. **`## What Failed`** — symmetric; skipped §5 steps / hit §4 anti-patterns / missed targets, with observed costs only; otherwise cost unknown.
4. **`## Keep / Drop / Test`** — concrete next-launch actions; Test items phrased as hypotheses.
5. **`## Hypothesis Verdicts`** — each launch hypothesis: confirmed / refuted / inconclusive against the original bounded decision rule + number and limitation.
6. **`## Pack Write-Back`** — proposed dated changelog rows, evidence status and owner decision; report an actual authorized append separately.
7. **`## Legibility`** — the `**Legibility — applied expertise**` block per [`legibility-convention.md`](legibility-convention.md): the method loaded + its `method_updated` and null `last_verified` + the **specific** §3/§5 signals the diagnosis read the numbers through (concrete, §-cited — never a bare "measured against the pack" label), or the transparent-degrade Absent shape when no pack covered the channel. Authored by the diagnosis agent; its facts mirror into the `pack_verified` + `applied_tactics` frontmatter fields. **Legibility only — `measure` produces a measurement, not a marketing artifact, so it carries no `## Why this works` block.**
8. **`## Critic Verdict`** — 6-row table (5 dims + total).

The `## Legibility` block and the `pack_verified` / `applied_tactics` frontmatter must agree: `pack_verified` = `none` for null `last_verified` or Absent, and `applied_tactics` = the §3/§5 signals the block narrates (empty list in the Absent state). Use the block state to distinguish a loaded draft from Absent; a loaded draft has `pack_verified: none` and can have nonempty `applied_tactics`.

## Pack write-back

On critic PASS, propose an append-only §9 changelog note with the observation source, window,
denominator, result and uncertainty. For unrun tests or synthetic examples, label the proposal
as such and do not append it as observed evidence. Record the owner decision and any actual
write separately. Never alter method text or verification metadata from a readout. Promotion is
a separate owner-reviewed change; no sync script or external call is required here.

## Performance row (optional local store)

When the optional local performance store exists, append one row to `.forsvn/performance/[channel].tsv` per the schema in
`references/performance-data.md` (date, channel, slug, metric columns, confidence). Without that store, skip this write-back — the evaluation artifact itself is the record. This is operator-fed data, exempt from the artifact contract.

## Hosted metrics feed

Skip hosted calls. The local artifact and any authorized local store append are the record.
Do not claim a remote mirror or require one for completion.
