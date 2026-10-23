# Agent surface performance review

Scope: source skills, staged skills/plugins, CLI and prompt hooks, app API, stdio MCP,
HTTP MCP, and hosted Worker. Measurements are local; no release or deployment is implied.

## Failure modes to verify before implementation

- A packaged search index changes ranking, scores, guidance, or output bytes.
- A missing, corrupt, or obsolete index prevents operation instead of rebuilding.
- Edited, added, removed, or renamed source resources use stale indexed text.
- A source snapshot leaks absolute checkout paths or private playbooks.
- A staged plugin has different document names or a restricted method subset.
- The snapshot omits Unicode terms, title weights, or duplicate terms.
- Repeated requests retain unbounded per-request state.
- An optimization bypasses bounded reads, symlink checks, request limits, or isolation.
- A skill entry sends an agent to a nonexistent procedure or unnecessary full-library read.
- Packaging or hosted upload omits a runtime dependency.

## Baseline

`node tools/e2e/performance.mjs --out docs/performance/baseline.json`
records six API workloads and six fragmented stdio workloads. Each API workload includes
cold processes and 60 warm samples. Output hashes must match after implementation.
First brief/search: approximately 263–269 ms. Warm calls: 0.36–2.80 ms median.

## Surface findings and changes

- **Search and briefs:** 1,084 bundled resources were tokenized again on each fresh
  process without a disk cache. The shipped search snapshot reuses these derived terms
  after checking each current file's digest. Added, changed, removed, renamed, and
  subset resources still come from the current library. Missing or invalid snapshots
  fall back to normal indexing. User playbooks are never included in the shipped data.
- **Repeated retrieval:** BM25 query terms, name-match eligibility, and inverse document
  frequencies are now computed once per query, rather than once per candidate document.
  Ranking arithmetic, rounding, ordering, and tie-breaking remain unchanged.
- **Skills and plugins:** the generated capability catalog now links to `ENTRY.md`.
  Across 41 commands these entries total 23,882 bytes versus 252,877 bytes for full
  procedures (90.6% less first-read content). This is a file-size comparison, not a
  measured reduction in model tokens. The installed parent now correctly names
  `COMMAND.md` for procedure expansion; `METHOD.md` belongs to the parent contract.
- **CLI and prompt hooks:** both use the shared briefing engine. Admission still precedes
  retrieval, unrelated engineering remains silent, and verified transcript reuse remains
  task-scoped. No provider client, autonomous workflow, or extra hook is introduced.
- **API, stdio, and HTTP MCP:** retain the same tools, schemas, response budgets,
  initialization behavior, caller isolation, signed receipts, and bounded resource reads.
  Stdio already accumulates bounded frame slices rather than copying each prefix;
  changing that working implementation offered little value.
- **Hosted Worker and Docker:** both upload/copy the snapshot. The Worker keeps its
  existing read-only bundle and compatibility configuration. The text-module rule follows
  [Wrangler module configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
  No deployment was performed. Production latency and fresh OAuth consent remain unverified.
- **Installer and doctor:** compact, plugin, operator, and local MCP payloads include the
  snapshot. Integrity manifests hash it. Only this named asset receives an 8 MiB diagnostic
  allowance; other resources retain their 256 KiB limit and symlink checks.
- **Runtime/catalog/evals:** public build and test contracts are the verification boundary.
  No model, provider, or external-system behavior was changed for speculative speed gains.

## Tradeoffs and remaining limits

The snapshot adds about 4.2 MB of uncompressed package data. Each fresh process still reads
and hashes bundled source files before reuse; this protects local edits rather than trusting
mtime alone. Existing process-local index caching remains: changes to playbooks during a
long-running process require restarting that process to refresh retrieval ranking. Actual
MCP resource reads retain their live file checks.

The snapshot is derived code-dependent data, not a second editable knowledge source.
Regenerate it with `node tools/update-completeness.mjs`; never edit it manually.
Its parity test is part of `npm test` and prevents stale generated data from passing CI.

Local fixtures establish routing, retrieval, checks, packaging, and transport behavior.
They do not establish model attention, usefulness of every marketing method, audience
outcomes, native-client activation, or deployed service speed. Live agent runs were not
started because this workspace requires a separate request before provider CLI workflows.

## Reproduce

Run `node tools/dev.mjs build` and `node tools/dev.mjs test` after installing dependencies.
For timing, wait for other builds and tests to finish, then run:

```sh
node tools/e2e/performance.mjs --reference docs/performance/baseline.json --out docs/performance/after.json
node tools/e2e/surface-performance.mjs --reference docs/performance/surfaces-baseline.json --out docs/performance/surfaces-after.json
node tools/e2e/routing-breadth.mjs
node tools/e2e/agent-loop.mjs --out docs/performance/agent-loop
node tools/e2e/app-integration.mjs --installer bun
```

For a new baseline, extract the base commit to a separate directory and pass its absolute
path as `--source-root` to either performance script. The surface script starts real CLI
and hook entrypoints in an isolated home with an empty disk cache for each sample. It
normalizes only source/home paths before comparing output hashes. It starts no agent.

The main file is this review. `baseline.json` and `after.json` contain API and framing
samples; `surfaces-*.json` contain CLI/hook samples. `agent-loop/report.json` records the
local HTTP workflow; its Markdown companion presents those same results.

## Verification results

- Build and public TypeScript checks passed.
- `node tools/dev.mjs test`: 456 tooling/host tests, 294 runtime tests,
  167 catalog tests, and 63 evaluation tests passed (980 total).
- Routing breadth: 142/142 cases passed.
- Installed npm tarball, installed with Bun: 38/38 app checks passed, including
  official MCP clients and strict TypeScript consumption. `installed-app.json`
  retains the tarball digest and individual checks without machine-local paths.
- Loopback authenticated HTTP agent workflow: 11/11 steps passed.
- New test files and surface benchmark pass the repository linter. Existing files
  retain pre-existing lint findings; this work does not claim a clean repository-wide lint run.

The HTTP E2E check now reads the structured command field instead of a retired text
heading. The app E2E harness honors its Bun option for development dependencies too.
Neither change alters production behavior. Timing reports identify the source revision,
source or harness hashes, platform, samples, and output digests. An extracted source
archive is no longer incorrectly attributed to its containing checkout's Git revision.

The final idle run records cold full briefs at 273.79 → 126.74 ms, cold search
at 263.49 → 120.30 ms, warm search at 0.39 → 0.20 ms, CLI briefs at
347.95 → 201.39 ms, and relevant prompt hooks at 343.68 → 199.22 ms.
All compared output hashes match. Fragmented transport and checks remain effectively
unchanged; the change targets retrieval and agent reading costs.
`results.html` is a generated visual summary of the checked timing JSON and test results.
