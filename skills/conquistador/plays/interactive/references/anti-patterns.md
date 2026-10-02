# Anti-Patterns — interactive campaign

7 patterns. The critic checks each before ship; the dark-pattern one is an auto-BLOCK.

1. **Fake-win dark pattern.** A rigged "You won" that leads to a paywall or a non-prize. *Detect:*
   the result is false, or applicable odds are hidden. *Fix:* remove the deception. If a real chance
   prize exists, disclose real odds and honor the prize. **Auto-BLOCK if unremoved.**

2. **Friction before value.** An email/data wall before the participant receives a useful result.
   *Detect:* capture is the entry gate. *Fix:* make capture optional and place it after the result,
   only when a real follow-up value needs it.

3. **Unbounded promise.** A result, service, or reward whose cost cannot be honored at test or spike
   volume. *Detect:* no cost/limit model for the actual promise. *Fix:* bound the promise. Apply tiers,
   odds, and redemption caps only when prizes actually exist.

4. **No useful end state.** The interaction neither returns a useful result nor names a proportionate
   next step. *Fix:* finish the result first; add an optional CTA only when the campaign job needs one.

5. **Gambling-regulation-blind.** Prize draws / sweepstakes with odds + value but no compliance thought. *Detect:* no jurisdiction/T&Cs/age-gate/"no purchase necessary" flag. *Fix:* surface the compliance question (not legal advice) so the operator handles it.

6. **Inaccessible.** Relies on color, motion, or fine motor control with no fallback. *Detect:* no
   keyboard path, color-only states, no reduced-motion. *Fix:* accessible states; do not gate the
   useful result behind an inaccessible interaction.

7. **Off-brand.** A generic casino-like or template interaction that conflicts with the declared
   customer brand. *Detect:* recovered house styling or a gaudy chance metaphor replaces supplied
   facts/tokens. *Fix:* use only the declared brand source; if none exists, specify semantic roles and
   label visual execution as unresolved.
