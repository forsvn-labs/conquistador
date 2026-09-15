# Implementation status

Version 0.1.0 is packaged and privately prereleased as
[`v0.1.0-dogfood.2`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.1.0-dogfood.2)
(source `0ae8df059170d476d2f700ad161429c9061b2f17` on `dogfood/0.1.0`). The current feature branch
updates the parent method to 2.7.0 with explicitly versioned v2 master-agent contracts and optional
Executor/Eve setup. The root npm package has `private: true`; CI only builds and tests with read-only
repository permissions. Public distribution is deferred. Final source packaging binds the
integrated documentation and installer to that exact clean commit in `assembly.json`
(`authority: UNBOUND`, not a public publish). Earlier artifacts retain their original source
identity and are not rebuilt. Installing a new package does not update existing copies.

## Implemented

### Optional integration adoption

The local adoption branch adds Executor account setup, an explicit Eve job host, and read-only
upstream release monitoring. The coding agent remains the ordinary entrypoint. Existing host tools
remain usable within their policies; the catalog still requires exact audited operations.

- Executor configuration contains endpoint and UI URLs plus an environment-variable reference.
  The client offers a UI handoff and bounded discovery. Its host-only GitHub metadata callback
  verifies an exact reviewed schema, account connection, allowlist, and deadline before invocation.
  It does not offer arbitrary execution or copy provider credentials into Conquistador.
- The optional Eve app uses the canonical methods, a named owner, separate worker/operator access,
  and Executor connections. Preparation and explicit session commands are separate from installation,
  model access, service start, and scheduling. The original portable Eve staging contract stays
  candidate-only.
- Exact private package pins and Bun lockfiles support explicit installation and review.
  `integrations status` reads local pins; `check-updates` compares public npm release metadata without
  changing dependencies or grants. The daily GitHub release watch needs default-branch activation.
  Optional CI checks package compatibility and security advisories. No automatic upgrade is enabled.

The Executor worker verified Node 24.21.0 build/tests, 21 optional client tests, frozen dependency
installation, and a clean dependency audit. The client tests use the installed official MCP SDK
with a synthetic loopback server. They do not prove a deployed Executor endpoint or provider account.
Integrated verification and native Eve checks are still in progress for this local change.

Live dogfooding still needs an approved Executor endpoint, scoped bearer, provider account/policies,
and reviewed operation binding. Eve also needs an operator-owned service, selected model, budget,
and observed approval/recovery behavior. No live call, model turn, deployment, or release is claimed
by this adoption work. See [integration setup](docs/INTEGRATIONS.md).

### Existing product behavior

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
child ownership, unknown spawn outcomes and exact Executor connection binding. The Node 24.12.0 build and all 595 default tests pass: 74 tooling, 291 runtime, 167 catalog and
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

## Final helper review

The Claude adapter now registers SessionStart and Stop only. It rejects results-updated registration,
removes its old TaskCompleted hook during enable or remove, and preserves unrelated hooks. Invalid,
missing or oversized input suppresses advice. Config errors emit redacted diagnostics and exit 1
so an advisory failure cannot block completion. Status checks the intersection of enabled and
registered events. The current official event reference was checked through web access; source
verification through Executor and native event delivery remain unverified.

Domain documentation now identifies the enforcement boundary. The callable coordinator checks the
installed restriction before loading or dispatching. Compact skill copies only filter the staged
methods; their consuming host must enforce the restriction file.

Final review validation passes on Node 24.19.0: build and all 599 default tests, with 78 tooling,
291 runtime, 167 catalog and 63 Eval Lab tests. The catalog check validates 17 operations and
the synthetic local example passes. A focused scan checked 1,530 tracked product files against
four private fingerprints with no matches. These checks do not establish native hook delivery.
