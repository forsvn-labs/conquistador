# Develop Conquistador

These instructions apply to the complete product source or extracted ZIP distribution. Compact installs made by
`tools/setup.mjs` or `tools/install.mjs` contain methods and usage documentation. Run build/test/package commands from
the complete distribution, not a compact install.

Use Node 24, npm, and Git. Work directly in this repository; no private workspace or historical
release ledger is needed for the default development path. All commands below run from its root.

```sh
npm run bootstrap
npm run build
npm test
node runtime/bin/conquistador.js --help
```

Bootstrap installs the exact module lockfiles with lifecycle scripts disabled. It also installs the
root CLI dependency without generating a second lock. Build compiles the maintained runtime and
checks runtime/catalog TypeScript. Test runs public runner, catalog, Eval Lab, and local tooling
contracts. These tests use fixtures and local processes; they do not invoke providers or certify
native Eve/Grok operation. Python 3 is optional for the submit-feedback draft helper.

For a focused change, use `npm --prefix runtime test`, `npm --prefix catalog test`, or
`npm --prefix evals test`. `npm --prefix evals run example:local` demonstrates the public contract
SDK using explicitly synthetic fixtures, with no model or network. See each module README for APIs.

Edit authored source in `runtime/src/`, `catalog/src/`, or `evals/src/`; runtime/lib is maintained
build output. Skills are editable Markdown with contained resources and metadata versions. Preserve
frontmatter names and parent routing. An isolated skill must not depend on sibling or private files.
Record unshipped behavior changes and checks in PROGRESS.md. CHANGELOG.md contains shipped work only. Do not add private issue exports,
source history, raw provider receipts, customer content, or credentials to a pull request.

After intentional skill or supporting-resource edits, run `node tools/update-completeness.mjs` and
review `release/completeness.json` with the source changes. It records exact method versions and
content hashes for the complete library. The installation-doctor tests reject missing or stale
manifest entries. Use `node runtime/bin/conquistador.js operator doctor --path /absolute/install`
to check local files without starting a host or service. This does not establish host activation,
model context loading, provider access, or release acceptance.

The repository-root SKILL.md is the skills.sh entry point. It forwards to the authored parent under
skills/conquistador and travels with the complete public tree. Keep every required method contained.
Do not move the wrapper into the parent folder without preserving sibling methods in installations.
Only native Claude agent definitions belong in agents/*.md; portable-role documentation belongs in
docs/ because Claude scans the agents directory recursively. Run `node tools/plugin-contracts.mjs .`
to check plugin paths and metadata. These checks do not start a host or validate model behavior.

## Package a local commit

This phase is private-alpha preparation. Keep `package.json` marked `private: true`; local npm pack still
works. Do not publish, remove that guard or change repository visibility without explicit approval.


Run bootstrap/build/test, review generated changes, and commit the source and maintained output.
Then:

```sh
npm run package
```

The command requires a clean Git checkout. It reads tracked files from the exact HEAD commit and
writes `dist/<commit>/conquistador-<version>.zip`, an npm tarball, `SHA256SUMS`, and `assembly.json`.
The ZIP uses stable paths, modes, timestamps and ordering. Repeated ZIP packaging of the same commit
is byte-identical. npm tarball bytes are recorded with npm/Node/platform versions; cross-toolchain
reproducibility is not claimed. Existing output is never overwritten. Choose another output root
with `npm run package -- /absolute/path/output` to compare independent runs.

Packaging uses no private ledger. Its record says UNBOUND and unpublished, with zero live executions
and human verdicts. It is a source/archive identity record, not release approval. It never pushes,
tags, signs, uploads, or publishes. Before any public release, obtain the applicable external and
human acceptance evidence and explicit operator authorization.

CI runs the same local commands for pull requests and pushes to `main`, historical `dogfood/0.1.0`, or proposed `private-alpha`,
with read-only repository permissions. It never publishes.
Historical `test:source`, candidate, live-evidence and inventory-maintenance pipelines retain their
own private authority requirements and are not part of `npm test` or the public setup path.

The commands have been exercised on macOS with Node 24 and are suitable for the included Linux CI
job. Other operating systems and CPU architectures still require their own observed verification.

## Setup changes

`tools/setup.mjs` coordinates guided installation, route listing, status, doctor, update and uninstall.
The [installation architecture](docs/INSTALLATION-ARCHITECTURE.md) defines payload and lifecycle contracts. It delegates skill,
plugin and role copies to the existing owned installer. Local MCP stages an owned server/library copy; runtime MCP requires a stable distribution.
Connector configuration remains separate from runtime service and data ownership. The executable's `setup` command and default `mcp` method server load Node-only tools without
importing runtime dependencies. Explicit `mcp --url` retains the HTTP runtime bridge. Keep the
default entry points usable before bootstrap and test stdout as protocol data only.

Run setup, setup-portability, entry, doctor, plugin, and MCP tests when changing host paths or
removal behavior. Cross-platform path tests do not establish native Windows activation. Host registration
commands are instructions, not hidden subprocesses. Test files and synthetic fixtures cannot
prove native registration or service connectivity.
