# Sequential fallback

Use when the host cannot run segment-planner, logistics-director, and critic as separate agents.

Keep the same method. Change only the machinery.

1. Establish the event contract from `SKILL.md`: type, date/time zone, duration, attendee outcome,
   qualified next action, format, audience, cast, venue/platform, recording/consent, decision owner.
2. Plan timed segments with `agents/segment-planner-agent.md` (budget backwards from the ask; protect
   the payoff; park 5–10% buffer).
3. Add owners, cues, preflight, and contingencies with `agents/logistics-director-agent.md`.
4. Stress-test with `agents/critic-agent.md` against `references/anti-patterns.md` (timing integrity,
   ownership, cue clarity, goal service, contingency coverage; frozen-host test).
5. Deliver per `references/format-conventions.md` under `.forsvn/artifacts/mkt/create-run-of-show/`.

Label this single-context. Do not call it independent corroboration. Do not invent readiness,
consent, or attendance. Scheduling, invites, live-platform changes, recording start, and follow-up
sends stay behind explicit human approval for the exact action.
