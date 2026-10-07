---
title: Short-Form Research Playbook
lifecycle: canonical
status: stable
produced_by: ideas
load_class: PLAYBOOK
---

# Short-Form Research Playbook

**Worked example:** [`examples/shortform-research-walkthrough.md`](examples/shortform-research-walkthrough.md) — a full sourced per-platform catalog run end to end, with the `video` handoff.

## Why this skill exists

Short-form video platforms (TikTok, Reels, Shorts, plus X video and LinkedIn video by opt-in) move algorithmically — what worked 60 days ago may not work today. Briefs written from stale intuition produce content that misses the platform's current rewarded behaviors (hook archetype, opening-second pacing, sound trends, CTA placement). This skill replaces "intuition + last-year's-best-practice doc" with a per-platform, per-market, per-topic catalog of what's actually working *right now* — sourced from observable performers with citations, not made up by the model.

The catalog isn't a survey. It's a **catalog of bets**. The downstream consumer (`video`) reads this artifact to choose specific recommendations per asset ("TikTok hook should be credential-flash archetype in 0–1.5s — 8/12 in this sample"), not generic advice ("strong hooks matter"). Specificity is the contract.

Two windows decay at different rates:
- **Trend signals** decay fast — 14-day windows are deliberate. A trending sound from 30 days ago is already a tired echo.
- **Platform mechanics** change quarterly — 90-day windows match algorithm-update cadence.

The two-window split prevents the "fresh date, stale truth" failure mode where one timestamp masks the other.

## Methodology

**Catalog of bets, not a survey.** The artifact's job is to give the brief skill concrete patterns to bet on, with sample-size honesty about how strong each bet is. A pattern claimed at n=12 (OK) carries different weight than the same pattern at n=4 (LOW_SAMPLE) — both are reportable, neither is averageable, and downstream consumers see the flag.

**Citation is non-negotiable.** Every numerical claim, every named pattern, every cited mechanic has a source URL (video ID or platform doc) with a `last_updated` date inside the freshness window. Orphan claims fail critic rubric #1 and re-dispatch to the source agent.

**Single market per artifact.** Cultural patterns are not averageable. VN TikTok and US TikTok diverge on hook archetype, sound preference, and CTA tolerance. Multi-market campaigns re-run the skill per market — never mix findings in one artifact.

**Hard platform cap.** Default 3 (TikTok + Reels + Shorts). X video and LinkedIn video are explicit opt-in via `--all` or `--platforms`. Maximum ever is 5. The cap is cost discipline — research depth per platform matters more than platform breadth.

**Per-platform sections are non-fungible.** If a recommendation in the TikTok section would still be true if pasted into the Reels section, the recommendation is too generic and fails critic rubric #3. Platform specificity is the value.

## Principles

- **Sample-size honesty over sample-size pretense.** Declare OK (n≥8) / LOW_SAMPLE (n=3-7) / INSUFFICIENT_DATA (n<3) per platform. INSUFFICIENT_DATA means no pattern claims — only observed examples. Pretending n=4 is "enough" pollutes downstream briefs.
- **Two freshness windows, two timestamps.** `trend_signals_date` (14d/30d warn) AND `platform_mechanics_date` (90d/180d warn). Frontmatter records both. `mechanics_sources_verified[]` lists the actual doc URLs and their last-updated dates — not just the run timestamp.
- **ICP is soft-required.** Research without ICP underperforms — the audience-fit-agent flags `NEEDS_CONTEXT` and the brief skill downstream sees the flag. Operator can override (cold-start hint) but the warning persists.
- **Critic gate is 5 rubrics, 2-cycle cap.** PASS = record `done`. FAIL → re-dispatch named agents with feedback. After 2 cycles, stop for the human with internal grade `done_with_concerns`; failed rubrics pinned at top of artifact. Don't loop forever.
- **Conditional dispatch for audio.** `audio-trend-agent` runs only if TikTok or Reels is in scope. YouTube Shorts uses original audio more often; X/LinkedIn rarely use audio trends. Running it for non-applicable platforms wastes tokens and produces empty sections.
- **Look past the category and the year.** Search outside the product's category and outside the current year for formats. A strong candidate often joins a current format to an older proven one; record both sources.
- **Read crowding from creator spread.** In a niche search, count how many different creators appear. Many distinct creators suggest room to enter; the same few creators repeated suggest a crowded niche. Record the query and date with the reading.
- **The artifact IS the contract.** Output artifact frontmatter + body section order are consumed downstream by `video` (per-asset) and `results` (cycle-N scoring against the catalog). Contract changes require atomic updates to both consumers — never silently drift the schema.

## When NOT to use this skill

- **Long-form video** (15+ min YouTube, podcasts, full courses) — different platforms, different mechanics, different decay rates. Parked.
- **Static visual** (images, carousels, infographics) — use `creative` when installed, or
  return the production brief inline.
- **Per-asset brief** (specific hook, shot list, captions for one piece) — use `video` (marketing-stack); it consumes this catalog as input.
- **Audience research** (who buys, why) — use `position`. This skill assumes audience is known or will run with a cold-start hint.
- **Competitive landscape mapping** (TAM/SAM/SOM, competitor positioning) — use `position`. This skill mines patterns within platform feeds, not market dynamics.

## Further reading

- [Sequential fallback](../fallbacks/sequential.md) — Cold + Warm Start prompts + write-back map (host-dispatch procedures left in Git)
- [`anti-patterns.md`](anti-patterns.md) [ANTI-PATTERN] — failure modes
- [`format-conventions.md`](format-conventions.md) — date format, URL handling, citation format, per-platform ordering
- [`scoring-rubrics.md`](scoring-rubrics.md) — pattern-extractor + critic rubric definitions
- [`scout-protocol.md`](scout-protocol.md) — per-platform sourcing protocol
- [`platforms/`](platforms/) — per-platform research playbooks (tiktok, instagram-reels, youtube-shorts, twitter-video, linkedin-video, _comparison)
- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) — canonical Pre-Dispatch spec the procedure inherits from
- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) — `--fast` behavior (this skill is `budget: deep`; `--fast` collapses to single-pass scout+synthesis with critic skipped, but Critical Gates still enforced)
