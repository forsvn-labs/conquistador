# Worked Example — highway billboard for a $9 launch

> **FICTIONAL FIXTURE.** The brand marks, URL, price, and critic scores are invented teaching data;
> the run never happened. The internal critic score is a quality gate only — the human acceptance
> and vendor-template verification below stay outstanding regardless of the score.

**Brief:** Bulletin billboard (14×48 ft), highway placement (~65 mph, ~250 ft read distance). Message: drive awareness of the $9 Pro launch. Goal: brand + the price anchor. Brand: a fictional studio mark (Forest Shadow / Leaf palette).

## Concept
- **One idea:** the price is the hook — "$9. Always current."
- **Dominant visual:** the number $9 huge in Leaf on a Forest-Shadow field; a single thin "freshness" contour motif behind it (brand material), nothing else.
- **The line (≤7 words):** "Marketing skills that stay current. $9." → tightened to **"Always-current marketing skills. $9."** (5 words + price).
- **Earns the glance:** a saturated Leaf number on a warm-dark field on a highway of grey boards.

## OOH Spec
- Dimensions 14×48 ft; design to the vendor template (commonly ~10–15 DPI at full size — confirm vendor).
- Min letter height for ~250 ft: ~25 in (≈1 in / 10 ft). The "$9" reads at ~6+ ft tall; the line at ~25 in.
- Contrast: Leaf `#74B36B` / Warm Cream on Forest Shadow `#0A120D` — high contrast, holds in sun + at night (backlit).
- Safe margins: vendor template; logo + URL inside the safe area, nothing critical in the bleed.

## Copy
"Always-current marketing skills." · **$9** · `example-brand.com` (fictional placeholder URL — NOT a QR; nobody scans at 65 mph).

## Render Manifest
Prompt + slots: {brand logo (corner), the "$9" type block (Leaf), the line (Cream), the contour motif, the URL}. `execution_mode: brief-only` (an operator engine renders to the vendor template). Per `fallbacks/sequential.md`.

## Production Notes
Vinyl bulletin; backlit at night (contrast already holds); ~2–3 week production + install lead time; confirm the vendor's exact template + bleed before final render.

## Internal critic gate → 41/50 (quality gate only)
3-second read 9 (number + 5-word line + URL), Single idea 9 (the price), Legibility 8 (letter math confirmed; flagged "confirm vendor DPI"), Format fidelity 7 (traced to a generic bulletin spec — `done_with_concerns` until the vendor template is pulled), Brand 8. Net: **internal gate passed with concerns** — nothing ships from this score; the vendor template must be pulled and a human must accept the concept before production (anti-pattern 6 guard).
