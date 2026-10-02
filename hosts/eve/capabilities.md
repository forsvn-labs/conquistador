# Eve capabilities

## Host provides

- Model and agent loop.
- `load_skill` over `agent/skills/`.
- Optional sandbox, memory, channels, connections, and approval UI from the consuming Eve app.

## Conquistador owns

- Default teammate contract in `instructions.md`.
- Canonical skill methods and review packet.
- The rule that send, publish, spend, and external writes need a human.

## Missing in this package

- Eve tools, hooks, MCP, channels, schedules.
- Conquistador runtime, catalog, Eval Lab, desktop app.
- Public `eve add` listing.

Behavior when missing: fail-closed-draft.

## Video analysis prerequisites

`watch` additionally needs local file access, code execution, Gemini credentials and
permission to upload the selected video. This package supplies none of those capabilities.
If any is unavailable, report video analysis as unavailable and do not claim to have watched it.
