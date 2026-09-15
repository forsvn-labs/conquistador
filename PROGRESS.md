# Implementation status

Version 0.1.0 is packaged and privately prereleased as
[`v0.1.0-dogfood.2`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.1.0-dogfood.2)
(source `0ae8df059170d476d2f700ad161429c9061b2f17` on `dogfood/0.1.0`). The current feature branch
updates the parent method to 2.6.0 with explicitly versioned v2 master-agent contracts. The root npm package has `private: true`; CI only builds and tests with read-only
repository permissions. Public distribution is deferred. Final source packaging binds the
integrated documentation and installer to that exact clean commit in `assembly.json`
(`authority: UNBOUND`, not a public publish). Earlier artifacts retain their original source
identity and are not rebuilt. Installing a new package does not update existing copies.

## Implemented

| Area | Available behavior |
| --- | --- |
| Entry point | `/conquistador` acts as the master agent and selects from all 38 outcome methods, including engineering requests |
| Installation | Existing lifecycle plus constrained domain selection for skills/plugins/harnesses; canonical dependencies and load-time restrictions; domain MCP is unsupported |
| Local MCP | Dependency-free stdio method listing and contained text reads; host supplies model/tools, no separate HTTP service or model credentials |
| Agents | Versioned v2 master with preserved v1 compatibility, seven specialist roles, a callable BB child-thread adapter, exact integrated review and sequential fallback |
| Task setup and previews | Exact host-route discovery through extension manifests, Connections and Gateway; bounded reads with redacted setup receipts; existing Lavish AXI launchers |
| Proactive advice | Disabled by default; explicit Claude hook configuration lifecycle is implemented, with native activation and source verification still unverified |
| Optional runtime | Four executable graphs, sealed step-specific judgments, draft and missing-connection handoffs, failure/resume and separate human review/action authority |
| Tools and evaluation | Host-injected typed operation bridge, catalog contracts and local Eval SDK examples with explicit synthetic fixtures |
| Learning and feedback | Existing state/export APIs, no implicit learning promotion, and opt-in redacted feedback drafts with exact payload consent |

See [INSTALL.md](INSTALL.md), [docs/SERVICES.md](docs/SERVICES.md),
[docs/MASTER-AGENT.md](docs/MASTER-AGENT.md), [docs/PREVIEW.md](docs/PREVIEW.md) and
[docs/LEARNING.md](docs/LEARNING.md) for use and limits.
The preview instructions are host procedures; they do not add a runtime launcher or automatic
annotation consumer. Run artifacts and audit state still persist when automatic learning is off.

## Verification

The current execution slice has actual BB evidence: two specialist contexts, one integration
context and a separate review context completed a draft. The reviewer bound its findings to the
exact integrated artifact. An earlier run requested revision; the final run had no material draft
findings. A separate same-context run completed with
independent review false. A public repository metadata read succeeded through an exact
Executor-bound Connection in candidate-verification mode. These observations do not establish
human acceptance, general output quality, sandboxed tools or supported provider status.

The independent implementation review found and rechecked fixes for cancellation cleanup,
child ownership, unknown spawn outcomes and exact Executor connection binding. The Node 24.12.0 build and all 592 default tests pass: 71 tooling, 291 runtime, 167 catalog and
63 Eval Lab. This includes ten orchestration checks, seven stack checks and twelve graph checks.
The catalog check validates 17 operations; the synthetic local contract example also passes. Graph tests use synthetic judgments and explicitly preserve
missing image/vision/data connections. Private task outputs and source provenance stay outside
the product.

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
host/model/provider/human acceptance remains incomplete. BB conversation isolation and one
Executor metadata read have been observed. Native activation in other hosts, Claude hook delivery,
connected image/vision/data execution and authenticated human acceptance remain unverified.
A worker returning an invalid protocol result fails closed; the coordinator does not coerce or
replay accepted work. BB cleanup rechecks ownership before stopping a child and reports unresolved
identities rather than stopping an unverified thread.

Domain selection reuses the canonical library and the owned installer lifecycle. The BB loader
enforces restrictions when present. A host with direct filesystem or tool access must enforce its
own security boundary. Domain MCP is unsupported. The optional runtime executes declared graphs;
it does not become a general dynamic-team service.

Both memory-mode spellings leave automatic learning promotion disabled. A separate consent API
and cross-run retrieval are absent. Public feedback sending stays deferred during private use.
Ambiguous dispatch pauses without automatic replay; there is no supported reconciliation API yet.
Imported action receipts remain operator attestations unless separate observed evidence supports
them. Rights disposition and release authority remain work for a later public release.
