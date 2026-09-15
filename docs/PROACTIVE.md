# Opt-in proactive advice

`tools/proactive.mjs` is a host-neutral local helper for Node 24. An operator can connect
explicit host events to this helper. It returns static advice that routes the current task
through `/conquistador`. The parent skill selects the relevant available capabilities.
The helper does not load skills, inspect results, or perform the suggested work.

This is the optional hook input for Conquistador mode. It supplies an instruction to the parent. It
does not create specialist agents. After the host delivers the instruction, the parent may use
specialist team execution only if the host also exposes agent or worker contexts.

The helper is disabled by default. Installation does not activate host hooks or change user
host configuration. Native activation on any named platform remains unverified. Local tests
prove only the generic helper contract. A platform-specific activation claim requires official
evidence obtained through Executor and a separately verified integration.

## Enable selected events

Create a local JSON configuration yourself, outside the installed package. Use only these
three fields. Do not place credentials, artifact paths, transcripts, or commands in this file.

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "events": ["session-start", "before-delivery", "results-updated"]
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
| `before-delivery` | Review the deliverable and evidence gaps before returning it. |
| `results-updated` | Assess results already available in the authorized conversation and suggest one next step. |

A host adapter must map its event to one of these fixed names and pass an argument array to
Node. Do not interpolate host event data into shell commands. This helper accepts no event
payload and never reads stdin. A results event cannot supply metrics, artifact paths, or prompts.

## Output contract

Successful invocations exit with code 0 and emit one JSON line to stdout. Disabled output is:

```json
{"schemaVersion":1,"event":"session-start","enabled":false,"instructions":[]}
```

Enabled output has `enabled: true` and exactly two static instruction strings. The first
routes through `/conquistador`; the second preserves user scope and human authority.
Every supported response is less than 1 KiB. Output contains no config path or config content.
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

Each invocation reads only the explicitly supplied configuration, if present. It performs
no filesystem writes, network or model calls, scheduling, daemon work, artifact or secret
discovery, approval or action submission, or external dispatch. It does not edit host config.
The operator must supply a dedicated config file, not a user artifact or secret file.

There is no persistence, deduplication, or rate limiter. Repeated events return the same advice.
The host must prevent recursive events and limit repeated presentation. The helper creates
no evidence of human review, live provider operation, or native host compatibility.

## Verify locally

From the complete distribution or source checkout with Node 24, run:

```sh
node --test tools/proactive.test.mjs
```

Staged skill, plugin and agent installs contain the helper and guide, not this test file.

Tests use local synthetic configurations and child processes. They cover disabled defaults,
event selection, validation, bounded reads and output, non-regular files, ignored stdin,
and unchanged fixture files. They make no live calls.
