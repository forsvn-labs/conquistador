# Sequential fallback

Use when the host cannot run diagnostic, polisher, and critic as separate agents.

Keep the same method. Change only the machinery.

Label this single-context. Do not call it independent corroboration.

## Register resolution

Priority: explicit register argument → brand-voice adjective map → content type → ask.

- `bao-chi` | `professional-product` | `semi-casual` | `bro` | `pop-marketing`. Reject hybrid values.
- `bro` requires `bro-otofun` or `bro-voz`. They are not interchangeable.
- Dialect defaults to `neutral`.
- `--fast` still resolves register and still enforces Absolute Prohibitions. It only skips diagnostic + critic (single-pass polisher).

If the source is not Vietnamese and the operator asked for Vietnamese: translate the
communication job and social relationship first (not English word order), then run the
pipeline on that Vietnamese. English-only tone work is outside this skill's scope; say so and stop
rather than naming a tool the host may not have.

## Sequence

1. If input is already Vietnamese, run [diagnostic](../agents/diagnostic-agent.md) against [translation-artifacts](../references/translation-artifacts.md) and [vn-tone-corpus](../references/vn-tone-corpus.md). Surface the violation log before rewriting when the operator may want to keep a Hard Tell (e.g. luxury `quý khách`).
2. Run [polisher](../agents/polisher-agent.md). Lock one pronoun pair at the start. Form, not content.
3. Run [critic](../agents/critic-agent.md) against the 36-point rubric and [absolute prohibitions](../references/absolute-prohibitions.md). PASS = ≥28/36 AND zero remaining Hard Tells. Any single Absolute Prohibition fails the run regardless of score.
4. FAIL → re-run polisher with critic feedback (max 2 cycles). Cycle 2 FAIL → stop for the human: return the best attempt with critic annotations and the internal `done_with_concerns` grade pinned. A standing gate failure never ships as done and never authorizes publish or send.
5. Claim regression: names, numbers, dates, quotes, conditions, uncertainty, and legal/technical meaning must match the source. Dates in body use DD/MM/YYYY.
6. Return the result inline by default. If the host supplies a durable artifacts directory and the
   operator asks for persistence, write there per [format conventions](../references/format-conventions.md).

Machine checks cannot grant a native-human verdict. Release-critical work still needs a named native reviewer.

Never invent facts, quotes, metrics, or consent while rewriting. Sending and publishing stay behind explicit approval.
