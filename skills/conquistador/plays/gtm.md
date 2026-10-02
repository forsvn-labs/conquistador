---
command: gtm
label: Position a product and run its first campaign
intents: ["go to market","go to market plan","gtm plan","gtm strategy","position and campaign","position to campaign","positioning and first campaign"]
chain:
  - { command: position }
  - { command: campaign }
  - { command: copy, for: "the finished primary asset" }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: measure, for: "the first qualified signal and reversal condition" }
legacy: position-to-campaign
---
# Position a product and run its first campaign

Use when the product needs an evidenced audience and position carried through to one first
campaign, rather than isolated copy.

1. Use `position` to settle the audience, costly moment, alternatives, promise, mechanism,
   proof, objection, and assumption boundary.
2. Use `campaign` to choose one observable outcome, channel role, sequence, asset inventory,
   budget boundary, and stop rule.
3. Use `copy` or the channel-native creation outcome for the finished primary asset.
4. Use `measure` to define the first qualified signal and reversal condition.

Keep one decision spine across the position and every asset. Do not manufacture customer language,
proof, market size, or outcome claims; when evidence is thin, make the campaign a learning test.

Run `audit` on the finished package before the Review Packet.

End with one terminal Review Packet for final human review: the bet, ready-to-use campaign and asset,
consequential choices, evidence boundary, and one next action.
