# Plugin reading-list hooks

`conquistador-hook.mjs` runs the prompt, stop, and Cursor start hooks. Set
`CONQUISTADOR_HOOKS=off` or `{"hooks": false}` in the user config to disable them.

A relevant prompt starts a new reading requirement; every new nonempty prompt first clears
prior state, including coding requests and short clarification replies. A short clarifying
question can stop before reading. A missing-read correction is issued at most once per task;
recursive stop events are ignored. Hooks make no network calls.

## What the evidence means

The guard checks whether the current task's successful, ID-paired tool results returned each
selected file's complete normalized text. It does not establish model attention, correct
application, answer quality, or human acceptance.

- Scope uses the transcript byte boundary captured at prompt time and verifies its prefix digest.
  Without that boundary, only an exact human prompt timestamped at or after the saved task start
  establishes scope. A previous identical prompt does not qualify.
- Adapters understand Claude `tool_use`/`tool_result` messages and Codex-style
  `response_item` function calls/outputs, plus explicitly recognized direct call/result forms.
  File reads, MCP reads, and simple shell reads need exact file identity and full matching text.
  Host line endings and outer whitespace are normalized; all internal text must match.
- Brief results carry file IDs, UTF-8 byte lengths, SHA-256 digests, and end markers. Only verified
  complete blocks qualify. An earlier complete block can qualify when a later block is truncated.
  Budget omissions and unavailable files remain explicit; tool-name mentions never qualify.
- Unverified files are labeled `missing`, `failed`, `omitted`, `truncated`, `incomplete`, or
  `unavailable` when the transcript provides that distinction. Partial chunks are not combined
  into an inferred full read. Unknown formats do not count as evidence.
- Missing, rotated, unscoped, or over-32-MiB transcripts fail open without claiming coverage.
  Unexpected hook errors also exit successfully without blocking unrelated host work.

`node --test tools/conquistador-hook.test.mjs tools/skills-mcp.test.mjs` exercises synthetic,
offline transcript and protocol fixtures. This is not live compatibility evidence for any host.
