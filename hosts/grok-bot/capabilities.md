# Official xAI Grok Bot capabilities

## Host provides

- Grok Bot app identity, conversation, and memory for this Bot.
- Settings → Plugins packaged-skill install and per-Bot enablement.
- Optional computer, connectors, and routines the operator turns on in that app.

## Conquistador owns

- Bot profile in `bot-profile.md`.
- Canonical skill methods and review packet.
- The rule that send, publish, spend, and external writes need a human.

## Missing in this package

- Official listing and operator credentials.
- Grok CLI plugin layout (`.grok/`, `grok plugin`, hooks, MCP, LSP).
- Computer, connectors, and routines until enabled in the app.
- Conquistador runtime, catalog, Eval Lab, desktop app.

Behavior when missing: fail-closed-draft.

## Video analysis prerequisites

`analyze-video` additionally needs local file access, code execution, Gemini credentials and
permission to upload the selected video. This package supplies none of those capabilities.
If any is unavailable, report video analysis as unavailable and do not claim to have watched it.
