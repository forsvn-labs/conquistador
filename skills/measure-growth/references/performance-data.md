

# Performance Data — Store, Ledger, and Read Contract

> The **optional**, local-first per-channel performance layer under `.forsvn/performance/`. Operator-fed snapshots of real post results, a publish ledger anchoring post↔artifact attribution, and the three-state read contract producing skills consume at generation time. Cite this file; do not re-implement the rules.

**Optional integration — not a requirement of this skill.** This layer serves operators who run the local `.forsvn` state root. A standalone operator with no `.forsvn/` directory can run every measure-growth procedure end-to-end: the standalone contract is **operator-supplied evidence** (pasted analytics, exported rows or dashboards, each labeled with source + window). Treat an absent store exactly like the `empty` state in the Read Contract below. The schema and rules here govern reads and writes only when that store exists.

All example rows in this file are **synthetic** — invented platforms-shaped data for illustration, never real account metrics.

## Purpose

This contract retains fully keyed operator-supplied measurements, their artifact joins and
observation windows. It supports bounded account decisions when the selected rows are comparable.
Platform-intelligence packs define methods and questions, not performance priors.

**v1 scope:** TSV files, operator-fed imports only. No live platform APIs (connectors layer onto the same store later). SQLite is explicitly deferred — it is a v2 optimization locked behind the data-layer dogfood criterion, not a v1 concern. Schema migrations run via a `_dev/` script only; never hand-rewrite a store file's shape.

## Placement Decision — why a sibling layer, not a loops extension

`.forsvn/loops/<slug>/results.tsv` already exists (see `fallbacks/sequential.md`) and looks adjacent, so the placement is a deliberate decision, recorded here:

- **Loops are per-initiative; channel history is cross-initiative.** A loop ledger answers "did cycle 3 of the pricing-page loop beat cycle 2?" — scoped to one measurable surface, retired when the initiative closes. Channel history answers "what works on LinkedIn for this account?" — it must survive every initiative and accumulate across all of them. Folding channel history into a loop folder would either fragment it per-loop (unusable for cross-loop reads) or turn one loop into a fake "channel loop" (violating the one-loop-per-measurable-initiative rule).
- **One-way flow, two stores.** Loop evals whose Metric Packet carries the full snapshot key (platform, post id/URL, measurement window) append to the channel store *in addition to* their loop's `results.tsv`. Keyless loop rows stay in `results.tsv` only — they remain valid cycle evidence but can never enter channel sufficiency counts. There are never two independent writers of the same fact: metric-ingest (and keyed loop evals routed through it) is the single append path into the channel store.
- **Different consumers.** `results.tsv` is read by the loop's own next cycle. The channel store is read by producing skills at generation time, across every future initiative.

Hence: `.forsvn/performance/` is a **sibling state-root layer** beside `canonical/`, `artifacts/`, `experience/`, and `loops/`.

**Performance data is data, not artifacts.** Rows are operator-fed measurements, not skill-produced reviewable Markdown. The layer is therefore exempt from the artifact contract: `validate-artifacts` and `lint-artifact-paths` do not walk it (their cohort is `.forsvn/{canonical,artifacts,experience}`), and `manifest-sync` does not index it. The store is **git-tracked** — durable operator data in a private repo — and is `.publicignore`-fenced (all of `.forsvn/` is) so it never ships to the public mirror. None of this applies when the store is absent; the skill then runs entirely on operator-supplied evidence.

## Store Layout

```text
.forsvn/performance/
├── ledger.tsv          # post↔artifact attribution ledger (all platforms)
├── <platform>.tsv      # one snapshot file per channel: linkedin.tsv, instagram.tsv, x.tsv, …
└── thresholds.json     # optional — the single operator override key (see Read Contract)
```

Both TSV kinds start with a **`schema_version` header line**, then a tab-separated column header:

```text
# schema_version: 1
platform	post_id	measurement_window	imported_at	…
```

A store file missing the `schema_version` line is malformed; the query helper refuses it with an actionable message rather than guessing.

### Snapshot files — `<platform>.tsv`

**Append-only.** One row per (post, measurement window) import. Rows are never edited or deleted; corrections are re-imports.

| Column | Meaning |
|---|---|
| `platform` | channel key — must match the filename (`linkedin.tsv` rows say `linkedin`) |
| `post_id` | native platform post id, or the post URL when the platform exposes no id — **key component** |
| `measurement_window` | `YYYY-MM-DD..YYYY-MM-DD` (start..end) — **key component** |
| `imported_at` | ISO-8601 timestamp of the import — collision tiebreaker, not a key component |
| `ledger_id` | joining ledger row id, or empty for ledger-less backfill |
| `artifact_id` | producing artifact's stable `id`, or empty |
| `format` | `text \| image \| carousel \| video \| …` — query filter |
| `placement` | `paid \| organic` — query filter |
| `metric` | primary metric name (e.g. `engagement_rate`) |
| `value` | primary metric value |
| `baseline` | comparison value, or empty |
| `reach` | reach/impressions |
| `likes` `saves` `shares` `comments` | the mandatory 4-way engagement split (vanity vs meaningful — see metric-ingest) |
| `attribution_confidence` | `high \| medium \| low \| none \| blocked` — from the Metric Packet (see Join Rule) |
| `comparability` | `comparable \| partially_comparable \| not_comparable` — from the Metric Packet |
| `source` | `native platform analytics \| third-party dashboard \| operator-supplied` |
| `notes` | free text; no tabs/newlines |

**Snapshot key = (platform, post_id, measurement_window).** Rules:

- **Full-key collision → latest `imported_at` wins.** Re-importing the same window with corrected numbers appends a new row; queries and sufficiency counting use only the newest row per key. Older rows remain as history.
- **A later window is a new snapshot, not a collision.** Both windows stay valid history (a post measured at day 7 and day 30 is two rows, both queryable).
- **Keyless rows are rejected at read time.** A row missing any key component never counts toward sufficiency and never appears in query results — the helper lists it as rejected so it can be fixed at the source.

### Ledger — `ledger.tsv`

**Append-only**, like the snapshot files. One row per lifecycle event; the **latest row per `ledger_id` is the current state**.

| Column | Meaning |
|---|---|
| `ledger_id` | unique slug, recommended `<platform>-<YYYY-MM-DD>-<slug>` |
| `artifact_id` | the producing artifact's stable `id` (the `artifacts/` frontmatter `id`) |
| `platform` | target channel |
| `status` | `exported \| live \| measured` |
| `event_date` | `YYYY-MM-DD` of this lifecycle event |
| `post_url` | empty until known; written at first import |
| `format` | as declared at export |
| `placement` | `paid \| organic` |
| `notes` | free text; no tabs/newlines |

Synthetic example:

```text
# schema_version: 1
ledger_id	artifact_id	platform	status	event_date	post_url	format	placement	notes
examplenet-2099-01-05-demo-launch	write-social-demo-launch	examplenet	exported	2099-01-05		text	organic	synthetic example
examplenet-2099-01-05-demo-launch	write-social-demo-launch	examplenet	live	2099-01-07	https://example.invalid/p/123	text	organic	first import joined
examplenet-2099-01-05-demo-launch	write-social-demo-launch	examplenet	measured	2099-01-14	https://example.invalid/p/123	text	organic	day-7 window imported
```

## Ledger Lifecycle and Join Rule

```text
exported ──(first import: metric-ingest joins, writes live + post_url)──▶ live ──(snapshot lands)──▶ measured
```

- **`exported`** — written when content is exported/published (the publish-side skill writes this row; wiring lives in the consuming skills, not here).
- **`exported → live` is owned by metric-ingest.** At the **first import** for a post, metric-ingest appends the `live` row carrying the now-known `post_url`. The `measured` row follows once the snapshot is appended (usually the same import pass).
- **Every import names its ledger id or artifact id.** The operator (or the loop eval) supplies which exported row this measurement belongs to.
- **Ambiguous matches are refused, never guessed.** If the named artifact id matches more than one `exported` ledger row on that platform, the import is refused with the candidate `exported` rows listed by platform + export date; the operator picks the right `ledger_id` and re-runs.
- **Ledger-less imports are allowed — at `attribution_confidence: none`.** Historical backfill (posts published before this layer existed) appends snapshots with empty `ledger_id`/`artifact_id` and confidence `none`. They are real channel history; they just can't claim which artifact produced them.
- **A joined row with no URL stays `low`.** A ledger join without a verifiable `post_url` caps `attribution_confidence` at `low` regardless of metric quality.

`attribution_confidence` gates **artifact-level attribution claims** ("this brief's hook drove the lift"), not channel-level reads — see the sufficiency rules below.

## Read contract: empty / sparse / sufficient

These are task-specific evidence states, not fixed post-count thresholds. Declare the comparison,
independent unit, audience, metric denominator, relevant history window and precision needed for
the decision before selecting rows. Do not treat repeat windows for one post as independent posts.

| State | Condition | Reader behavior |
|---|---|---|
| `empty` | No eligible observations for the question | Use the pack to design a test; report no observed result |
| `sparse` | Observations exist but comparability or precision is inadequate | Describe them with limitations; no winning-pattern claim |
| `sufficient` | The predeclared comparison and evidence requirements are met | Make only the bounded account-specific decision those requirements support |

Eligible rows have full keys, latest-import deduplication, compatible definitions and the declared
window. Show exclusions and counts after format/placement filters. Do not substitute total channel
rows for the selected comparison. Confidence still gates artifact attribution independently.

No universal decay window, row floor or prior-blending weight establishes reliability. Historical
thresholds or weights in local files are legacy configuration; do not present them as validated
science. If an operator uses a local planning threshold, record its rationale and limitation.

## Method versus evidence

The pack's §3 and §5 define what to observe and test. Its original methods are not empirical priors.
Account observations can support an account decision when comparability is justified. Neither
observations nor draft packs verify current platform rules; those require task-local evidence.
Keep `method_updated` separate from `last_verified: null`. Never infer algorithm mechanics from
an association in a performance table.

## Brand-Floor Supremacy

**Brand, safety, and claims floors outrank performance data — always.** Data reshapes anything *above* the floor; it never reshapes the floor. A top-performing post that violates a brand/safety/claims floor is not adopted as a pattern: distill it as **"performs but violates floor — not adopted"** (in `experience/marketing/`, with the evidence cited), so the finding is preserved without the floor eroding. This is the same rule that governs rubric evolution: performance evidence never re-tightens or relaxes a floor.

## Query helper and ownership

No query helper ships in this portable skill. Apply header validation, full-key rejection,
latest-import deduplication, declared windows and comparison filters to supplied local rows.
Report missing values and excluded rows. A sorted descriptive table is not a ranking formula
or a causal recommendation. This file owns the local store schema, lifecycle and join rules;
consuming skills own authorized writes. Without a store, keep the artifact as the record.
