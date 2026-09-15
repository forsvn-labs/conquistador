# Preview with Lavish AXI

Conquistador uses [Lavish AXI](https://github.com/kunchenguid/lavish-axi) for local HTML previews and
annotations. The coding-agent host runs its CLI. Conquistador does not ship a custom preview UI,
embed Lavish, or require it for text-only work. The optional HTTP/MCP runtime has no automatic
Lavish launcher or feedback consumer.

## Set up

Use Node 24 for Conquistador. Install Lavish separately if it is absent:

```sh
bun add --global lavish-axi@0.1.50
lavish-axi --version
lavish-axi --help
```

Version 0.1.50 is the checked integration version. This pin is not a claim that it is the newest
release. The package manager's global binary directory must be on the agent process's PATH.
No provider credential is needed for the local preview loop. The Conquistador installer does not
install Lavish, register global hooks or start its server. The parent operating contract discovers
and uses the CLI on demand, so users can keep asking `/conquistador` for previews.

## Review an artifact

Ask `/conquistador Preview this deliverable in Lavish and apply my annotations.` The agent checks
the CLI and prepares an HTML preview of the deliverable. Keep the source document canonical and
place only intended preview assets beside the HTML, outside the installed product directory.

The agent then runs:

```sh
lavish-axi /absolute/path/to/preview.html
lavish-axi poll /absolute/path/to/preview.html
```

Annotations return through the active poll. The agent revises the source and preview, then waits
for further review. A session-start discovery hook does not replace this poll. A host must keep
the poll attached or provide a verified completion callback before claiming unattended monitoring.
An agent can close its session with `lavish-axi end /absolute/path/to/preview.html`. Do not reopen
a session that the user ended unless they request further review.

Lavish starts a local server. Its localhost URL works on the machine running the CLI. For a remote
coding-agent host, use that host's authorized private port access after checking the files exposed.
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
