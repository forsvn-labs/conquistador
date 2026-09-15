# Develop Conquistador

These instructions apply to the complete public product. The portable ZIP contains plugin skills
and documentation only; use the complete distribution for build/test/package commands.

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
Describe behavior changes and relevant checks in CHANGELOG.md. Do not add private issue exports,
source history, raw provider receipts, customer content, or credentials to a pull request.

The repository-root SKILL.md is the skills.sh entry point. It forwards to the authored parent under
skills/conquistador and travels with the complete public tree. Keep every required method contained.
Do not move the wrapper into the parent folder without preserving sibling methods in installations.
Only native Claude agent definitions belong in agents/*.md; portable-role documentation belongs in
docs/ because Claude scans the agents directory recursively. Run `node tools/plugin-contracts.mjs .`
to check plugin paths and metadata. These checks do not start a host or validate model behavior.

## Package a local commit

This phase is private dogfooding. Keep `package.json` marked `private: true`; local npm pack still
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

CI runs the same local commands with read-only repository permissions. It never publishes.
Historical `test:source`, candidate, live-evidence and inventory-maintenance pipelines retain their
own private authority requirements and are not part of `npm test` or the public setup path.

The commands have been exercised on macOS with Node 24 and are suitable for the included Linux CI
job. Other operating systems and CPU architectures still require their own observed verification.
