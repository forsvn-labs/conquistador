# Sequential fallback

Use when the host cannot run platform-scout, audience-fit, pattern-extractor, audio-trend, synthesis,
and critic as separate agents.

Keep the same method. Change only the machinery.

1. Bound topic, market, channels, formats, freshness windows, exclusions, and what evidence would
   make an angle worth producing. One market per artifact. Treat named channels and frozen source
   sets as closed scope. Default to TikTok + Reels + Shorts only for an otherwise unspecified
   short-form-video request.
2. Run [platform-scout](../agents/platform-scout-agent.md) once per platform when current platform
   evidence is required. For a frozen-source or non-platform brief, record the supplied evidence and
   skip scouting rather than inventing a video platform. Using
   [scout protocol](../references/scout-protocol.md) and the matching pack under
   [platforms](../references/platforms/). Capture URLs, observable metrics, inspected opening context, audio, caption and CTA. The legacy opening field is an observation segment, not a retention deadline.
3. Run [audience-fit](../agents/audience-fit-agent.md): ICP / product context / cold-start hint →
   register, language polish, sensitivity flags. No ICP and empty hint → NEEDS_CONTEXT toward
   `research-positioning`.
4. Run [pattern-extractor](../agents/pattern-extractor-agent.md): recurring hook archetypes with
   SAMPLE OK / LOW_SAMPLE / INSUFFICIENT_DATA honesty per
   [scoring rubrics](../references/scoring-rubrics.md).
5. If TikTok or Reels video is in scope, run [audio-trend](../agents/audio-trend-agent.md). Skip for
   text, frozen-source work, Shorts-only, X, or LinkedIn unless the brief forces it.
6. Synthesize with [synthesis](../agents/synthesis-agent.md) into the catalog shape in
   [format conventions](../references/format-conventions.md). Recommendations must be
   platform-specific.
7. Gate with [critic](../agents/critic-agent.md) and [anti-patterns](../references/anti-patterns.md).
   Five binary PASS required. Max two rewrite cycles; then stop for the human with internal grade `done_with_concerns` and concerns pinned.

Label this single-context. Do not call it independent corroboration. Do not invent metrics, mix
markets, or schedule / publish. Production briefs stay with `create-shortform`. Nothing here
requires `.forsvn` storage, a private sibling skill, or a hidden runtime; return everything in-thread.

Fail-closed stops: no ICP and empty cold-start hint → NEEDS_CONTEXT toward `research-positioning`;
a load-bearing volatile claim you cannot verify → reject or label the angle unverified; no
authenticated platform access → record the gap as unknown, never simulate platform data;
critic FAIL after two rewrite cycles → stop for the human with internal grade `done_with_concerns`; selection stays
advisory until a human picks what to produce.

`--fast` collapses to single-pass scout + synthesis with critic skipped, but Critical Gates still
apply. Load [content ideas method](../references/content-ideas-method.md) when teaching the skill
or deciding whether to run it.
