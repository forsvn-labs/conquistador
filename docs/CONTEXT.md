# Project context

Conquistador keeps what is true about your product and your growth in two files at the root of
your project. Every command reads them, so you explain the product once.

| File | Holds |
|---|---|
| `PRODUCT.md` | Users, product purpose, positioning, operating context, capabilities and constraints, brand commitments, evidence on hand, product principles |
| `GROWTH.md` | Goals and metrics, audience and segments, channels (what worked, what did not), proof and assets, voice samples, limits, connected stack |

Both files are Markdown. Commit them to Git. Edit them by hand when a fact changes.

## Create the files

In your coding agent, run:

```text
/conquistador init
```

The agent reads your repository first: docs, landing and pricing pages, package manifests,
changelog, and existing context files. Then it asks at most three questions per round about the
gaps it cannot answer. It records an undecided fact as `Open:` and never invents one.

Run `/conquistador init` again when your goals, channels, or limits change.

## Use with Impeccable

`PRODUCT.md` uses the same headings as Impeccable's `PRODUCT.md`, so both tools share one file.
When Impeccable wrote the file, Conquistador adds missing facts under the existing headings and
does not change the rest. Conquistador keeps growth facts in `GROWTH.md`.

## How commands use the files

- The brief lists `PRODUCT.md` and `GROWTH.md` before the playbooks.
- When sources disagree, the order is: your message, then `GROWTH.md`, then `PRODUCT.md`, then
  repository evidence.
- After a task, the agent can propose an update, such as a new result or an approved voice
  sample. It writes only the lines you approve.

The agent rules are in [skills/conquistador/standards/context.md](../skills/conquistador/standards/context.md).

## Commands

| Command | Does |
|---|---|
| `conquistador context` | Shows the context files for the current folder. Add `--json` for agents. |
| `conquistador context --gitignore` | Adds the Conquistador block to `.gitignore`. Running it again changes nothing. |
| `conquistador signals` | Shows what the menu reads: context files, platform, stack, marketing surfaces, launch hints, changed marketing files, and Executor status. Add `--json` for agents. |
| `conquistador pin <command>` | Makes a shortcut, such as `/outreach`, in each installed agent. |
| `conquistador unpin <name>` | Removes a shortcut that `pin` made. |

## Files Conquistador ignores

`/conquistador init` adds this block to `.gitignore`:

```gitignore
# conquistador:start
# Ephemeral Conquistador files. PRODUCT.md, GROWTH.md, and .conquistador/config.json stay in Git.
.conquistador/runs/
.conquistador/cache/
.conquistador/logs/
.conquistador/tmp/
.conquistador/*.local.json
# conquistador:end
```

Lines outside the markers stay as you wrote them.

## Executor status in signals

`conquistador signals` never starts Executor. It reports Executor as running only when an
Executor server already answers. When no server answers, it reports `not running`: open
Executor.app or run `executor web`, then run `conquistador connect`.
