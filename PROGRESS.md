# Product progress

## Release 0.5.1 (branch `chore/release-0.5.1`)

[#70](https://github.com/forsvn-labs/conquistador/pull/70) (per-agent start line after
`conquistador add`) is merged and recorded in [CHANGELOG.md](CHANGELOG.md) under 0.5.1. This branch
bumps every manifest to 0.5.1; the tag, GitHub release and npm publish follow its merge. Gemini CLI
hooks are not built.

Open: a frozen spinner while a plugin manager runs (installs call `spawnSync`); no resize test in
the E2E harness; interactive Windows installation and Linux/Windows ARM remain untested.

Merge and release history is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
