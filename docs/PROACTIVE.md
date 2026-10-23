# Configure advisory guidance

Conquistador uses one prompt-advice helper for native plugins and project hooks. It selects
only requested marketing, growth, sales, or product work. A topic mention is insufficient.
Automatic advice never blocks completion or requires a playbook appendix.

## Activation and event ownership

The installed `operator-profile.json` controls admission:

- `manual` requires an explicit invocation such as `/conquistador outreach`. This is the default.
- `project` allows relevant automatic suggestions.
- `off` disables selection, including explicit requests.

The profile sits beside the installed parent method. Do not edit a managed package to enable
advice: its integrity checks detect changed bytes. An explicitly enabled project prompt event
opts a manual profile into request-time advice. An off profile still prevents all selection.

Native plugin manifests register hooks. The global `conquistador hooks on|off|status` switch
controls native and project advice. `CONQUISTADOR_HOOKS=off` takes precedence.
Enabling a project prompt event opts into automatic advice for a manual profile. It never overrides off.

Project hooks also require an explicit local configuration:

```json
{"schemaVersion":1,"enabled":true,"events":["prompt-submitted"]}
```

Create this file outside the package. Do not store credentials or transcripts in it.
The helper does not discover a config file or enable itself. Missing, malformed, oversized,
or linked config files are errors. Reads are bounded at 4,096 bytes.

Use one registration path for a host. Project status reports observed prompt sources,
`duplicatePromptSources`, `activationMode`, `effectiveAutomaticAdvice`, and an exact disable
command. Host-managed plugin registrations outside project settings are not inspected.
The shared runtime suppresses duplicate events when transcript evidence identifies the same
boundary. Without that evidence, duplicate delivery cannot be inferred safely.

## Register project events

Use an installed project operator and an absolute local config path:

```sh
conquistador hooks enable --host codex --project /absolute/project --config /absolute/proactive.json --events prompt-submitted
conquistador hooks status --host codex --project /absolute/project --config /absolute/proactive.json
conquistador hooks disable --host codex --project /absolute/project --config /absolute/proactive.json
conquistador hooks remove --host codex --project /absolute/project
```

Use `--host claude-code` for Claude Code. The helper maps prompt submissions to
`UserPromptSubmit`. Legacy `session-start` and `before-delivery` registrations remain removable,
but those events are silent. `results-updated` is silent and has no host registration.
Start or stop events without a relevant request cannot initiate a workflow.

Owned commands are recorded in a `.conquistador.json` sidecar beside host settings.
Re-enable through the same installation after moving Node or the package. Unrelated host
settings stay intact. Project uninstall requires owned hook cleanup first.

## Advice and resource reuse

Prompt advice is at most 1,500 characters. It is a suggestion to use current-stage guidance,
not an instruction to read every file. The briefing API returns `none`, `assist`, `command`,
or `workflow` scope. Assistance is bounded at 4,000 bytes; commands and workflows at 16,000
bytes for the tool result. Compact command results use 8,000 bytes. Deferred files are optional.
Caller context that cannot fit remains with the caller and is labeled `retained-by-caller`.

Native and project adapters share session state, scoped by project. Exact repeated events can
be suppressed. Full-file reuse requires current resource digests and successful paired reads
in a transcript whose earlier boundary remains intact. Rotation, missing evidence, or changed
resources prevents reuse. A stored marker alone never proves that a model still has guidance.
State expires after twelve hours. No network, model, provider, schedule, or external action runs.

The edit hook requires an explicit channel or an active marketing task and an eligible file.
Manual `conquistador check` remains available independently of automatic advice.

## Verify behavior

```sh
node --test tools/behavior-contract.test.mjs tools/proactive.test.mjs tools/conquistador-mode.test.mjs
node docs/behavior-review-2026-10.mjs --strict
```

The [behavior review](https://github.com/forsvn-labs/conquistador/pull/86) records the baseline and implementation evidence.
Tests establish local routing and hook behavior. They do not establish host trust, native
activation, model attention, or human acceptance. Run `conquistador doctor` to inspect installed
files and registration, and use the host's own hook controls to verify delivery.
