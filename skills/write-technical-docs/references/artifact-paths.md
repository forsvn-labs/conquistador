# write-technical-docs — Artifact paths by route

Full template + filename + version-increment rule: [`report-template.md`](report-template.md).

## Paths by route

| Route | Path |
|---|---|
| Default | `README.md`, `docs/<topic>.md`, or specified location |
| Route C — Sync | in-place updates to existing docs with `<!-- synced: YYYY-MM-DD -->` markers |
| Route D — Ship Log | `.forsvn/artifacts/product/write-technical-docs/product-context.md` (skill-owned product snapshot; pre-write merge-mode check required) |
| Route E — Release Notes | `CHANGELOG.md` (prepend new entry); optionally GitHub Release body draft to stdout via `--gh-release` |
| Audit Mode | no writes — produces audit report inline |

## Lifecycle by doc-type

See [`report-template.md`](report-template.md) "Lifecycle by doc-type":

- **canonical:** README, User Guide, Config, Tutorial, Ship Log
- **pipeline:** API Reference
- **snapshot:** Release Notes

## Frontmatter (baseline)

`skill`, `version`, `date`, `status`, `stack` (=product), `review_surface` (=md by default; project-level canonical docs may opt into `html` for FIRE-themed preview), `decision_state`, `audience`, `doc-type`. Backfilled additions: `lifecycle`, `produced_by`, `provenance`.

## Consumed by

Ship Log / product-context under `.forsvn/artifacts/product/write-technical-docs/` may feed `create-brand`, `write-copy`, `optimize-search`, `architect-software-system`, and related skills. Release Notes still target project `CHANGELOG.md`. `fresh-eyes-review` and `architect-software-system` may read shipped docs for drift detection. Code readability cleanup outside this skill is not a consumer of these artifacts.
