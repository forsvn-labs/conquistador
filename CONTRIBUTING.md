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

The repository-root SKILL.md is an authoring entry point over canonical skills. Host installations
must use the transformation in tools/stage-method-library.mjs. It keeps source method bodies and
resources intact apart from deterministic document-name/link adaptation. Compact installs, staged
plugins and portable operators expose one SKILL.md and load internal METHOD.md files after routing.
Do not copy the untransformed source tree as the default host skill/plugin. Test installed payloads,
including byte parity, resource links, domain subsets, initial metadata size, and BB loader paths.
Only native Claude agent definitions belong in agents/*.md; portable-role documentation belongs in
docs/ because Claude scans the agents directory recursively. Run `node tools/plugin-contracts.mjs .`
to check plugin paths and metadata. These checks do not start a host or validate model behavior.

## Package a local commit

`@forsvn/conquistador` is a public npm package. `package.json` keeps `publishConfig.access`
`public` and no `private` flag; `npm run package` checks both. Publish to npm only with explicit
approval, through the release workflow below.


Run bootstrap/build/test, review generated changes, and commit the source and maintained output.
Then:

```sh
npm run package
```

The command requires a clean Git checkout. It reads tracked files from the exact HEAD commit and
writes `dist/<commit>/conquistador-<version>.zip`, an npm tarball, prepared one-parent skill and plugin ZIPs, `SHA256SUMS`, and `assembly.json`.
The ZIP uses stable paths, modes, timestamps and ordering. Repeated ZIP packaging of the same commit
is byte-identical. npm tarball bytes are recorded with npm/Node/platform versions; cross-toolchain
reproducibility is not claimed. Existing output is never overwritten. Choose another output root
with `npm run package -- /absolute/path/output` to compare independent runs.

Packaging uses no private ledger. Its record says UNBOUND and unpublished, with zero live executions
and human verdicts. It is a source/archive identity record, not release approval. It never pushes,
tags, signs, uploads, or publishes. Before any public release, obtain the applicable external and
human acceptance evidence and explicit operator authorization.

CI runs the same local commands for pull requests and pushes to `main`, historical `dogfood/0.1.0`, or `private-alpha`,
with read-only repository permissions. It never publishes.

## Release to npm

npm trusts `.github/workflows/publish.yml` in `forsvn-labs/conquistador` as the only publisher
of `@forsvn/conquistador` (trusted publishing through OIDC). No npm token or 2FA prompt is needed.

1. Merge the version bump into `private-alpha`, then tag the merge commit `vX.Y.Z` and push the tag.
2. In a clean clone at the tag, run `npm run bootstrap` and `npm run package`.
3. Create the GitHub release with the six assets from `dist/<commit>/`:
   `gh release create vX.Y.Z --verify-tag --title "..." --notes-file NOTES.md dist/<commit>/*`.
   Add `--prerelease` to publish under the npm `next` dist-tag instead of `latest`.
4. The workflow downloads the release tarball and checks it against `SHA256SUMS`. It also checks
   the package name, the version against the tag, that there is no `private` flag, and that
   `assembly.json` names the tagged commit. Then it publishes those exact bytes with provenance.

To retry, run the workflow by hand with the tag: `gh workflow run publish.yml -f tag=vX.Y.Z`.
If the version is already on npm, the workflow publishes nothing and only checks that the npm
OIDC token exchange works.
Historical `test:source`, candidate, live-evidence and inventory-maintenance pipelines retain their
own private authority requirements and are not part of `npm test` or the public setup path.

The commands have been exercised on macOS with Node 24 and run in the included Linux CI job.
`.github/workflows/install-e2e.yml` runs `tools/e2e/package-install.mjs` on Linux and Windows with the
real agent CLIs. Other CPU architectures still require their own observed verification.

## Setup changes

`tools/setup.mjs` coordinates guided installation, route listing, status, doctor, update and uninstall.
The [installation architecture](docs/INSTALLATION-ARCHITECTURE.md) defines payload and lifecycle contracts. It delegates skill,
plugin and role copies to the existing owned installer. Local MCP stages an owned server/library copy; runtime MCP requires a stable distribution.
Connector configuration remains separate from runtime service and data ownership. The executable's `setup` command and default `mcp` method server load Node-only tools without
importing runtime dependencies. Explicit `mcp --url` retains the HTTP runtime bridge. Keep the
default entry points usable before bootstrap and test stdout as protocol data only.

Run setup, setup-portability, entry, doctor, lazy-discovery, plugin, and MCP tests when changing host paths or
removal behavior. Cross-platform path tests do not establish native Windows activation. Host registration
commands are instructions, not hidden subprocesses. Test files and synthetic fixtures cannot
prove native registration or service connectivity.

The setup TUI uses the committed `tools/vendor/clack.mjs` bundle. To intentionally rebuild it,
run `npm ci --ignore-scripts --prefix tools/tui` and `npm run build --prefix tools/tui` under Node 24.
Review the exact lockfile and preserve `tools/vendor/NOTICE.txt`. Ordinary setup and packaging
use the committed bytes and do not require that dependency tree. The default test suite exercises
project/native-skill ownership, migration, mixed installation plans, cancellation, preflight,
partial failures, and the guided flow separately from native host acceptance. A guide plan is not
a global transaction. The operator and its native skills transact together; completed independent
plugin/connector/squad installations must stay owned and be reported when a later step fails.
