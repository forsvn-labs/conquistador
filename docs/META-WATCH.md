# Keep the methods current

Growth practice changes faster than a method library does. This workflow keeps Conquistador
current with what works now, and it keeps old advice from staying in the library unnoticed.
It has three rules:

1. **Recent proof, not reputation.** Learn from operators whose results you can verify in the last
   6 to 12 months. Study what they ship, not what they say about it.
2. **Every perishable block has a date.** A fact or play without a review date cannot enter a method.
3. **The gates do not change.** Own words, no source names, and a human blind test for craft, as in
   [the distillation workflow](DISTILL.md).

## Three layers

| Layer | Changes in | Lives in | Marker | Gate to change |
|---|---|---|---|---|
| Principles | Years | [The growth doctrine](../skills/conquistador/references/growth-doctrine.md) | None | Human blind test |
| Plays | Months | A dated block in a channel, play, or command reference | `(observed Nov 2026; review by Feb 2027)` | Seen in the work of two or more operators, then a human blind test before it enters a default method |
| Platform facts | Weeks | A dated block in a channel or command entry | `(checked Oct 2026; confirm in the current specs before use)` | The current official specification, with the check date |

A play is a tactic that works on one channel now: a post format, a hook pattern, a launch
sequence. It is expected to stop working. A principle that needs a date is a play.

## 1. Keep a private watchlist

Keep the watchlist outside every repository, in the private knowledge folder. Each entry needs:

- The operator or company, and the channel to watch.
- The proof and its date: revenue verified by a payment provider, an acquisition or funding
  report from a primary source, or audience growth that the platform shows.
- The kind of proof. Self-reported revenue is weak proof; record it as such.

Remove an entry when its proof is older than 12 months. Age, fame, and follower count are not proof.

## 2. Observe

For each entry, collect the recent posts on the channel with their public counts. Rank the posts
inside one account only, never across accounts. Record what the top quarter shares and the bottom
half lacks, with counts. Mark each finding as seen (the data shows it) or inferred (a reason you
propose). Use public pages only. Create no accounts and contact no one.

Vendor reports and "what works now" articles are leads, not evidence. Confirm each lead in the posts.

## 3. Write candidates

Write each finding as a private candidate note in your own words:

```text
# <play in one line>
Layer: play | platform fact | principle
Funnel stage: <stage> · Awareness stage: <stage> · Metric: <what it moves>
Seen: <counts, accounts, dates> · Inferred: <why it may work>
Contradicts: <the doctrine or method rule it disagrees with, or none>
Review by: <month year>
```

A candidate seen in one account is a note. A candidate seen in two or more accounts can move to step 4.

## 4. Make the public change

| Change | Gate |
|---|---|
| Platform fact | Confirmed in the current official specification; set `(checked <month year>; ...)` |
| Play in a reference that loads on request | Seen in two or more accounts; set `(observed <month year>; review by <month year>)` |
| Play or craft rule in a default method | Human blind test, as described in [`evals/README.md`](../evals/README.md) |
| Change to the doctrine | Human blind test against the current rule, and the owner's decision |

Run the own-words check from [the distillation workflow](DISTILL.md) on every changed public
file. Public text names no operator, company, or source. Provenance stays in the private folder.

## 5. Check freshness

```sh
node tools/freshness.mjs
```

The command reads every dated block in `skills/conquistador`. It exits with code 1 when a block is
past its review date or its marker is not valid:

| Marker | Due |
|---|---|
| `(checked <date>; ...)` or `(verified <date>)` | 90 days after the date; change it with `--max-age-days` |
| `(observed <date>; review by <date>; ...)` | The last day of the review month |

A date is a month (`Oct 2026`, `October 2026`, `2026-10`) or a day (`2026-10-27`). A month counts
as its last day. `--now YYYY-MM-DD` runs the check for another day, and `--json` prints the report
as data. The `Freshness check` workflow runs the command each Monday and fails when a block is due.

When a block is due, do one of these:

- Confirm it in a current source, correct it if necessary, and set the new date.
- Remove it when it is no longer true or no longer seen.

Do not change a date without the check. A new date is a claim that someone looked.

## Tests

`node --test tools/freshness.test.mjs` covers the failure modes listed at the top of that file:
date formats, prose that is not a marker, unknown months, plays without a review date, dates in
the future, the warning window, an empty tree, exit codes, and the library itself.
