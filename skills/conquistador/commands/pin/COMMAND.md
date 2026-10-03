---
name: pin
description: "Make a standalone shortcut, such as /outreach, for one Conquistador command"
metadata:
  version: 1.0.0
---

# pin and unpin

`pin` makes a standalone shortcut for one command. After `/conquistador pin outreach`, the user
can type `/outreach` (`$outreach` in Codex). The shortcut runs `/conquistador outreach` with the
user's request. `unpin` removes it.

When `conquistador` is not on PATH, run `npx @forsvn/conquistador` in its place.

## Pin

1. Run `conquistador pin <command>`. Add `--project` when the user wants the shortcut only in this
   repository. Add `--as <name>` when the user wants another name.
2. Report the result in one or two lines: the files written and what to type.
3. Relay an error message exactly.

The CLI writes one `SKILL.md` for each installed agent: Claude Code, Codex, Cursor, GitHub
Copilot CLI, Grok CLI, and Gemini CLI. Each file carries the marker
`<!-- conquistador-pinned-skill -->`.

- It skips a folder that holds a skill it did not write. Tell the user, and suggest `--as`.
- It refuses names that agents use for built-in commands, such as `init`, `review`, `doctor`,
  `plan`, and `feedback`. Suggest `--as`, for example `conquistador pin review --as growth-review`.
- The agent may need a restart before the shortcut shows.

## Unpin

1. Run `conquistador unpin <name>`. Add `--project` for a project shortcut.
2. Report the files removed.

`unpin` removes only files that carry the marker. It never removes a skill the user wrote.
