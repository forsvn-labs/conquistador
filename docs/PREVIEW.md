# Review and preview

`conquistador review` opens a deliverable for human review on your machine. Markdown opens in
[Proof](https://github.com/forsvn-labs/proof), the FORSVN fork of Proof SDK. HTML opens in
[Lavish](https://github.com/kunchenguid/lavish-axi). Both are MIT licensed and listen only on
`127.0.0.1`.

## Commands

```sh
conquistador review <file.md|file.html> [--no-open]   # open; prints the review URL
conquistador review poll <file> [--json] [--wait <seconds>]
conquistador review sync <file> [--force]             # send the revised source
conquistador review end <file>
conquistador review kit [<template> <destination.html>]
```

In an agent, ask `/conquistador review` and name the deliverable.

## Markdown in Proof

The first review installs Proof from a pinned Git commit into `~/.conquistador/proof/`. It needs
Git, npm, and Node 22.20+, 24.12+, or 26+. The install runs `npm ci` and builds the editor once.

The review page has a **Review** panel:

- **Preview** shows the text as an X post, LinkedIn post, email, search result, or ad card. Set
  `channel:` in the front matter. Counters show the channel limits.
- **Playbooks applied** lists the items of the document's final `## Playbooks applied` section.
- **Approval** records your name, the time, and the SHA-256 of the exact text. Any edit clears it.

`conquistador check` findings arrive as comments. `review poll` returns new comments, replies,
suggestions, and the approval state. Per-project state, the Proof database, and document tokens
stay in `.conquistador/review/`.

## HTML in Lavish

Review runs `lavish-axi@0.1.80` through `bunx`, or `npm exec` when Bun is absent. It sets
`LAVISH_AXI_TELEMETRY=0` and gives each session its own state directory and free port. Nothing is
installed globally. `review poll` is Lavish's long poll; keep it running in the foreground.

The [artifact kit](../kit/README.md) has templates for an ad set, social posts, an email, a landing
section, a funnel (Mermaid), and a campaign calendar.

## Rules

- An annotation or comment is a revision request.
- An approval stamp is your decision for one exact text. The agent still asks before each send,
  publish, or spend.
- Review never uses hosted sharing. For a remote agent host, use `--no-open` and an authorized
  private tunnel to the printed URL.

Saving a lesson from review feedback needs separate approval. See [LEARNING.md](LEARNING.md).
