# Sequential fallback

Use when the host cannot run copywriter, format-checker, critic, and (for launch listings)
launch-copywriter plus guard-checker as separate agents.

Keep the same method. Change only the machinery.

1. Apply [critical gates](../references/critical-gates.md): one platform, one market, explicit
   founder/company brand mode, max one format-check revision at baseline.
2. Load the matching pack from [platform-intelligence](../references/platform-intelligence/) plus
   [hook-archetypes](../references/hook-archetypes.md). Core surfaces are tiktok, reels, shorts, x,
   and linkedin. Product Hunt, Reddit, Show HN, Facebook, YouTube, newsletter, and the format packs
   (ugc, founder-demo, motion-background, launch variants) use the same sequence against their pack.
   If no pack covers the channel, use the Legibility Absent state — do not invent a pack.
3. Run [copywriter](../agents/copywriter-agent.md): hook variants (default 2), body, CTA, format spec,
   Legibility, and Why this works. Every hook names its opening choice and the body passage that delivers the promise.
4. Run [format-checker](../agents/format-checker-agent.md) against task-local constraints identified by pack §2 and
   [format conventions](../references/format-conventions.md). First REVISION_REQUIRED returns to the
   copywriter once. A second remaining violation is FORMAT_FAIL; do not dispatch critic.
5. Run [critic](../agents/critic-agent.md) against [rubric](../references/rubric.md) and
   [anti-patterns](../references/anti-patterns.md). Apply rubric verdict rules in order; hard failures and material gaps override totals. Run the
   discrimination test every cycle. Do not rewrite copy in the critic pass.
6. Re-work the named weak unit instead of swapping one generic opener for another.

Label this single-context. Do not call it independent corroboration. Do not manufacture engagement,
votes, consent, or customer voice. Publishing stays behind explicit human approval. Nothing here
requires `.forsvn` storage, a private sibling skill, or a hidden runtime.

Fail-closed stops: no actor, audience, or useful idea → stop before drafting; a claim without
supplied proof → mark unverified or cut it; unverified first-person lived experience → cut or label
proposed voice; native copy must not carry internal release bureaucracy (use “not publicly
released”); send/publish gates stay in operator notes, not native copy; do not open with a
population claim that has no sample; no authenticated account for the platform → deliver the
ready-to-post package only; FORMAT_FAIL or critic fail → return the failure honestly and never ship
or polish it as ready; the post decision stays with a human.

`--fast` sets the format-check loop to 0. `--deep` allows two format-check cycles. Neither skips
Cold Start, critical gates, or the discrimination test.

Polish (`editorial-polish` or `polish-vietnamese`) is terminal and only after pass or
done_with_concerns. Never polish a FORMAT_FAIL or critic fail.
