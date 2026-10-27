# Conquistador Eval Lab

The optional Eval Lab provides typed evaluation contracts, exact candidate/provider selection,
run aggregation, blind-review and authority checks. Use it locally with the included synthetic
fixtures. A fixture result is not model execution, output quality, or human release acceptance.
The local SDK cannot activate production or grant authority for an external action.

## Public setup

Use Node 24. From this directory:

```sh
npm ci --ignore-scripts
npm test
npm run example:local
```

The default test suite uses included files and local temporary processes. It excludes the private
inventory-preflight, readiness-authority, historical benchmark records, and historical live-runner tests. `test:contracts` remains a smaller focused
selection. Neither command needs a private ledger or a Promptfoo installation.

The local example reads `fixtures/example-candidate.json`, `example-case.json`, and
`example-provider.json`, validates them, and calls `selectExactCandidate`. Its output explicitly
identifies synthetic fixture data, zero live executions, and no execution authorization.
It does not contact a provider, generate work, or create a candidate approval.

## Use the contract SDK

Node 24 can import the TypeScript modules directly:

```ts
import { selectExactCandidate } from './src/build-selector.ts';
import { validateCandidateBuild, validateEvalCase, validateProviderCell } from './src/validate.ts';

// Supply your own explicit objects, or use the synthetic files in fixtures/.
validateCandidateBuild(build);
validateEvalCase(evalCase);
validateProviderCell(providerCell);
const selection = selectExactCandidate(build, evalCase, providerCell);
```

See [the runnable example](examples/local-contract.ts), [schemas](schemas/eval-lab.schema.json),
and tests for complete fields. The SDK validates declared bindings; valid object shapes do not
prove that an external action occurred. Run aggregation, calibration, and review helpers retain
separate evidence and human authority requirements. Never label fixtures as live observations.

## Run a blind judging session

A craft rebuild ships only when the judge prefers the method draft in a blind pairwise comparison
against a draft written without the method. These commands run that comparison. Drafts, keys, and
verdicts are private: keep them in a private Drive folder. The commands refuse any output path
inside a Git work tree.

**1. Build a pack.** One folder per case. Each case has the brief both arms received and one draft per arm:

```text
my-pack/
  pack.json        {"schemaVersion":"conquistador.judging-pack/v1","id":"wave1-copy","arms":{"baseline":"bare","candidate":"method"}}
  copy-hero/
    case.json      {"practice":"copy"}
    brief.md       the task and facts given to both arms
    bare.md        the draft written without the method
    method.md      the draft written with the method
```

The default pass rule needs at least 6 decided pairs per practice, so plan at least 6 cases per
practice. Case folder names must not contain an arm name. To strip an extra section heading from
every draft, add `"normalize": {"stripHeadings": ["Anchor"]}` to `pack.json`.

**1b. Generate the drafts (optional).** Instead of writing `bare.md` and `method.md` by hand, start
each `brief.md` with one `Task:` line (the request, as a user would type it), then run:

```sh
npm run judge:generate -- --pack "<pack folder>" --commit <sha>
```

| Option | Use |
| --- | --- |
| `--commit <sha>` | Required. The method arm reads the methods at this commit, not your working tree. |
| `--arms bare,method` | Generate only some arms. The default is both arms named in `pack.json`. |
| `--cases a,b` | Generate only some case folders. |
| `--runner "<cmd>"` | The command that drafts. It reads the prompt on stdin and writes the draft on stdout. |
| `--force` | Replace existing drafts. Without it, the command stops before it drafts anything. |
| `--trust-runner` | Accept a runner that is not `claude`. Use it only after you confirm the runner exposes no Conquistador plugin, skill, MCP server, or tool. |

What each arm receives:

- **bare**: one shared instruction ("write only the requested deliverable") and `brief.md`.
- **method**: the same instruction and `brief.md`, plus guidance from the pinned commit: the output
  of `conquistador brief "<Task line>" --full`, and the full text of every required reference that the
  brief lists as "not inlined (budget)". The command checks out the commit with
  `git worktree add --detach` into a temporary folder, runs the brief there with no user playbooks,
  home configuration, or project files, and removes the checkout before any drafting.

Neither arm sees the other arm's draft. Each runner call starts in a new empty folder with no
Conquistador environment variables. A draft that names Conquistador is refused and not written.
Arm labels that `judge:prepare` will remove are listed in the output for a human check.

The default runner is Claude Code in print mode with nothing loaded but the model:

```sh
claude -p --model claude-opus-5-5 --safe-mode --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --setting-sources "" --tools "" --disable-slash-commands --no-session-persistence
```

`--safe-mode` turns off CLAUDE.md, skills, installed plugins, hooks, and MCP servers.
`--strict-mcp-config` with an empty `--mcp-config` adds no MCP server. `--setting-sources ""` reads
no settings file. `--tools ""` removes every built-in tool. `--disable-slash-commands` removes skills
and commands. Before it drafts, the command refuses a `claude` runner without these flags, then runs
the runner once with `--output-format stream-json --verbose` and refuses it if its startup report lists
any tool, MCP server, skill, command, or added plugin. This check makes one short model call.
Checked with Claude Code 2.1.311 on 2026-10-27: with these flags the startup report lists no tools,
MCP servers, skills, or commands, and only built-in plugins; without them it listed the Conquistador
plugin and its MCP tools.

The command writes `<pack>/.generation/<case>/generation.json` for each case, outside the case
folder. It records the resolved commit, runner, model, isolation check, instruction and prompt
digests, draft digest, and for the method arm the Task line, the brief's `File:` lines, and the
appended references. It stays in the private pack; `judge:prepare` ignores dot folders.

**2. Prepare.** From `evals/`:

```sh
npm run judge:prepare -- --pack "<pack folder>" --out "<private session folder>" --reviewer hung
```

This removes identity leaks from each draft (front matter, metadata headers and fences, arm labels,
"written after reading" notes, rationale and self-score sections, readiness labels, word counts, and
file names), then gives each pair a random A/B order. It stops if an arm name or product name is still
visible; fix the draft or add a heading to strip, or pass `--allow-residual` after you check it.
The `sealed/` folder holds the order key and an audit of every removal. Do not open it before you
finish judging. Someone else can audit it first.

**3. Judge.** About 2 minutes per pair:

```sh
npm run judge:serve -- --session "<private session folder>" --open
```

Read the brief, then both drafts. Press <kbd>A</kbd>, <kbd>B</kbd>, or <kbd>T</kbd> (tie) to choose
and move on. To add a reason, press <kbd>R</kbd>, type one line, press <kbd>Enter</kbd>, then choose.
On every third pair, a choice opens a focused reason field instead: type one line and press
<kbd>Enter</kbd>, or press <kbd>Enter</kbd> with no text to skip. Both record the choice.
<kbd>Esc</kbd> closes the field without recording.
<kbd>←</kbd> and <kbd>→</kbd> move between pairs; choosing again replaces your earlier verdict.
Each choice is saved at once to `verdicts.json` in the session folder (or `--verdicts <file>`), so a
reload or a closed browser resumes where you stopped. Press Ctrl+C in the terminal when you finish.
You can also open `judge.html` directly from disk; then verdicts stay in that browser until you click
**Export**, and you pass the exported file to the report with `--verdicts`.

**4. Report.**

```sh
npm run judge:report -- --pack "<pack folder>" --session "<private session folder>"
```

For each practice it shows method wins, bare wins, ties, and PASS, FAIL, or INCOMPLETE. Ties are not
wins and do not count as decided. A practice with an unjudged pair is INCOMPLETE, never PASS. Change
the rule with `--min-decided 6 --min-win-rate 2/3`. `--json <file>` writes the full report.

`--sequential` uses a two-stage rule instead, so a clear result needs only 6 pairs:

| Decided pairs | PASS | FAIL | Otherwise |
| --- | --- | --- | --- |
| 6 | 6–0 or 5–1 | 2–4 or worse | EXTEND: add 4 pairs |
| 10 | 8 or more method wins | 7 or fewer | — |

Below 6 decided pairs (for example, after ties), the result is EXTEND with the number of pairs to
add. Between 7 and 9, the result is PASS when 8 wins are already reached, FAIL when 8 is out of
reach, and EXTEND otherwise. Above 10, PASS needs at least 4 of 5 decided pairs. The rule reads
counts, not judging order. For each practice the report prints the result and the next step. To
extend, add new held-out cases to the pack, generate them, prepare a new session, and judge it: the
report does not combine sessions. `--sequential` cannot be combined with `--min-decided` or
`--min-win-rate`.

`practices.json` maps every command, play, channel, format, and specialist to one practice, with
its judge (`human` for taste work, `pending-calibration` for decision work) and its latest status
(`untested`, `baseline`, `passed`, `failed`, or `pass-through`). Record a result there after a
report. `npm test` fails when a method file has no practice or a member names a missing file. The
report re-derives every pair from the pack and the sealed key, so it stops if a draft, brief, key, or
verdict changed after prepare, or if a pair has two verdicts.

`fixtures/blind-judging/sample-pack/` is a synthetic pack for tests only. `npm run judge:e2e` drives
the page in Chromium through the Playwright install at the repository root and writes its checks and
screenshots to `dist/e2e/blind-judging/`.

## Historical maintainer pipelines

`test:source`, `inventory:*`, and candidate-bound `promptfoo:*` execution/export commands belong
to the historical private evidence workflow. They require that workflow's exact committed
candidate, ledger, integrity records, and human/credential authority. The clean public repository
does not supply those private records or the serialized historical fixture/support-disposition bundle. These commands are not public setup prerequisites and
must fail closed when authority is absent. Do not fabricate a ledger or copy private receipts here.

Promptfoo remains an optional isolated dependency graph under `promptfoo-isolated/`, outside the
default module installation. Its pinned packages and safety verifiers do not authorize execution.
Do not install or run that graph just to use the public SDK. A genuine live host integration must
supply its own scoped Executor connection and explicit authority; local tests never grant either.

The reviewed isolated pin is Promptfoo 0.124.1 with sharp 0.35.5 and basic-ftp
6.2.3 overrides. The 2026-10-19 full audit reports zero critical and three high
findings, all in the optional node-forge/jks-js Java keystore chain
([GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)). No patched
node-forge release is available. `npm audit --omit=optional` reports zero findings;
this does not clear the full graph or authorize untrusted keystore input.
The adapter record owns this risk disposition. `promptfoo:integrity:verify` checks
the complete installed tree; `promptfoo:overrides:verify` exercises the image and
FTP dependencies and CLI help in a credential-free child process. These are
runtime compatibility checks. Live model execution still defaults to deny.
