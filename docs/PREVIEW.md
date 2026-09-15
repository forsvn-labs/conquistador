# Preview with Lavish AXI

Conquistador uses [Lavish AXI](https://github.com/kunchenguid/lavish-axi) for local HTML previews and
annotations. The coding-agent host runs its CLI. Conquistador does not ship a custom preview UI,
embed Lavish, or require it for text-only work. The optional HTTP/MCP runtime has no automatic
Lavish launcher or feedback consumer.

## Agent-managed setup

Ask Conquistador for the preview. The agent checks the tool and prepares it when needed; the user
does not need to install Lavish globally. An available compatible installation can be reused.
Set `LAVISH_AXI_TELEMETRY=0` before every command, including version/help. Lavish enables command
telemetry by default; Conquistador's invocation disables it.

With Bun and Node 24 available, the agent runs:

```sh
LAVISH_AXI_TELEMETRY=0 bunx lavish-axi@0.1.50 --version
LAVISH_AXI_TELEMETRY=0 bunx lavish-axi@0.1.50 --help
```

If Bun is absent, use npm with Node 24:

```sh
LAVISH_AXI_TELEMETRY=0 npm exec --yes --ignore-scripts --package=lavish-axi@0.1.50 -- lavish-axi --version
```

Both package managers fetch a missing package into their execution cache. No global installation
or project dependency change is needed. Version 0.1.50 is the checked integration version, not a
claim about the latest release. Keep the Node runtime selected by the CLI's shebang; do not add
`--bun`. Verify version/help and keep using the chosen launcher for open, poll, end and stop.
An isolated tool working directory avoids an unrelated project executable taking precedence.

A package download needs registry access; the local preview needs no provider credential. Use the
host's existing permissions for ordinary setup. If the host blocks downloads or lacks a usable
runtime/package manager, diagnose the missing prerequisite and use its supported setup path. Ask
only for a step that the host cannot perform or that needs new authority. Return the source artifact
if preview remains unavailable. Do not install unrelated tools or register global hooks.

For a new session, the agent chooses a separate `LAVISH_AXI_STATE_DIR` and an available
`LAVISH_AXI_PORT` to avoid reusing or stopping another session's server. Keep these values on
subsequent commands, and keep the cached package available while its server is running.
Starting a server for a requested preview does not enable an always-running Conquistador service.
See [Bun package execution](https://bun.sh/docs/pm/bunx) and
[npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec/) for cache and command behavior.

## Review an artifact

Ask `/conquistador Preview this deliverable in Lavish and apply my annotations.` The agent checks
the CLI and prepares an HTML preview of the deliverable. Keep the source document canonical and
place only intended preview assets beside the HTML, outside the installed product directory.

Using the Bun launcher, the agent runs:

```sh
LAVISH_AXI_TELEMETRY=0 bunx lavish-axi@0.1.50 /absolute/path/to/preview.html
LAVISH_AXI_TELEMETRY=0 bunx lavish-axi@0.1.50 poll /absolute/path/to/preview.html
```

Annotations return through the active poll. The agent revises the source and preview, then waits
for further review. A session-start discovery hook does not replace this poll. A host must keep
the poll attached or provide a verified completion callback before claiming unattended monitoring.
An agent can close its session by passing `end /absolute/path/to/preview.html` to the same launcher. Do not reopen
a session that the user ended unless they request further review.

Lavish starts a local server. Its localhost URL works on the machine running the CLI. For a remote
coding-agent host, add `--no-open` and use that host's authorized private port access after checking
the files exposed.
Do not substitute Lavish's hosted `share` command: sharing sends content to a separate service and
requires its own approval. If no private access path is available, review the source in chat.

## Feedback and memory

The [learning guide](LEARNING.md) separates private project memory from product feedback.
Preview annotations request changes to the current work. They do not approve durable memory or
external actions. Conquistador may propose a learning with its evidence; saving it requires the
user's approval. Users may separately select a correction or observed result for `submit-feedback`.
That skill prepares a redacted preview and obtains consent for the exact public issue. Neither
Lavish nor the proactive helper automatically feeds annotations into product learning or telemetry.

Local command checks do not establish human acceptance, agent wake-up after a disconnect, or
native integration with every coding-agent host. Test those behaviors in the actual host before
relying on them.
