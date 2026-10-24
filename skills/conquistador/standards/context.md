# Project context standard

Every command starts from the project's durable context.

## The files

| File | Holds | Written by |
|---|---|---|
| `PRODUCT.md` | Product truth: users, purpose, positioning, constraints, evidence on hand | `/conquistador init`, or Impeccable's `init` (same headings) |
| `GROWTH.md` | Growth truth: goals and metrics, audience, channels, proof, voice, limits, stack | `/conquistador init` |

The files live at the project root. A child app can hold its own file; the file nearest to the
working folder wins. The brief lists both files first; otherwise run `conquistador context --json`.

## Read

1. Read `GROWTH.md` and `PRODUCT.md` in full before you plan or write. Use their facts; do not ask
   the user for a fact that a file records.
2. Treat an `Open:` entry as unknown. Ask about it only when the task depends on it.
3. When neither file exists, work from the request and the repository, then suggest
   `/conquistador init` in one line.

## Precedence

When sources disagree, follow the user's message in this session, then `GROWTH.md`, then
`PRODUCT.md`, then repository evidence. Say when you follow a higher source over a file ("You asked
for formal; GROWTH.md says casual. I used formal."). A conflict can mean a file is stale.

## Propose updates

When a task teaches a durable fact (a sourced result, a new segment, a failed channel, an approved
voice sample, a new limit), list each proposed change at the end: file, section, exact line, and
source. Write only the lines the user approves, and keep every other line as it is.

Never write to `PRODUCT.md` or `GROWTH.md` silently or as a side effect of another task. Never
rewrite content another tool wrote; add to it. Never record an invented metric, quote, customer,
or result. Keep task outputs (drafts, plans) in their own files.
