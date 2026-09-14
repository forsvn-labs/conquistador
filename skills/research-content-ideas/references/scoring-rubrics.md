# Scoring Rubrics

Shared scoring rules used by `pattern-extractor-agent`, `synthesis-agent`, and `critic-agent`. These rules apply to every research run and are NOT renegotiable per-topic.

---

## Sample-Size Flags

Every per-platform section must declare exactly one flag based on the scout's captured count `n`:

| Count | Flag | What it means downstream |
|---|---|---|
| n ≥ 8 | **OK** | Describe recurring observations in the captured sample; retain selection limits |
| 3 ≤ n ≤ 7 | **LOW_SAMPLE** | Patterns claimed with directional caveat; brief skill warns producer |
| n < 3 | **INSUFFICIENT_DATA** | NO pattern claims; only "observed examples" listed; brief skill cannot use this section |

The flag carries through to:
- Frontmatter: `sample_size_per_platform[platform]: { n: <int>, flag: <FLAG> }`
- Section header: `### TikTok — SAMPLE: <FLAG> (n=<int>)`
- Open Risks section: every LOW_SAMPLE platform listed with explicit "treat as directional"

**Threshold scope:** These are local workflow labels for sample handling. They do not establish statistical confidence, representativeness or a known error rate. Counts describe the inspected sample; they cannot establish a platform-wide pattern or causal performance advantage.

---

## Evidence rules

Every factual claim needs evidence that supports the actual claim and its scope. Critic rubric #1 checks the connection, not merely the presence of a URL.

- Numerical observations cite their inspected records, metric definition, denominator and capture window. Mark unavailable values as unobserved.
- Repeated content choices cite the relevant source set and counting rule. Retain counterexamples and distinguish shared origin from independent examples.
- Technical constraints cite the exact checked documentation or authorized account evidence for the route. A method file or generic platform homepage is not verification.
- Audio observations identify the track and inspected use context. Popularity does not establish permission, future decay or a ranking advantage.
- Recommendations label untested decisions as proposed tests and state what evidence could change them.

Use the exact source URL, available source date and inspection date. Unknown dates stay unknown. Quote only necessary permitted excerpts; retain their source and context. Do not reuse an excerpt as the producer's wording.

Construct an inline Markdown link using the observed item as its label and the captured URL as its destination. Follow it with the observation and its limits. Use only evidence actually inspected during the run.

## Review windows

| Field | Local review reminder | Evidence check |
|---|---|---|
| `platform_mechanics_date` | Review at 90 days; flag at 180 days | Recheck applicability to the selected account and route before relying on a changing requirement |
| `trend_signals_date` | Review at 14 days; flag at 30 days | Reinspect relevant use context before calling a trend current |

These intervals are scheduling defaults, not measured platform update cycles or audio half-lives. Earlier conflicting evidence requires earlier review. A recent date does not prove accuracy; an old publication date alone does not disprove an inspected current requirement.

Preserve `mechanics_sources_verified[]` with the actual source name, URL and available `last_updated` date. Record inspection dates separately. Leave the list empty when no technical claim was verified and report missing checks. Never fabricate source entries to pass rubric #4.

---

## Pattern Threshold

A "pattern" requires ≥3 occurrences in the platform's scout sample. Below 3 → "directional, not pattern" — listed as observed examples without abstraction.

This applies to:
- Hook archetypes
- CTA placement patterns
- Caption norms
- Failure modes

**Why this gate exists:** The workflow reserves the pattern label for repeated observations. The threshold is a local handling heuristic, not proof that two examples are coincidence or three establish a reliable effect. A smaller sample may motivate a clearly labeled test.

**Sample adequacy vs. confidence labeling.** The Sample-Size Flags and this Pattern Threshold are *sample-adequacy* gates — they decide whether a pattern may be claimed at all. Layered on top, each claimed pattern finding and each trending-audio call carries an H/M/L *confidence label* per [`confidence-labeling.md`](confidence-labeling.md) — the claim-level certainty tag (H/M/L by independent corroboration; any `L` resolved or flagged per its § 4). The two are orthogonal: a pattern can clear the n≥3 threshold yet still be `Confidence: M` if its occurrences are not independent (e.g. all from one creator's videos — see that file's § 3 on source independence).

---

## Platform specificity rule, critic rubric #3

Each material recommendation must identify a concrete production or route decision for the selected account and viewer task. Shared accessibility checks are valid when applied to a specific artifact. Do not invent a unique platform behavior to make recommendations differ.

A useful recommendation names the inspected problem, the proposed change and its evaluation. For example, a Reels crop check identifies the obscured result and intended placement; a Shorts route check identifies the destination lesson and required access. These are illustrative decision shapes, not observed findings.

Fail recommendations that lack an actionable decision, contradict their evidence or prescribe an unsupported ranking effect. A quota of platform-distinct bullets does not establish quality.

---

## Loop Cap

Critic loops max at **2 cycles**. After cycle 2 with any remaining FAIL, stop for the human: `done_with_concerns` is recorded as the internal grade with the failed rubrics' evidence pinned at the top of the artifact — it never ships.

This is a cost-discipline rule. Three cycles compounds research-spend with diminishing returns.
