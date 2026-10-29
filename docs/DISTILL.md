# Distill outside knowledge into Conquistador

This workflow turns a permissively licensed source, such as a public skill library, into
improvements to Conquistador. It keeps three rules:

1. **Own words.** Public text shares no run of 8 or more words with a source, except stock phrases.
2. **No source names.** Public methods and docs name no source, author, or course. Provenance
   stays in the private knowledge folder.
3. **Thin by default.** A distilled rule enters a default method only after a human blind test
   prefers it. Routing, dated platform facts, and deterministic checks do not need a blind test.

`tools/distill.mjs` runs the mechanical steps. It reads sources and never runs their code. It
refuses any output folder inside a Git work tree, because sources, notes, and reports are private.

## 1. Register the sources

Write a private registry (`conquistador.distill-registry/v1`) outside any repository:

```json
{
  "schemaVersion": "conquistador.distill-registry/v1",
  "sources": [
    {
      "id": "lib",
      "url": "https://github.com/<owner>/<repository>",
      "commit": "<full 40-character commit>",
      "license": "MIT",
      "units": ["skills/*/SKILL.md"],
      "names": ["<author name>", "<repository name>", "<brand names>"]
    }
  ]
}
```

| Field | Rule |
|---|---|
| `license` | `MIT` or `Apache-2.0`. Fetch refuses other licenses and a LICENSE file that does not match. |
| `commit` | The exact commit to read. Fetch refuses a commit that does not exist. |
| `units` | Paths to the knowledge units. Each `*` matches one folder level and names the unit. |
| `names` | Names that must not appear in public text. The owner handle in `url` is added automatically. A repository name is often a plain word, so declare it here only when it is distinctive. |

## 2. Fetch and inventory

```sh
node tools/distill.mjs fetch     --registry <registry.json> --out <private folder>
node tools/distill.mjs inventory --registry <registry.json> --out <private folder>
```

`fetch` clones each source into a new empty folder, checks out the pinned commit, verifies the
license, and writes `sources.lock.json` with the license digest. An Apache-2.0 source that has a
NOTICE file is reported, because copied text would have to keep that notice.

`inventory` reads each unit's description, sends it through Conquistador's router, and writes
`inventory.json` and `inventory.md`: the route, the practice, and the practice status from
[`evals/practices.json`](../evals/practices.json). Unrouted units are listed as gaps. Unit
descriptions are often keyword lists, so treat this route as a first signal only.

## 3. Write private notes

Distill each unit into a private note in our own words. Parallel workers can each take one cluster
of units. Each note uses this outline:

```text
# <unit> — <one-line job>
Source: <repository>@<short commit> <paths read>
Maps to Conquistador: <commands/x, plays/y> · practice status: <status>
Coverage verdict: covered | partly covered (<what is missing>) | gap
## Requests that should route here
- 5 to 10 realistic requests in plain words
## Decision procedure (own words)
## Non-obvious rules worth a blind test
## Dated facts (verify before use)
## AI tells / humanized-writing patterns
## Playbook placement
## Weak or risky parts of the source
```

## 4. Check the routes

```sh
node tools/distill.mjs routes --notes <notes folder>
```

This sends every listed request through the router and compares the result with the note's
`Maps to Conquistador` line. A mismatch is a routing candidate. Fix routes in the routing contract
and add the request to the routing corpus, so `node tools/e2e/routing-breadth.mjs` keeps it fixed.
A note with no target lists a coverage gap, not a mismatch.

## 5. Make the public change

Choose the change by what it needs before it ships:

| Change | Gate |
|---|---|
| Routing fix | Routing corpus passes |
| Dated platform fact in a command entry | Confirmed in the current official specification, with the check date |
| New deterministic writing-check rule | Tests for true and false positives, and the catalog in `docs-site/check.mdx` |
| Craft rule in a method | Human blind test, as described in [`evals/README.md`](../evals/README.md) |
| Reference for people, such as [the growth playbook](GROWTH-PLAYBOOK.md) | Own-words check |

## 6. Check own words

```sh
node tools/distill.mjs check --registry <registry.json> --out <private folder> <changed public files>
```

The check compares prose files only (`.md`, `.mdx`, `.markdown`, `.txt`) and reports each shared
run of 8 or more words and each source name, with its file and line. Pass `--allow <file>` with
one stock phrase per line to accept a known common phrase. Pass `--diff <git ref>` to check only
the lines added since that ref, so older text in a changed file does not add noise. An untracked
file is checked whole. Any finding exits with code 1. Run it
on every changed public file before you commit.

## 7. Record provenance privately

For each public change, record which private note informed it and the result of the own-words
check in the private provenance folder. Do not record source names in the repository.

## Tests

`node --test tools/distill.test.mjs` covers the failure modes listed at the top of that file:
private-path refusal, license and commit checks, empty checkout folders, inventory gaps, route
mismatches, shared runs, source names, allowed phrases, and a missing corpus.
