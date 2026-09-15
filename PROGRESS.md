# Implementation status

Version 0.1.0 is packaged for private local dogfooding. Parent method version is 2.4.3. The root
npm package has `private: true`; CI only builds and tests with read-only repository permissions.
Public distribution is deferred. Final source packaging binds the integrated documentation and
installer to an exact clean commit in `assembly.json`. Earlier artifacts retain their original
source identity and are not rebuilt. Installing a new package does not update existing copies.

## Implemented

| Area | Available behavior |
| --- | --- |
| Entry point | `/conquistador` selects from all 38 outcome methods, including engineering requests |
| Installation | Complete root skill bundle, owned install/upgrade/remove with edited-tree protection, contained usage guides in each staged mode, skills CLI layout, Claude/Codex marketplaces and Agent Plugins 1.0.0 metadata |
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
