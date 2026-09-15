# Implementation status

Version 0.1.0 is packaged and privately prereleased as
[`v0.1.0-dogfood.2`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.1.0-dogfood.2)
(source `0ae8df059170d476d2f700ad161429c9061b2f17` on `dogfood/0.1.0`). Parent method version is
2.4.3. The root npm package has `private: true`; CI only builds and tests with read-only
repository permissions. Public distribution is deferred. Final source packaging binds the
integrated documentation and installer to that exact clean commit in `assembly.json`
(`authority: UNBOUND`, not a public publish). Earlier artifacts retain their original source
identity and are not rebuilt. Installing a new package does not update existing copies.

## Implemented

| Area | Available behavior |
| --- | --- |
| Entry point | `/conquistador` selects from all 38 outcome methods, including engineering requests |
| Installation | Direct private Git skills and host plugins, npm on-demand launcher, clone fallback and managed install/status/update/uninstall with owned-file protection |
| Local MCP | Dependency-free stdio method listing and contained text reads; host supplies model/tools, no separate HTTP service or model credentials |
| Agents | One native Claude agent and portable single-agent/squad contracts; the squad advisor has a review-only role |
| Task setup and previews | Host-managed prerequisites and pinned cached Lavish AXI launchers with command telemetry opt-out |
| Proactive advice | Opt-in static reminders for session-start, before-delivery and results-updated; no automatic hook registration or scheduler |
| Optional runtime | Compiled Node 24 CLI, supported playbook chat, narrow MCP, owned artifact reads and separate HTTP review/action authority |
| Tools and evaluation | Host-injected typed operation bridge, catalog contracts and local Eval SDK examples with explicit synthetic fixtures |
| Learning and feedback | Existing state/export APIs, no implicit learning promotion, and opt-in redacted feedback drafts with exact payload consent |

See [INSTALL.md](INSTALL.md), [docs/SERVICES.md](docs/SERVICES.md),
[docs/PREVIEW.md](docs/PREVIEW.md) and [docs/LEARNING.md](docs/LEARNING.md) for use and limits.
The preview instructions are host procedures; they do not add a runtime launcher or automatic
annotation consumer. Run artifacts and audit state still persist when automatic learning is off.

## Verification

Private prerelease `v0.1.0-dogfood.2` records Node 24 build and all 544 default tests: 43 tooling,
278 runtime, 160 catalog and 63 Eval Lab. Real private Git skills install/reinstall/list/remove
and npm setup install/remove passed in temporary projects. Local MCP discovery, all 39 method
entries, parent and iOS template reads, protocol negotiation and path refusals passed in spawned
processes without runtime dependencies. Exact ZIP/npm checksum checks and Linux CI passed.
Native plugin commands were checked against primary sources; native host activation and useful
model execution remain unverified.


The guided setup follow-up passes Node 24 build and all 533 default tests: 32 tooling, 278 runtime,
160 catalog and 63 Eval Lab. Thirteen setup tests cover ownership, host paths, MCP origins,
experimental handoffs and nested source/project layout. An additional executable test proves
setup works without runtime libraries or dependencies. A real terminal session completed skill
installation followed by path-only status, update and uninstall. All 39 method roots were present;
the temporary installation was removed. No native host registration or live connection is implied.
Earlier checks below retain their original scope.

Earlier implementation checks passed the Node 24 build and 518 default tests. Installation checks
exercised the skills CLI on seven coding-agent targets. Local Bun/npm probes exercised pinned
Lavish sessions without changing project dependencies. These checks do not establish native
agent activation, human annotation or useful model output.

The integrated source passed the Node 24 build and all 519 default tests: 18 local tooling,
278 runtime, 160 catalog and 63 Eval Lab tests. The catalog check validated 17 operations, and
the synthetic local Eval SDK example passed. Maintained runtime/lib output matched source.

The final integration adds a staged usage-guide check for all seven installer mode families,
including contained Markdown links and refusal to upgrade or remove edited usage docs. CI includes
`dogfood/0.1.0` and `main` pushes and keeps read-only permissions. Follow
[CONTRIBUTING.md](CONTRIBUTING.md) for complete-distribution build, test and package commands.
Final artifact checks are recorded separately against the exact source commit; previous Docker
and host checks do not transfer to a new revision.

## Remaining limits and next use

Use [docs/DOGFOOD.md](docs/DOGFOOD.md) to assess real tasks, routing and Lavish revisions. Complete
host/model/provider/human acceptance remains unverified. Portable role contracts do not establish
native support in every host. Proactive events need explicit host configuration.

Both memory-mode spellings leave automatic learning promotion disabled. A separate consent API
and cross-run retrieval are absent. Public feedback sending stays deferred during private use.
Ambiguous dispatch pauses without automatic replay; there is no supported reconciliation API yet.
Imported action receipts remain operator attestations unless separate observed evidence supports
them. Rights disposition and release authority remain work for a later public release.
