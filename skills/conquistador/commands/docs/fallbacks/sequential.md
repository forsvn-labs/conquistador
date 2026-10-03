# Sequential fallback

Use when the host cannot run scanner, audience-profiler, concept-extractor, writer,
staleness-checker, and critic as separate agents.

Keep the same method. Change only the machinery. Label the result **single-context**, not
independent corroboration.

1. Scan the project with [`../agents/scanner-agent.md`](../agents/scanner-agent.md): structure,
   file-importance map, and existing docs inventory.
2. Profile the audience with [`../agents/audience-profiler-agent.md`](../agents/audience-profiler-agent.md):
   reader, vocabulary, depth, and assumed knowledge.
3. Extract concepts with [`../agents/concept-extractor-agent.md`](../agents/concept-extractor-agent.md):
   features, setup, config, errors, and evidence from the highest-ranked files.
4. Write with [`../agents/writer-agent.md`](../agents/writer-agent.md) using
   [`../references/doc-template.md`](../references/doc-template.md) or the route template
   ([`ship-log-template.md`](../references/ship-log-template.md) / mode refs under
   [`../references/modes/`](../references/modes/)).
5. Staleness-check with [`../agents/staleness-checker-agent.md`](../agents/staleness-checker-agent.md)
   against current code, config, and schemas.
6. Critic-pass with [`../agents/critic-agent.md`](../agents/critic-agent.md) and
   [`../references/anti-patterns.md`](../references/anti-patterns.md). Max two revision loops.

Method context: [`../references/docs-writing-method.md`](../references/docs-writing-method.md),
[`../references/intake-prompts.md`](../references/intake-prompts.md),
[`../references/artifact-paths.md`](../references/artifact-paths.md),
[`../references/report-template.md`](../references/report-template.md).

Prefer `.forsvn/artifacts/product/write-technical-docs/` for skill-owned durable artifacts
(ship-log / audit / intake notes). Project README, `docs/`, and `CHANGELOG.md` stay as named
destinations. Never overwrite human-authored docs merely to create a versioned artifact. Never
publish a release or mutate infrastructure without explicit approval.
