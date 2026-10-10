# Product progress

0.5.0 is `latest` on npm (2026-10-10); see [CHANGELOG.md](CHANGELOG.md).

## Unreleased: per-agent start line after `conquistador add`

`conquistador add` ended with "type /conquistador in your agent" for every agent. Only Claude Code,
Pi, Hermes Agent and Antigravity CLI have that slash command. It now prints one line for each agent
it installed: the slash command where one exists, else `"Use Conquistador: <your task>"`. The
full-screen installer already did this. Tests first: the new front-door check failed on the old
line; package E2E B1 now checks both forms. `npm test` 940 (416 tooling).

Live Grok check (2026-10-10, Grok CLI 1.0.50, throwaway `HOME`, 0.5.0 from npm): the plugin, its
hook and the MCP tools loaded. After the agent wrote a launch email, the copy-check hook ran in
65 ms and returned findings (`additional_context=true`); after the fixes it ran clean. Gemini CLI
hooks are not built.

Open: a frozen spinner while a plugin manager runs (installs call `spawnSync`); no resize test in
the E2E harness; interactive Windows installation and Linux/Windows ARM remain untested.

Merge and release history is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
