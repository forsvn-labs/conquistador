# Review: surfaces, knowledge use, and installation (2026-09)

This is the single working document for the September 2026 overhaul. It records the review
findings, the decisions, and the verification results.

## Findings

### 1. Surfaces

- Every agent CLI on the review machine has a plugin manager: Claude Code 2.1, Codex 0.157,
  Cursor Agent, Copilot CLI 1.0, Grok 1.0, OpenCode 2.0, Goose 1.45, and Hermes 0.21.
  The repository already has plugin manifests, but they declare skills only. They ship no MCP
  server and no hooks, and the documentation steers users away from them.
- The installer has seven payload families (operator, native plugin source, compact skill,
  squad, local MCP, runtime MCP, experimental imports). Each has its own ownership receipt,
  doctor, and recovery rules. Users must choose between them before they get any value.
- The local MCP server exposes three file-reading tools. The agent must already know which
  file to read, so the server does not help the agent find the right playbook.
- Bot-type apps (Grok bot, Muse, ChatGPT, Claude Projects) have no working path. The Grok and
  Hermes routes print guidance only.

### 2. Knowledge use

The product has 1,040 knowledge files (5.8 MB) behind 39 skills. The agent skips most of them.
Root causes, in order of impact:

1. **The router marks the valuable files as optional.** For "Plan a Product Hunt launch", the
   request context requires `anti-patterns.md` and `fallbacks/sequential.md`. It marks the
   Product Hunt platform pack, the Product Hunt channel guide, the growth-play patterns, and the
   channel strategy as "deferred", with the same generic condition on every file.
2. **Too many hops.** The agent must read the parent, then the method, then find a link list at
   the bottom of the method, then open each file. Every hop is a chance to stop.
3. **Hedging drowns the instructions.** The parent contract spends most of its words on what is
   unverified or not authorized. The instruction to read the playbooks is one clause in step 4.
4. **Nothing checks.** No hook confirms that the agent read anything before it answers.
5. **Hooks are hard to turn on.** Proactive routing needs a hand-written JSON file, a per-project
   `hooks enable` command, and host trust. In practice nobody enables it.

### 3. Installation UX

- The first screen under the current Node (26) says "Conquistador requires Node 24". The code
  uses only core Node modules; the upper bound `<25` has no technical reason. Under Node 26,
  92 of 240 tool tests fail only because of that gate.
- The README is 150 lines of evidence caveats before the first useful command.
- The recommended path installs a per-project copy. Users must repeat it in every project.

## Decisions

1. **The plugin is the primary surface.** One repository is a valid plugin for Claude Code,
   Codex, Cursor, Copilot, and any Agent Plugins host. Each plugin ships the 39 skills, a local
   MCP server, and hooks. It is installed once per user, not once per project.
2. **Other surfaces use the same engine.**
   - Skills only: `npx skills add forsvn-labs/conquistador` (any SKILL.md host).
   - MCP only: `conquistador mcp` (stdio) or `conquistador mcp --http` (bots and remote apps).
   - Bot pack: `conquistador bot` writes a system prompt and upload-ready knowledge files for
     apps that take instructions and files but not MCP.
   - Terminal: `conquistador brief "TASK"` prints the same briefing.
   - The per-project operator stays available as `conquistador project`.
3. **One briefing engine decides what to read.** `tools/brief.mjs` selects methods with the
   existing router, then ranks every knowledge file for the task. It returns a short "must read"
   list with a reason for each file. The MCP tool returns the file text inline, so the agent
   gets the playbooks in one call.
4. **Hooks enforce reading.** The plugin prompt hook injects the must-read list for relevant
   prompts only. The stop hook checks the transcript. If a must-read file was not read, it
   blocks the answer once and names the files. Users can turn hooks off with
   `CONQUISTADOR_HOOKS=off`.
5. **User playbooks rank first.** Set `CONQUISTADOR_PLAYBOOKS` to a folder of Markdown files
   (for example, a private vault). The engine indexes it with the product knowledge and labels
   those results "your playbook". Nothing is copied into the product.
6. **Answers cite the playbooks.** The default deliverable ends with "Playbooks applied": each
   file and the rule taken from it.
7. **The installer detects agents and uses their own plugin managers.** Bare `conquistador`
   lists detected agents, preselects them, and installs with one confirmation.
8. **Node 24 or later.** The upper bound is removed.

## Status

See the verification section at the end of this document after each phase lands.

## Failure modes (written before the code)

### Briefing engine

1. A marketing prompt returns no method, so the agent gets no playbooks.
2. A named platform ("Product Hunt", "TikTok") does not pull its platform pack or channel guide.
3. The must-read list contains process scaffolding (fallbacks, format rules) instead of playbooks.
4. The must-read list is so long that the agent reads none of it.
5. The inline pack exceeds the MCP response limit or the host context budget.
6. A coding prompt ("fix the flaky test") triggers a marketing brief.
7. The user playbook folder is missing, huge, contains symlinks or binary files, or sits
   inside the product folder; the engine crashes, leaks, or reads outside it.
8. A path in the brief does not exist on disk in the installed layout (plugin cache, skills copy,
   staged operator with METHOD.md names).
9. The same prompt gives a different list on each run (non-deterministic ranking).

### Hooks

1. The prompt hook blocks or slows every prompt (it must finish well under the host timeout).
2. The prompt hook injects context into unrelated coding prompts.
3. The stop hook blocks forever (loop) or blocks when no brief was issued.
4. The stop hook misses reads done through Bash (`cat`, `sed`), MCP tools, or Codex exec calls.
5. The stop hook counts the injected hook text itself as a read.
6. Malformed or empty hook input crashes the hook and shows an error to the user.
7. Hooks cannot be turned off.
8. State files from one session leak into another session.

### Installer

1. A detected agent CLI exists but its plugin command fails; the installer reports success.
2. The installer changes a host's configuration without confirmation.
3. Reinstall or update duplicates the marketplace or plugin.
4. No terminal (CI, piped): the installer waits for input forever.
5. Node older than 24 gives a stack trace instead of a clear message.
