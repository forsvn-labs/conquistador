# Product roadmap

## Now: private dogfood with a clear install path

Use one root skills.sh command, then complete a real task in the user's existing host. The default
copies all 38 outcome methods. README, INSTALL, and the usage guides explain prerequisites,
installation traps, payload locations, first tasks, recovery, and optional integrations.

Current source adds `conquistador setup doctor --path ABS [--json]` and a completeness manifest.
The doctor checks method versions and content, required resources, receipts, available source
identity, and managed MCP executable paths. It separates local file readiness from host activation
and useful work. Managed compact copies omit the BB adapter; plugin and harness copies include it.

The shipped private prerelease is
[`v0.1.0-dogfood.4`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.1.0-dogfood.4)
from `45a3d27` on `dogfood/0.1.0`. It includes the documentation rewrite, completeness manifest,
and installation doctor. Keep its ZIP, npm tarball, checksums, and unbound assembly record tied to
that source. The repository and packages remain private. See [implementation status](PROGRESS.md)
for verification scope.

## Next: observe and improve the first task

1. Exercise the pinned installer in priority dogfood hosts. Observe discovery in a fresh session,
   parent routing, a finished deliverable, and one correction. Record the exact build, host, model,
   and outcome with the [dogfood checklist](docs/DOGFOOD.md). Local doctor results remain separate.
2. Polish Executor setup and task resumption. Start with existing permitted connections; help a
   new user install or connect Executor only when missing live access blocks the task. Observe an
   authorized account operation, approval where needed, failure recovery, and the resumed deliverable.
3. Improve update identity and repair. Preserve the resolved source commit and original host where
   possible, expose identity consistently, and test cache/source/Node changes. Keep a useful path
   for older installations and edited files. Do not make guided setup the default.
4. Check optional host behavior when a real task needs it: isolated specialist review, Lavish
   annotations, domain restrictions, and Claude SessionStart/Stop delivery. Keep same-context review
   labeled. Compact copies rely on their consuming host for domain enforcement.
5. Exercise an explicitly requested Eve job with a named owner, approved model and budget, and
   observed approval, cancellation, and persisted-state recovery. Keep dependency pins and review
   upstream updates before promotion. Discovery and accepted submissions do not prove a useful job.

The optional runtime executes four declared playbooks. Connect missing model, vision, and campaign
data routes only for authorized tasks. Databricks, Confluence, and HubSpot need exact audited
operation extensions before maintained runtime support claims. No additional outcome library is
needed for this work.

Automatic learning promotion stays disabled. A separate persistence-consent API and cross-run
retrieval remain future work. Use approved host files under [memory guidance](docs/LEARNING.md).
Keep feedback as local redacted drafts during private dogfooding; any disclosure needs its own
approved destination and exact content.

## Deferred: public distribution

Public npm publication, marketplace listings, visibility changes, and landing work require a later
release decision. Review real outcomes, rights, provider and human evidence, and release authority
against the exact source and artifacts first. Pushes and publication need explicit authorization.
Do not treat local tests, package records, or doctor results as that authorization.
