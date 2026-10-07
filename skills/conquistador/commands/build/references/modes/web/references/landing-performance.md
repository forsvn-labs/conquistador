---
title: Landing Page Performance
lifecycle: canonical
status: draft
produced_by: build
load_class: METHOD
---

# Landing page performance

Use when a request asks to make a landing or marketing page faster, or to raise a page-speed
score. The method is framework-neutral; adapt each rule to the project's stack.

## Measure first

1. Record the exact production URL, the mobile or desktop profile, the current metrics, and the
   failing audits before you change code.
2. Keep lab results and field Core Web Vitals separate. Never present one as the other.
3. Do not treat one run as conclusive. Compare medians from several runs on the same URL and profile.

## Fix in order

Fix the largest contentful paint (LCP) first, then interaction responsiveness (INP), then layout
shift (CLS), then transferred bytes and caching. For each step, make the smallest change that
removes the measured bottleneck, then measure again.

- **LCP.** Keep the hero headline in the first server-rendered HTML. Never hide a possible LCP
  element behind hydration, and never start its animation at zero opacity. Never lazy-load
  above-the-fold content or the LCP image. Give preload or priority only to real LCP candidates.
- **JavaScript.** Render on the server by default and make only the smallest interactive part a
  client component. Use native HTML, such as `<details>` and `<summary>`, or inline SVG when no
  interaction is needed. Load heavy libraries (3D, charts, editors, maps, video players) only on the
  route or interaction that needs them.
- **Images and fonts.** Serve images at accurate responsive sizes with set dimensions. Preload only
  the essential font weights, and keep metric-matched fallback fonts to prevent layout shift.
- **Caching.** Give static assets long immutable caching only when the release process renames or
  versions changed files.

## Report

Report a score only with a measured result for the exact production URL and profile, and name the
runs it came from. Do not remove accessibility, search content, or visual fidelity to raise a score.
A change that has not been measured in production is an untested cell in the
[test contract](test-contract.md), not a pass.
