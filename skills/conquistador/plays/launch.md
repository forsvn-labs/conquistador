---
command: launch
label: Launch a product or feature
intents: ["launch","product launch","product hunt launch","launch our app","launch plan","relaunch","go to market for a release","launch day","launch product"]
chain:
  - { command: position, when: "no accepted positioning in PRODUCT.md or GROWTH.md" }
  - { command: campaign }
  - { command: social, for: "channel-native launch posts and listing" }
  - { command: copy, for: "launch page and email" }
  - { command: creative, when: "the launch needs gallery or media assets" }
  - { command: event, when: "the launch has timed people, rooms, demos, or live dependencies" }
  - { command: measure }
legacy: launch-product
---
# Launch a product or feature

Use for a focused product launch or relaunch on one or more named channels.

1. Use `position` only when audience, costly moment, promise, mechanism, or proof is
   unresolved.
2. Use `campaign` for the qualified outcome, channel roles, preparation, sequence, asset
   inventory, owners, contingencies, and decision signal.
3. Use `social` and `copy` for the finished listing, posts, page, response bank, and
   follow-up; use `creative` for truthful gallery or media assets.
4. Use `event` when the launch has timed people, rooms, demos, or live dependencies.
5. Use `measure` for qualified activation, objections, and the keep/revise/stop decision.

Read the launch-run playbooks in [launch/](launch/) (launch architect,
bundle critic, launch-chain spec). Channel-native listing copy also loads `social`
`launch-copywriter-agent` and `guard-checker-agent`.

Load each relevant channel note and verify current platform rules. Preserve the Product Hunt listing,
maker-comment, gallery, and reply depth and the X sequence/reply depth when those channels apply.
Never fabricate proof, script fake engagement, or publish.

End with one terminal Review Packet for final human review: launch bet, complete ready-to-use package,
evidence and rule checks, release boundary, and one next action.
