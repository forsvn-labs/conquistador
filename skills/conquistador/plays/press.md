---
command: press
label: Earn press and media coverage
intents: ["press","press coverage","pr campaign","pitch journalists","podcast outreach","earned media","media pitch","pitch reporters"]
chain:
  - { command: channels, for: "outlets and people who reach the audience" }
  - { command: position, for: "the newsworthy story" }
  - { command: outreach, for: "signal-led pitches" }
  - { command: results, mode: outreach, when: "real placement or response evidence exists" }
legacy: earned-media-outreach
---
# Earn press and media coverage

Use for press, podcast, newsletter, analyst, creator, or other earned-media opportunities.

1. Use `channels` to identify the communities, outlets, and people who actually reach the
   intended audience.
2. Use `position` for the newsworthy story, audience, proof, angle, and alternative
   boundary.
3. Use `outreach` for concise signal-led pitches and reply handling.
4. Use `results` or `measure` only after real placement or response evidence exists.

Require an observed relevance signal—something the person or outlet has actually covered—before
pitching. Do not invent coverage, fabricate quotes, mass-personalize a list, or offer undisclosed
incentives. Publishing, seeding, sending, and placed-content agreements remain human-owned.

End with one terminal Review Packet for final human review: opportunity set, selected angle, ready
pitches, source and disclosure boundary, and one next action.
