---
name: doctor
description: "Find and repair drift between the Conquistador install, its hook manifests, and this project's PRODUCT.md, GROWTH.md, and .conquistador/ files."
metadata:
  version: 1.0.0
---

# Doctor

Find what is out of step, repair what a copy can repair, and tell the user the one next step.

## Run the check

1. Run `conquistador doctor --json` in a shell. If `conquistador` is not on PATH, run
   `npx @forsvn/conquistador doctor --json`.
2. Read `checks`. Each check has an `area` (`install`, `hooks`, or `project`), a `status`
   (`ok`, `warn`, or `fail`), a `detail`, and `fixable`.
3. Report the result in a short table: area, status, what is wrong. Leave out `ok` rows unless the
   user asks for the full list.

If no shell is available, do the checks by reading files:

- Install: the skill folder has `.conquistador-owned.json`, and its `version` matches the
  `metadata.version` the user expects. A project copy lives in `.claude/skills/conquistador/`,
  `.agents/skills/conquistador/`, `.grok/skills/conquistador/`, `.hermes/skills/conquistador/`, or
  `.kiro/skills/conquistador/`.
- Hooks: each plugin manifest (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
  `.cursor-plugin/plugin.json`) names a hook file that exists, and every `hooks/*.mjs` script that
  file runs exists.
- Project: `PRODUCT.md` and `GROWTH.md` exist at the project root. When `.conquistador/` exists,
  `.gitignore` has an entry for it.

## Repair

- `fail` with `fixable: true`: ask once, then run `conquistador doctor --fix`. Run
  `conquistador doctor --json` again and report what changed.
- `fail` that is not fixable: give the exact command from the detail, for example
  `conquistador --providers=claude --scope=global -y`.
- Missing `PRODUCT.md` or `GROWTH.md`, a GROWTH.md section that is missing, or a missing
  `.gitignore` entry: run `/conquistador init`. Init owns these files. Doctor never writes them.
- Hooks off: tell the user where they were turned off (`CONQUISTADOR_HOOKS=off` or
  `~/.conquistador/config.json`). Turn them on only when the user asks.

## Rules

- Doctor changes only Conquistador's own copies. Never edit an agent's settings files by hand.
- Never delete a folder that has no `.conquistador-owned.json`. Report it instead.
- After a repair, tell the user to start a new agent session so the host loads the new files.
