# Product progress

## Linux and Windows install verification

Branch `test/linux-windows-e2e`, PR [#26](https://github.com/forsvn-labs/conquistador/pull/26).
Details: Part 7 of [docs/REVIEW-2026-09-SURFACES.md](docs/REVIEW-2026-09-SURFACES.md).

- `tools/e2e/package-install.mjs` runs on Linux and Windows. `.github/workflows/install-e2e.yml`
  runs it with the real agent CLIs. Run 36664487941: Linux 28 of 28, Windows 25 of 25 (3 terminal checks
  not run). macOS 28 of 28 locally. `npm test` 764 of 764. `tools/e2e/update-latest.mjs` 21 of 21.
- Fixed: on Windows, npm-installed Claude Code, Codex, and Copilot CLI could not be installed into
  (`spawnSync ENOENT`), and the agent launch passed the task through an unquoted shell. New
  `tools/spawn.mjs`.
- Fixed: a broken link on PATH counted as an installed agent.
- Fixed: `npm run bootstrap` on Windows.

Ships in the next release, with the changelog entry.
