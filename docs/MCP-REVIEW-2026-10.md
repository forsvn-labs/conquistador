# Application review, 2026-10-22

This review covers the application repository at baseline `8d40f9841088fc7f73039890a950483b9669342d`:
the CLI and terminal installer, public npm imports, stdio/HTTP MCP, and the runtime,
catalog and eval contracts. The landing site and separate desktop repository are outside
this checkout. Changes belong to [PR #84](https://github.com/forsvn-labs/conquistador/pull/84).
ROADMAP.md and VERSIONS.md own the current release and publication status.

## Verified defects and changes

1. **Brief file reads bypassed the direct reader's boundary.** After a safe playbook
   entered the ranking cache, replacing its file or an ancestor with a symlink could
   put outside text into a brief. Binary, invalid UTF-8 and oversized replacements
   also behaved differently from `conquistador_read`. Brief packing now uses the
   same contained, bounded reader. Unsafe files become unavailable required reads;
   the remaining safe playbooks still work. This fixture requires local library
   modification; it does not establish an unauthenticated remote write exploit.
2. **Fragmented stdio input repeatedly copied its prefix.** A valid 60,076-byte
   UTF-8 frame caused 1,804,592,925 bytes of concatenation work when delivered one
   byte at a time. The server now keeps bounded slices and assembles each frame
   once. Protocol limits and outputs stay the same.
3. **Fetch uploads could escape or stall.** Body-stream errors rejected the handler;
   rejected or stalled cancellation could prevent the expected HTTP 413 response.
   App and Worker MCP now return a generic HTTP 400 for read failures, return 413
   without waiting for oversize cancellation, release readers, and accept a healthy
   retry. Authentication still runs before acquiring a body reader.

Each defect had a failing regression before its implementation changed. The tests
exercise five warm-cache file replacements, six app/Worker stream failure cases,
authentication before body reads, a near-limit fragmentation copy bound, multiple
messages, fragmented UTF-8, the exact byte limit, the next byte, and incomplete EOF.
Installed npm and Bun consumers also test replaced playbooks and upload recovery.

## Verification

All local application work uses temporary homes, fixture identities and loopback
services. No model, real message, production write, credential change, deployment or
release is part of these checks.

| Check | Result |
| --- | --- |
| Baseline build, type checks and public tests | 942 pass |
| MCP changes: Node 26 build, type checks and public tests | 963 pass: 439 tooling, 294 runtime, 167 catalog, 63 eval |
| Final focused stdio, Node HTTP and Worker regressions | 54 pass |
| Patched development graph: Node 24 runtime/catalog/eval tests | 524 pass |
| Fresh npm audits of the three private test graphs | Zero findings in each |
| Actual npm consumer, official v1/current MCP clients and strict TypeScript imports | 38 pass |
| Actual Bun consumer | 38 pass |
| Terminal installer, sequential Node 24 run | 67/67 pass |
| Local OAuth/workerd/browser, Node 24 and Node 26 | 27/27 on each runtime |
| Writing checker and social-style fixtures | 44/44 and 15/15 pass |
| Installation command methods | 13/13 pass |
| Offline connection checks | 6 pass; 2 live checks intentionally not run |

The initial concurrent terminal run passed 65/67. Both selection cases passed the
unchanged focused rerun and the full sequential run; assertions and UI code were not
changed. The initial Node 26 Worker run failed startup readiness. After resolving the
missing pinned browser in temporary storage, the unchanged complete suite passed on
both runtimes. These observations do not prove that terminal timing can never fail
under host contention.

The custom repository lint check is already failing at baseline (515 diagnostics in
the reviewed existing files). The new benchmark passes it independently. This review
does not claim that repository-wide lint is clean.

## Measured performance

The same harness ran against the clean baseline and functional fix `544da4b`, on
Node 26.9.0, macOS arm64. Five paired rounds alternate before/after order; each
workload has seven samples per round, for 35 samples per version. Raw samples,
source hashes, median, p95, mean, sample variance and standard deviation are retained
in the JSON reports. This is a shared machine, not a controlled performance lab.

| Padding / chunk bytes | Before median (ms) | After median (ms) |
| --- | ---: | ---: |
| 1,024 / 1 | 1.91 | 2.32 |
| 1,024 / 64 | 0.08 | 0.11 |
| 16,384 / 1 | 27.48 | 14.55 |
| 16,384 / 64 | 0.26 | 0.17 |
| 64,000 / 1 | 179.91 | 43.08 |
| 64,000 / 64 | 2.48 | 0.48 |

For the largest one-byte-chunk case, median reduction is **76.1%**. Standard
deviation is **22.36 ms before / 6.46 ms after**; sample variance is **500.07 /
41.67 ms²**; p95 is **223.88 / 56.53 ms**. Small frames show no speed benefit.
These results measure fixture frame assembly, not model, provider, network or whole-task latency.

All framing outputs and six app workloads match byte for byte: full/compact outreach,
a launch play, two searches and a signed writing check. The contained reader adds
filesystem validation: one warm full-brief run measured 4.22 ms before / 6.07 ms after.
That correctness cost is retained; this review makes no general brief-speed claim.

Run the reusable harness from a complete checkout:

```sh
node tools/e2e/performance.mjs --out dist/e2e/performance/report.json
node tools/e2e/performance.mjs --source-root /path/to/clean/baseline --framing-only --out dist/e2e/performance/before.json
node tools/e2e/performance.mjs --framing-only --reference dist/e2e/performance/before.json --out dist/e2e/performance/after.json
```

For the paired experiment, repeat the last two commands five times into distinct
report files, reversing order on even rounds. `--api-only` compares the app workloads;
`--reference` rejects output drift. Avoid running other test suites during measurement.

## Dependency review and limits

Fresh npm audits report zero findings in each of the runtime, catalog and eval graphs.
The development fix pins Vite
8.3.3 and Vitest 4.1.12, with their required locked test-tool dependencies. Production
app dependencies are unchanged. Default-branch dependency alerts remain open until
an approved merge is processed. The optional isolated Promptfoo graph still has an
unpatched `node-forge` advisory; live execution remains outside this review.

Real provider/model jobs, production OAuth identities and API-key lifecycle, native
MCP activation in every supported client, native Windows/ARM installer interaction,
screen-reader acceptance, and mobile OAuth browser acceptance are not established.
Fixture checks cannot establish marketing quality or prove that all bugs are eliminated.
