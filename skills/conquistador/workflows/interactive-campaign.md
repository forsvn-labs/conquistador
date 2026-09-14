# Interactive-campaign workflow

Use privately for a minigame, calculator, quiz, simulation, challenge, or other interactive growth
asset.

1. Use the bounded `plan-campaign` slice for the campaign job, audience, value exchange, one owned
   placement, economics, signal, and stop rule. Do not expand into a full launch sequence, nine-channel
   scan, or hero-asset cascade unless the user asks for a broader campaign.
2. Use the bounded inline `brief-creative` slice for the mechanic, rules, states, content,
   visual/interaction requirements, and production acceptance. Supplied brand facts are enough for a
   portable brief; missing files or realized surfaces become labeled execution gaps, not a hard block.
3. Use `map-user-flow` when the interaction has consequential branches, permissions, or recovery.
4. Use `measure-growth` for comprehension, completion quality, qualified action, and guardrails.

Load recovered minigame method under `conquistador/references/interactive-campaign/` (mechanic
designer, reward funnel, critic) instead of paraphrasing it.

Load only the example that matches the declared mechanic. Deterministic, no-prize work uses
[`assessment-walkthrough.md`](../references/interactive-campaign/references/examples/assessment-walkthrough.md).
The spin-the-wheel example is chance-game-only and must not enter a deterministic assessment's
context.

The mechanic must teach or demonstrate a real product/customer decision. Define an earned win and
meaningful failure; never use fake-win wheels, fabricated scarcity, or a prize as the only value. The
useful takeaway must remain available without conversion.

Default to a deterministic assessment, calculator, simulator, challenge, or product demonstration
when it fits the job. Prize, chance, odds, redemption, referral, capture, and prize-law fields are
strictly conditional. Do not add them to a no-prize interaction or treat their absence as incomplete.

End with one terminal Review Packet for final human review: campaign job, buildable mechanic and states,
truth/fairness boundary, test rule, and one next action.
