---
title: Polish Vietnamese Method
lifecycle: canonical
status: stable
produced_by: vietnamese
load_class: METHOD
---

# Method — Why `vietnamese` exists

## Why this skill exists

Machine-translated and non-native Vietnamese fails in four predictable ways that no amount of "more context" can fix without targeted work: wrong pronoun pair for the register, missing sentence-final particles that carry casual warmth, literal idiom calques that land as nonsense, and corporate translationese that stacks abstract nouns the way English does. These are not creative-writing problems — they're register-mechanics problems. The polisher's job is to operate on form, never on content, and to do it inside a register the user has explicitly named (or is willing to confirm).

This skill is the polish-chain endpoint for Vietnamese output across the marketing stack. Upstream skills that produce VN prose (`video`, `social`, `copy`, `ads`, `outreach`, `seo`, `brand`, `campaign`) should invoke `vietnamese` whenever `market = VN`. This skill does not route back — it is the terminus.

## Why this skill exists at all

Five failure modes it prevents:

1. **MT-default corporate stiffness.** "Quý khách thân mến!" / "Chúng tôi rất hân hạnh chào đón quý khách" — MT systems default to corporate-formal regardless of brand voice. Critical Gate 2 + critic Pass 2 force register resolution upfront, then enforce the chosen register through pronoun-pair holding.
2. **Pronoun pair drift.** Opening with `chúng tôi ↔ quý khách`, switching to `mình ↔ bạn` mid-paragraph, ending with no pronouns at all. Absolute Prohibition #5 + critic auto-FAIL on any drift make this binary, not graded.
3. **Cliché stack.** `Giải pháp toàn diện`, `trải nghiệm đột phá`, `tối ưu hóa`, `chuyển đổi số`, `hành trình` — corporate-translationese fingerprints. Absolute Prohibition #7 forbids stacking two in one paragraph; polisher's job is to delete them when stacked, not polish around them.
4. **English typography intrusion.** Em dashes (`—`), Oxford commas before `và`, title-case headlines, smart quotes. These are English habits that signal "translated" instantly. Absolute Prohibition #1 + critic Typography Pass enforce typography correctness as a binary gate.
5. **Fact alteration disguised as polish.** "Improving flow" by quietly cutting a number, rewording a quoted statement, or dropping a named example. Critical Gate 3 + critic Meaning Preservation Pass treat this as auto-FAIL. Polish is form-only.

The structural answer is the **36-point critic rubric** (in `agents/critic-agent.md`) — three passes (Hard Tells binary / Register Consistency / Read-Aloud Naturalness) plus Meaning Preservation + Typography Correctness. PASS = ≥28/36 AND Hard Tells cleared = 1. Any single Hard Tell remaining = auto-FAIL regardless of total score.

## Philosophy

Vietnamese register is carried almost entirely by **pronouns, sentence-final particles, vocabulary choice (Sino-Vietnamese vs. native), and sentence rhythm**. A single wrong pronoun ruins the whole register. A missing particle makes the sentence sound translated-from-English.

The polisher operates on form, not content. Meaning is preserved unconditionally — numbers, names, dates, quoted statements, claims, and named examples must survive intact. If the original has a fact, the polished version has the same fact.

Register is pair-locked. The polisher picks one pronoun pair (self ↔ reader) at the start and holds it to the end. Drift is the #1 translation giveaway — catching it is the critic's primary gate.

**Form > vibes > "creative interpretation".** Every fix cites a rule from `translation-artifacts.md` (28-pattern catalog) or `vn-tone-corpus.md` (register profiles). No vibes-based polishing; no vibes-based criticism.

## Methodology

**Three-agent pipeline, deliberate.** Diagnostic → Polish → Critic. Each pass has a different focus (detect / fix / verify). Combining them produces worse results because the polisher rewrites by vibes instead of working off a violation log, and the critic re-diagnoses instead of verifying.

**Diagnostic gates the polish.** The diagnostic agent produces a violation log + register-gap assessment + rewrite-scope estimate (light / moderate / heavy). The orchestrator surfaces this to the user before dispatching the polisher — if the user wants to override specific Hard Tells (e.g., "keep `quý khách` — luxury brand directive"), they pass `user_directives` to the polisher. This gates the polish on user-confirmed intent, not autopilot.

**Critic is verification, not re-diagnosis.** The critic trusts the diagnostic log as the baseline and verifies the polisher's output against it. The critic does NOT re-run the diagnostic; that's scope creep.

**Two-cycle rewrite cap.** If the critic FAILs cycle 1, polisher re-dispatched with critic feedback as `feedback` input. If cycle 2 also FAILs, stop for the human: return the polisher's best attempt with critic annotations and the internal `done_with_concerns` grade — it is not a completed delivery and authorizes nothing downstream. The transparency IS the value.

**Single market per artifact.** This skill is Vietnamese-only. Multi-market campaigns re-run per market.

## Principles

- **Hard Tells are binary.** Any single Hard Tell remaining = auto-FAIL regardless of total score. Pass 1 of the critic is a gate, not a scoring dimension.
- **Pronoun pair is non-negotiable.** Drift is the #1 MT giveaway. Pair held = 10/10 on critic Pass 2; one drift = 6; two drifts = 3; three or more = 0 and auto-FAIL the pass gate.
- **Particle density is range-bound.** Báo chí: 0% (any particle = auto-FAIL Absolute Prohibition #4). Casual/pop/bro: 15–25% range. Over-injection (every sentence ending `nha`) is as wrong as zero.
- **Subvariants are non-interchangeable.** `bro-otofun` (Hanoi cụ-mợ, "em + cụ") and `bro-voz` (Voz ae-thím, "mình + ae") are distinct speech communities. Mixing them in one piece = critic auto-FAIL.
- **Polish is form-only.** Touching facts, numbers, or named examples to "improve flow" is auto-FAIL on Meaning Preservation. Preserve every factual anchor; flag rather than cut.
- **Loanwords calibrate by register.** `API`, `webhook`, `gaming`, `router` are fine in semi-casual tech. Drop in báo chí; keep in semi-casual/pop where natural. No blanket overscrubbing.
- **The artifact IS the contract.** Frontmatter (8 fields) + body sections (Polish Summary table + Change Log table + Polished Text + Status block) follow a fixed schema. Schema changes require atomic update of any consumer that reads `vietnamese` output.

## When NOT to use this skill

The live front door may create, rewrite, or translate into Vietnamese. The recovered diagnostic / polisher / critic still operate on Vietnamese. If the source is not Vietnamese, translate the communication job first (not English word order), then run the recovered register pipeline on the Vietnamese result.

- **English-only tone work with no Vietnamese target.** Out of scope here: say so and stop rather than naming a tool this install may not have.
- **A/B variants of already-polished text.** Use `copy` for variant generation; this skill is a register pass, not a multi-variant generator.
- **Mixed-language text (Vinglish, code-switching).** Flag to the operator. Default: polish VN portions, preserve EN loanwords unless the operator asked to convert them.

## Further reading

- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) — Register Resolution, Absolute Prohibitions, diagnostic → polish → critic, `--fast`
- [`anti-patterns.md`](anti-patterns.md)
- [`format-conventions.md`](format-conventions.md)
- [`absolute-prohibitions.md`](absolute-prohibitions.md)
- [`examples/vn-tone-walkthrough.md`](examples/vn-tone-walkthrough.md)
- [`vn-tone-corpus.md`](vn-tone-corpus.md)
- [`translation-artifacts.md`](translation-artifacts.md)
