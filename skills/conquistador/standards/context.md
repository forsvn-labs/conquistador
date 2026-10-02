# Project context standard

Every command starts from the project's durable context. Follow this standard in every command.

## The files

| File | Holds | Written by |
|---|---|---|
| `PRODUCT.md` | Product truth: users, purpose, positioning, constraints, evidence on hand | `/conquistador init`, or Impeccable's `init` (same headings) |
| `GROWTH.md` | Growth truth: goals and metrics, audience, channels, proof, voice, limits, stack | `/conquistador init` |

The files live at the project root. A child app can hold its own file; the file nearest to the
working folder wins. The brief lists both files first. When the brief is not available, run
`conquistador context --json` to find them.

## Read

1. Read `GROWTH.md` and `PRODUCT.md` in full before you plan or write.
2. Use their facts. Do not ask the user for a fact that a file records.
3. Treat an `Open:` entry as unknown. Ask about it only when the task depends on it.
4. When neither file exists, do the task from the request and the repository. At the end, suggest
   `/conquistador init` in one line.

## Precedence

When sources disagree, use this order:

1. The user's message in this session.
2. `GROWTH.md`.
3. `PRODUCT.md`.
4. Repository evidence: pages, docs, manifests, changelog.

Say when you follow a higher source over a file ("You asked for a formal tone; GROWTH.md says
casual. I used formal for this email."). A conflict is a signal that a file can be stale.

## Propose updates

A task can teach a durable fact: a result with its source, a new segment, a channel that failed,
an approved voice sample, a new limit. At the end of the task:

1. List each proposed change: the file, the section, the exact line, and its source.
2. Ask the user to approve each one.
3. Write only the approved lines. Keep every other line as it is.

Never write to `PRODUCT.md` or `GROWTH.md` silently or as a side effect of another task. Never
rewrite content another tool wrote; add to it. Never record an invented metric, quote, customer,
or result. Record a task output (a draft, a plan) in its own file, not in the context files.
