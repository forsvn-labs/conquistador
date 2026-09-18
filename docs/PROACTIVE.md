# Opt-in proactive advice

`tools/proactive.mjs` is a host-neutral local helper for Node 24. An operator can connect
explicit host events to this helper. Session and delivery events return static advice. The
`prompt-submitted` event uses `tools/context-selection.mjs` and the installed routing contract
to select methods, then returns a bounded request context with required resources, deferred stages,
one composition workflow, and one specialist role. It does not execute the selected work.

This is the optional hook input for Conquistador mode. It supplies an instruction to the parent. It
does not create specialist agents. After the host delivers the instruction, the parent may use
specialist team execution only if the host also exposes agent or worker contexts.

The helper is disabled by default. Installation does not activate host hooks or change user
host configuration. The supported hook shapes come from the official host references below. One
read-only Codex 0.154.0 smoke test observed the injected context; Claude Code remains unverified.

## Enable selected events

Create a local JSON configuration yourself, outside the installed package. Use only these
three fields. Do not place credentials, artifact paths, transcripts, or commands in this file.

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "events": ["session-start", "prompt-submitted", "before-delivery", "results-updated"]
}
```

Choose only the events you want. Set `enabled` to `false`, set `events` to `[]`, or omit
`--config` to disable advice. An explicitly supplied missing or invalid config is an error.
There is no environment-variable switch, config discovery, or default config file.

Run these generic examples from the complete distribution or an install that includes the helper:

```sh
node /absolute/install/tools/proactive.mjs --event session-start --config /absolute/local/proactive.json
node /absolute/install/tools/proactive.mjs --event before-delivery --config /absolute/local/proactive.json
node /absolute/install/tools/proactive.mjs --event results-updated --config /absolute/local/proactive.json
```

Flag order is fixed. The only accepted forms are `--event EVENT` and
`--event EVENT --config PATH`. Event names are case-sensitive.

| Event | Advice |
| --- | --- |
| `session-start` | Identify the current outcome and offer one useful next step. |
| `prompt-submitted` | Select relevant installed methods and resources from the submitted prompt. |
| `before-delivery` | Review the deliverable and evidence gaps before returning it. |
| `results-updated` | Assess results already available in the authorized conversation and suggest one next step. |

A host adapter must map its event to one of these fixed names and pass an argument array to
Node. Do not interpolate host event data into shell commands. The generic CLI never reads stdin.
A host adapter imports `advisory` and passes the prompt through its explicit options object, or uses
one of the hook adapters below. A results event cannot supply metrics or artifact paths.

## Output contract

Successful invocations exit with code 0 and emit one JSON line to stdout. Disabled output is:

```json
{"schemaVersion":1,"event":"session-start","enabled":false,"instructions":[]}
```

Enabled static output has `enabled: true` and two instruction strings. Matched prompt output has one
`<conquistador-request-context>` string. It names contained package paths and short method excerpts,
then tells the parent to read the complete selected files and use relevant host tools and specialist
support. Prompt context is capped at 7,500 characters. Output contains no config path, config
content, submitted prompt, transcript path, or project artifact content.
Treat these strings as advisory context, never as shell code, approval, or an action request.

Invalid input exits with code 2, emits no stdout, and prints a fixed diagnostic to stderr.
The host must discard errors and disabled responses. It decides whether to present enabled
advice in the current authorized task. Advice must not override user or host instructions.

## Local limits

The config must be a regular UTF-8 JSON file of at most 4,096 bytes. The helper rejects a
symlink at the final path component, directories, and special files. Ancestor directories
remain operator-controlled. Reads remain bounded if the file grows during invocation.
The path argument is limited to 4,096 UTF-8 bytes. Unknown fields, unsupported schema versions,
invalid types, unknown events, and duplicate entries in `events` are errors.

Each invocation reads only the explicitly supplied configuration and installed Conquistador package,
if present. Request selection reads the generated routing contract and validates installed method paths. It honors `domain-restriction.json` and an operator profile set to `off`. It does not
scan project files, transcripts, user artifacts, or private knowledge roots. It performs no
filesystem writes, network or model calls, scheduling, daemon work, secret discovery, approval or
action submission, or external dispatch. It does not edit host config.
The operator must supply a dedicated config file, not a user artifact or secret file.

There is no persistence, deduplication, or rate limiter. Repeated events return the same advice.
The host must prevent recursive events and limit repeated presentation. The helper creates
no evidence of human review, live provider operation, or native host compatibility.

## Verify locally

From the complete distribution or source checkout with Node 24, run:

```sh
node --test tools/context-selection.test.mjs tools/proactive.test.mjs tools/conquistador-mode.test.mjs
```

Staged skill, plugin and agent installs contain the helper and guide, not this test file.

Tests use local synthetic configurations and child processes. They cover disabled defaults,
event selection, method distinctions, abstention, source and staged layouts, domain restrictions,
bounded reads and output, non-regular files, ignored CLI stdin, and unchanged fixture files. They
make no live calls.

## Optional Conquistador mode for Codex and Claude Code

`tools/conquistador-mode.mjs` maps `session-start`, `prompt-submitted`, and `before-delivery` to
`SessionStart`, `UserPromptSubmit`, and `Stop`. Codex stores the owned project hooks in
`.codex/hooks.json`; Claude Code stores them in `.claude/settings.local.json`. Installation leaves
mode disabled. The current [Codex hooks reference](https://developers.openai.com/codex/hooks) and
[Claude hooks reference](https://code.claude.com/docs/en/hooks#userpromptsubmit-decision-control)
document prompt input and context feedback. Codex must trust the project hook configuration and the
exact hook definition before it will run project-local hooks. Codex 0.154.0 delivered the selected
staged paths and excerpt in one read-only smoke test. Claude Code activation remains unverified.

`results-updated` remains a generic helper event. The hook adapters refuse to register it because
neither supported host documents a matching context-advice event. Enabling or removing mode also
removes the older Claude `TaskCompleted` registration when it belongs to this installation,
preserving unrelated hooks.

With a project operator installed, use the normal CLI. It binds hooks to that installed library
and its domain restriction. Compact or plugin users can instead run their owned
`node /absolute/install/tools/conquistador-mode.mjs` helper with the same arguments.

```sh
conquistador hooks enable --host claude-code --project /absolute/project --config /absolute/local/proactive.json
conquistador hooks status --host claude-code --project /absolute/project --config /absolute/local/proactive.json
conquistador hooks disable --host claude-code --project /absolute/project --config /absolute/local/proactive.json
conquistador hooks remove --host claude-code --project /absolute/project

conquistador hooks enable --host codex --project /absolute/project --config /absolute/local/proactive.json
conquistador hooks status --host codex --project /absolute/project --config /absolute/local/proactive.json
conquistador hooks disable --host codex --project /absolute/project --config /absolute/local/proactive.json
conquistador hooks remove --host codex --project /absolute/project
```

Use `--events prompt-submitted` to register only request-time selection. The default registers all
three supported events; the operator config must also enable an event before it emits advice.
Enabling this hook is the explicit opt-in to request-time routing even when the installed operator
profile is `manual`. An operator profile set to `off` still prevents selection.

The handler requires matching `hook_event_name` input, a bounded prompt for `UserPromptSubmit`, and
an explicit `stop_hook_active: false` for Stop advice. Recursive, missing, malformed, mismatched or
oversized input returns `{}`. Input reads are nonblocking and limited to less than 64 KiB; prompts
are limited to 32,000 UTF-8 bytes. Partial or unavailable input suppresses advice. Handler errors
emit a fixed diagnostic and exit 1 so they cannot block completion or expose
configuration text. It does not create specialists, edit unrelated host settings, or enable Grok Bot or Eve. Those remain
experimental imports without a mode adapter. `status` and `disable` use the config path stored in
the owned hooks. A different `--config` is an error. `status` without that registered file is
`unknown`; it does not report another file's enabled flag. Status reports enabled only when a
registered event is also enabled in that config. The current official references were read on
2026-09-18 through web access. The observed Codex smoke does not establish another installed host
version, Claude Code delivery, broad routing quality, or human acceptance.

## Diagnose and repair

`conquistador doctor` reports payload integrity, the routing/resource graph, hook registration,
routing availability, and unverified host/task observation separately. An enabled configuration
does not prove that the host trusts or invokes a hook. Historical smoke evidence is never copied
into a local activation claim.

The hook manager records exact owned commands beside host settings in a `.conquistador.json`
sidecar. After replacing Node or moving the CLI package, rerun `hooks enable` with the same project
and private config to rewrite those commands. Unrelated hooks stay intact. Legacy hooks without a
sidecar are recognized only at the exact script path. Remove them through their original helper
before deleting that installation. Project uninstall refuses remaining registered owned hooks and
prints the cleanup command.

Inspect a route without starting work:

```sh
conquistador route --prompt 'Write a LinkedIn product announcement.'
conquistador route --path /absolute/package --prompt 'Draft a launch plan and landing page copy.'
```

The result lists selected, deferred, excluded, and unavailable capabilities. Unsupported or ambiguous
phrasing returns control to the parent. It does not imply a failed task or authorize feedback.
