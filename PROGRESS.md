# Product progress

Merged, not released: [#72](https://github.com/forsvn-labs/conquistador/pull/72) (`9b2acca`, 2026-10-12) moves
every link to `conquistador.app`. Four changed files ship in the npm package (`INSTALL.md`, `docs/CHECK.md`,
`hooks/README.md`, `skills/conquistador/commands/check/COMMAND.md`) and two release manifests; npm users get them
with the next release. 0.5.1 is `latest` on npm (2026-10-10); see [CHANGELOG.md](CHANGELOG.md).
Gemini CLI hooks are not built.

Open: a frozen spinner while a plugin manager runs (installs call `spawnSync`); no resize test in
the E2E harness; interactive Windows installation and Linux/Windows ARM remain untested.

Merge and release history is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
