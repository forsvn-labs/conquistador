# Sequential fallback

Use when the host cannot run graphic-brief, asset-production, and out-of-home agents as
separate subagents.

Keep the same method. Change only the machinery. Label this single-context. Do not call it
independent corroboration.

## Choose the lens

Name the work before applying a method:

1. **Graphic brief** — landing, campaign graphic, product preview, social static, designer handoff.
2. **Asset production** — render-ready prompts / manifests from an approved brief.
3. **Out-of-home** — billboard, transit, poster, wrap; three-second read at real distance/speed.

Do not blend lenses into one mushy pass. Run the matching sequence below.

## Graphic-brief lens

In bounded inline parent composition, use one supplied-source concept, skip intermediate approval,
and stop at the advisory brief. The three-candidate and brand-file gates below apply to standalone
file/production mode.

1. Anchor audience, viewing context, communication job, mechanism, proof, destination, format, and
   constraints from `SKILL.md`.
2. Load brand grounding with `agents/brand-anchor-agent.md` and
   `references/realized-surface-grounding.md`.
3. Generate three distinct concepts with `agents/concept-agent.md` + `references/asset-types.md` /
   `references/failure-modes.md`.
4. Lock copy hierarchy with `agents/copy-anchor-agent.md`.
5. Synthesize the brief with `agents/brief-synth-agent.md`.
6. Route handoff: `agents/prompt-craft-agent.md` (image-gen) or `agents/figma-spec-agent.md`
   (designer / vector).
7. Critic with `agents/critic-agent.md` + `references/visual-rubric.md` +
   `references/anti-patterns.md`.
8. Follow `references/graphic-brief-method.md` and `references/format-conventions.md`. Write under
   the host's durable artifacts directory (for example `.forsvn/artifacts/mkt/brief-creative/`)
   when one exists; otherwise return the brief inline.

## Asset-production lens

1. Take an approved brief as source of truth (do not invent a brief).
2. Author per-slot prompts with `agents/prompt-author-agent.md`, loading
   `references/image-engine-dialects.md`, `references/render-engines.md`, and
   `references/production-pattern.md` as needed.
3. Enforce `references/asset-critical-gates.md` (no hallucinated logos, aspect/safe zones, verbatim
   copy).
4. Gate with `agents/asset-critic-agent.md` + `references/asset-anti-patterns.md`.
5. Deliver the manifest + prompts per `references/asset-format-conventions.md` under
   `.forsvn/artifacts/mkt/brief-creative/`. This skill emits prompts; it does not call render APIs
   unless the user asked and a tool is available.

## Out-of-home lens

1. Establish placement, viewing distance/speed, lighting, vendor template, and one message.
2. Concept with `agents/ooh-concept-agent.md` (one idea, visual-first, word ceiling).
3. Spec letter-height / contrast / bleed / safe margins with
   `agents/ooh-spec-legibility-agent.md`.
4. Critic with `agents/ooh-critic-agent.md` (drive-by / three-second test) +
   `references/ooh-anti-patterns.md`.
5. Deliver per `references/ooh-format-conventions.md`, under the host's durable artifacts directory
   when one exists.

## Shared rules

- Prefer `create-brand` for brand-system tokens; name `create-shortform` for short-form video briefs
  without linking into that skill directory.
- Vietnamese copy cleanup may be delegated to the public `polish-vietnamese` skill when installed;
  it is optional and grants no publish or acceptance authority.
- An internal critic PASS is a quality gate, not completion. The job ends only at explicit human
  acceptance of the brief/handoff; a standing critic failure stops the run for the human instead of
  shipping.
- Never invent logos, product UI, people, metrics, or consent. Production orders, uploads, and
  publishing stay behind explicit human approval.
