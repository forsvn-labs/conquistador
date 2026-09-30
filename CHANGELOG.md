# Changelog

`0.2.0` is the first public alpha. See [VERSIONS.md](VERSIONS.md) for independent product and method
versions. Verification establishes the stated local scope; native host behavior, useful model
output, human acceptance and rights disposition require separate evidence.

## 2026-09-30, 0.2.2 public alpha

- Released at [`v0.2.2`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.2.2) from
  merged `private-alpha` commit `b7ecaae0941f5645878062d6ffc88f27d3eacfc0` through
  [#27](https://github.com/forsvn-labs/conquistador/pull/27), and published as
  [`@forsvn/conquistador@0.2.2`](https://www.npmjs.com/package/@forsvn/conquistador) (`latest`)
  by [run 36670150227](https://github.com/forsvn-labs/conquistador/actions/runs/36670150227). The
  registry shasum `80f5524` matches the release tarball, and `npm audit signatures` verifies its
  signature and provenance attestation. From the registry, `conquistador update` moved a 0.2.1
  install in an isolated home to 0.2.2 for all five agents.
- **Windows: installs into Claude Code, Codex, and Copilot CLI work.** Before, `add` failed with
  `spawnSync claude ENOENT` for every agent installed through npm, because Node does not start
  `.cmd` files without a shell. The new `tools/spawn.mjs` starts them with exact arguments. It
  runs an npm shim's JavaScript file with Node and a shim's native `.exe` directly. It runs npm and
  npx through their CLI files, and escapes for `cmd.exe` only as the last resort.
- **Windows: the agent launch no longer uses an unquoted shell.** A task with spaces was split
  into words, and `&` or `|` in it ran as a command. `conquistador update` passed its npm prefix
  the same way.
- A broken link on PATH no longer counts as an installed agent.
- `npm run bootstrap` works on Windows.
- The optional Eve runtime (`hosts/eve/runtime`) overrides `undici` to 8.11.2 for two high-severity
  advisories (GHSA-rfgv-xxqx-mfg5, GHSA-w293-vg96-wgc3). `eve` 0.68.0 still pins 8.9.0.
- **Linux and Windows are verified.** `.github/workflows/install-e2e.yml` runs
  `tools/e2e/package-install.mjs` with real Claude Code, Codex, Cursor Agent, Copilot CLI, and
  Grok CLI: Linux 28 of 28 and Windows 25 of 25 in
  [run 36666136670](https://github.com/forsvn-labs/conquistador/actions/runs/36666136670), merged
  through [#26](https://github.com/forsvn-labs/conquistador/pull/26). On Windows, the three
  terminal checks (the interactive start flow) are not run. See Part 7 of
  `docs/REVIEW-2026-09-SURFACES.md`.
- Negative control: the same workflow on `v0.2.1`
  ([run 36668315408](https://github.com/forsvn-labs/conquistador/actions/runs/36668315408)) fails 5 checks on
  Windows (Claude Code, Codex, and Copilot CLI are not installed) and passes 28 of 28 on Linux.

## 2026-09-30, 0.2.1 public alpha

- Released at [`v0.2.1`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.2.1) from
  merged `private-alpha` commit `99d5b4360c30d99ffe64bfea097e51f56de568ec` through
  [#22](https://github.com/forsvn-labs/conquistador/pull/22), and published as
  [`@forsvn/conquistador@0.2.1`](https://www.npmjs.com/package/@forsvn/conquistador) (`latest`)
  by [run 36605964414](https://github.com/forsvn-labs/conquistador/actions/runs/36605964414).
  The registry shasum `3c56d17` matches the release tarball, and `npm audit signatures` verifies
  its SLSA provenance attestation.
- The first release run failed before any registry call: npm read `release/NAME.tgz` as a GitHub
  `owner/repo` name. [#23](https://github.com/forsvn-labs/conquistador/pull/23) passes a `./` path.
- Verified from the registry: a clean install reports `0.2.1`, and `conquistador update` moves a
  0.2.0 install in an isolated home to 0.2.1 for all five agents.
- First release published to npm from CI: the release workflow published the tarball from the
  GitHub release through trusted publishing, with provenance. The package now requires 2FA
  and disallows tokens, so only `publish.yml` can publish it.
- New `INDEX.md` maps the repository. `AGENTS.md` asks agents to read it and the four horsemen
  first. `PROGRESS.md` now holds only unshipped work; shipped evidence is in this file.
- The September unit-test prune audit moved to an appendix of
  `docs/REVIEW-2026-09-SURFACES.md`.

## 2026-09-30, release tooling: npm trusted publishing

- `@forsvn/conquistador` now publishes from GitHub Actions through npm trusted publishing (OIDC),
  with provenance. No npm token or 2FA prompt is needed.
  [`.github/workflows/publish.yml`](.github/workflows/publish.yml) runs when a GitHub release is
  published, or by hand with a tag. It publishes the exact release tarball, after it checks
  `SHA256SUMS`, the package name, the version against the tag, the absence of a `private` flag,
  and that `assembly.json` names the tagged commit. A prerelease goes to the `next` dist-tag.
  Merged through [#21](https://github.com/forsvn-labs/conquistador/pull/21) at `32ce03e`.
  npm trust configuration `1e104256` binds the package to `forsvn-labs/conquistador` and
  `publish.yml`.
- Verified by [run 36601983859](https://github.com/forsvn-labs/conquistador/actions/runs/36601983859)
  against `v0.2.0`: the tarball checks passed, and the npm OIDC token exchange returned HTTP 201.
  0.2.0 was already on npm, so nothing was published. The release steps are in CONTRIBUTING.

## 2026-09-29, 0.2.0 public alpha

- Released at [`v0.2.0`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.2.0) from
  merged `private-alpha` commit `a60d5e28f2177e7bfa4c566c2bf94c6b4bc30eef` through
  [#20](https://github.com/forsvn-labs/conquistador/pull/20), and published to npm as
  [`@forsvn/conquistador@0.2.0`](https://www.npmjs.com/package/@forsvn/conquistador) (`latest`).
  The registry shasum `60aafb4` matches the release tarball, whose SHA-256 matches `SHA256SUMS`.
  A clean `npm install -g` and `npx @forsvn/conquistador@latest` both report `0.2.0`.
- **Public npm package.** Install with `npm install -g @forsvn/conquistador`, or run once with
  `npx @forsvn/conquistador`. No Git access or install flags are needed.
- The repository is public. The Claude Code marketplace route and the "report it" link in error
  messages now work for everyone. Old branches were deleted first; `private-alpha` stays.
- Version 0.2.0, not 0.1.0: the tag `v0.1.0` already names a private dogfood release.
- **`conquistador update` gets the latest version.** It asks the npm registry you use for
  `@forsvn/conquistador@latest`. A newer version installs the same way as the running copy, into
  the same npm prefix or through `npx`, and then registers itself with every agent. With no newer
  version, no registry answer, or a source checkout, it registers the installed version again.
  It never downgrades. When npm cannot install, it shows npm's error and the retry command, and
  the installed version stays.
- `tools/e2e/update-latest.mjs` tests this against a local Verdaccio registry with two packed
  versions and five real agents: 21 of 21. The same E2E on `b560488` (before the change) fails
  10 checks. `npm test` 764 of 764. `tools/e2e/package-install.mjs` 28 of 28.

## 2026-09-29, 0.0.17 private alpha

- Seventeenth private prerelease at
  [`v0.0.17`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.17) from merged
  `private-alpha` commit `e01306315e9c0f4656701bdcaf6b39468ab221b2` through
  [#18](https://github.com/forsvn-labs/conquistador/pull/18). The downloaded assets match
  `SHA256SUMS`.

- **Fix: installs from npm gave every agent an empty plugin.** 0.0.16 skipped every file when the
  package lived under `node_modules`, which is always true after `npm install -g` or `npx`. Cursor
  then stopped the run with `ENOENT … conquistador.tmp-PID/.conquistador-owned.json`. The copy now
  filters paths inside the package only.
- The installer checks the new plugin copy for ten required files before any agent sees it, and
  keeps the last good copy when the package is damaged.
- One agent's failure no longer stops the others. The start flow reports it with a retry command
  and still opens a working agent.
- A bare `conquistador` repairs a missing or damaged plugin copy, and removes staging folders
  that a crashed run left behind.
- An unexpected error prints one line, a log file under `~/.conquistador/logs/`, and where to
  report it. `CONQUISTADOR_DEBUG=1` prints the stack trace.
- After `npx`, the next step is `/conquistador` in the agent. Paths in messages use `~/`.
- `tools/e2e/package-install.mjs` replaces `install-lifecycle.mjs`. It installs the package from
  Git with npm and from a tarball with `npx`, as users do, and runs `agent-first.exp` against the
  installed binary. Verified: 28 of 28 with five real agents, `npm test` 764 of 764, routing
  breadth 119 of 119. The same E2E fails on `v0.0.16`.

## 2026-09-28, 0.0.16 private alpha

- Sixteenth private prerelease at
  [`v0.0.16`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.16) from exact merged
  `private-alpha` commit `a833d92041a94497fce20c73466fd476bd1dcab5` through
  [#16](https://github.com/forsvn-labs/conquistador/pull/16). The repository remains private, and
  no npm registry package was published.
- **Agent-first start.** Bare `conquistador` installs into every agent it finds (no question),
  asks what to work on, and opens the agent with the task typed in. Claude Code gets the task in
  its input box through `--prefill` (from 2.1.283; `CONQUISTADOR_PREFILL=off` sends it instead).
  Codex, Cursor Agent, Copilot CLI, and Grok CLI start the task at once. With several agents it
  asks once which to open and remembers the choice.
- The prompt tells the agent to learn the product from the folder; outside a project it asks for
  the product first. Routing ignores these sentences, so they cannot change the selected method.
- `conquistador "TASK"`, `--in AGENT`, and `--no-open`. Without a terminal it prints the command.
  `remove AGENT` keeps that agent out of later bare runs.
- The picker replaces the interactive tour; `conquistador tour [AREA]` prints the areas.
- `tools/e2e/agent-first.exp` replaces `tour.exp` and `installer.exp`.
- Six assets: source ZIP, npm tarball, portable skill ZIP, portable plugin ZIP, `SHA256SUMS`, and
  `assembly.json` (`UNBOUND`, no live execution or human verdict). Verified: `npm test` 764 of 764
  and CI on Node 24 and 26, agent-first E2E 14 of 14 (real Claude Code 2.1.283 and Codex 0.157.1,
  no model call), routing breadth 119 of 119, install lifecycle for five agents, package and
  downloaded-asset checksums, and installs from the tarball and the Git tag reporting `0.0.16`.

## 2026-09-28, 0.0.15 private alpha

- Fifteenth private prerelease at
  [`v0.0.15`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.15) from exact merged
  `private-alpha` commit `07112aeb0e18b0b3995fce2a4680b5c2fa52f4a9` through
  [#14](https://github.com/forsvn-labs/conquistador/pull/14). The repository remains private, and
  no npm registry package was published.
- **Plugin-first install.** The repository root is one plugin for Claude Code, Codex, Cursor,
  Copilot CLI, Grok CLI, and the Agent Plugins format: 39 skills, a playbook MCP server, and hooks.
  Bare `conquistador` finds agents, asks one question, and installs with each agent's own plugin
  manager from a stable copy in `~/.conquistador/plugin`. Node 24 or later.
- **Enforced playbook reads.** A briefing engine ranks the must-read playbooks per task;
  `conquistador_brief` returns them inline; the prompt hook adds the reading list and the stop
  hook sends the agent back once when it skipped them; every method starts with a generated
  playbook map; answers end with **Playbooks applied**. `conquistador playbooks add DIR` ranks the
  user's own playbooks first, read in place.
- **General-purpose scope.** 236 router aliases and platform rules route strategy, launches,
  social, search and AI answers, paid ads, email and PR, in-product growth, content, and
  measurement on any platform. Coding prompts stay silent. `conquistador tour` shows nine areas and
  turns a first task into a ready prompt; `/conquistador` with no task shows the same map.
- **Minimal CLI.** Default help lists install, tour, update, and remove; `help --all` lists the
  rest. The per-project flow and the MCP prompt default to a marketing and growth plan.
- Other surfaces: `conquistador mcp --http` for connector apps and `conquistador bot` for chat-app
  knowledge packs. The previous per-project installer moves to `conquistador project`.
- Six assets: source ZIP, npm tarball, portable skill ZIP, portable plugin ZIP, `SHA256SUMS`, and
  `assembly.json` (`UNBOUND`, no live execution or human verdict). Verified: `npm test` 764 of 764
  and CI on Node 24 and 26, routing breadth 109 of 109, install lifecycle for five agents,
  installer and tour terminal E2Es, package checksums, and installs from the tarball and the Git
  tag reporting `0.0.15`. Live headless Claude Code runs read 100% of must-read playbooks on
  launch and non-launch tasks (small samples).

## 2026-09-25, 0.0.14 private alpha

- Fourteenth private prerelease at
  [`v0.0.14`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.14) from exact merged
  `private-alpha` commit `cd34526e790e73042ed974dee27096dcb4e08538`. The repository
  remains private, and no npm registry package was published.
- The interactive bare command offers recovery for edited operator or recorded native skill files.
  Explicit re-setup makes a named backup before replacing owned files and keeps unrelated project
  files. Noninteractive commands still refuse modified or unowned files.
- The release has six assets: source ZIP, npm tarball, portable skill ZIP, portable plugin ZIP,
  `SHA256SUMS`, and `assembly.json`. The assembly is `UNBOUND` and records no live execution or
  human verdict. On the exact source commit, Node 24 bootstrap, build, full tests, package checksum
  verification, and 26 installed-package PTY onboarding scenarios passed.

## 2026-09-25, 0.0.13 private alpha

- Thirteenth private prerelease at
  [`v0.0.13`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.13) from exact merged
  `private-alpha` commit `653058ac2b9c5f0cefe926bb238879191caf8a9b` through
  [the release PR](https://github.com/forsvn-labs/conquistador/pull/10). The repository stayed
  private and npm registry publication stayed disabled.
- Ships the interactive Node 24 preflight and bare-command project, host, plan, apply, local doctor,
  and first-task guide, with explicit optional routes, ownership protection, and process-group
  termination during local setup.
- Node 24.21.0 build and 764 local checks passed (240 host/tooling, 294 runtime, 167 catalog,
  63 evaluation). All six assets were downloaded fresh. Four archives passed downloaded
  `SHA256SUMS`; the checksum file and `assembly.json` matched the local assembly bytes. Source ZIP
  SHA-256: `60cdd178fa1f9670edbc9acd33a9233192e678a4db05d3891190c5d818636884`;
  npm tarball: `3e02791b9a2ca9deee606c68c5d8dc67615208b0c7cf94fcfbed2be782d0c883`;
  prepared skill: `e1d31aab6abc246114a033b69de2f088f9a42d823afefe5c7511b87fe31a5eb6`;
  prepared plugin: `6b1f9f914cf0ab8b98f3189ac818a292e574422ee6f09e15bc10f939a1dfe2ed`.
  Local assembly remains `UNBOUND`.
- Authenticated private-Git tag acquisition passed version, install, 38-method doctor, start,
  update, uninstall, and receiving-project preservation after npm cache removal. Both npm-owned
  CLI copies and the home operator/four native skills report 0.0.13. A real login-shell bare command
  under Node 26 continued through verified Node 24 to local setup, doctor, and handoff in a
  disposable project; installed-package suites passed 21 scenarios with each CLI.
- Codex and Cursor keep private edits; their receipts remain modified and home operator doctor
  exits 1 for receipt integrity despite matching packaged completeness. Clean Claude Code and
  Copilot native doctors pass. Fresh host discovery, model method reads, useful task output,
  provider access, and the user's verdict remain unverified.

## 2026-09-24, 0.0.12 private alpha

- Twelfth private release at
  [`v0.0.12`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.12) from
  `738d24268bee03e0bc8880d22b21b665951881c9`, merged through
  [the release PR](https://github.com/forsvn-labs/conquistador/pull/8). The prior
  [v0.0.11 release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.11)
  remains a fallback. The repository stayed private and npm publication stayed off.
- Ships the reviewed growth-diagnosis routing and first-task chooser, cross-project handoff
  repairs, compound-intent and negation guards, technical false-positive guards, and managed
  MCP parent reads. The hardening review's product commit
  `855acdf618e6fd85548dbcc94496cdf53374a951` passed four review checks.
- Node 24 build and all 764 local tests passed. Six downloaded release assets matched the
  exact local assembly bytes. The annotated tag resolves to the merge commit. Authenticated
  cold private-Git acquisition from that tag passed the install lifecycle. These checks
  establish package and local behavior, not native host task quality.
- The `/opt/homebrew` CLI and observed operator plus four native skill copies report 0.0.12
  and 38 methods. Codex and Cursor retain a three-line private FORSVN instruction; their
  receipts intentionally report modified, so automatic updates require preservation. Claude
  Code and Copilot copies are clean. Fresh Codex native execution was unavailable because
  even `codex --version` hung and exited without output. No human usefulness verdict exists.
  Native-host execution and human acceptance remain open.

## 2026-09-18, 0.0.11 private alpha

- Eleventh private release at
  [`v0.0.11`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.11) from
  `3e9f07be8e825b0057225f1172745a2c21bd535e` on `private-alpha` through
  [PR #6](https://github.com/forsvn-labs/conquistador/pull/6). The release tree equals reviewed
  candidate `7e9cd2a7559cba2bf99601813470b2ddc29a0d6e`.
- Keeps one complete project operator and one selected native parent as the default. A shared
  routing/resource contract now drives conservative selection, progressive context and installed
  graph diagnostics. All 38 methods load bounded required context; conditional resources remain
  explicit and retrievable. Ambiguous requests return control to the parent, feedback requires
  opt-in, social announcements select social writing, and account setup stays with the parent.
- Adds project lifecycle defaults, read-only route explanations, installed-library hook commands,
  durable hook ownership and separate registration, routing, trust and observation diagnostics.
  Optional private knowledge resolves through an explicitly scoped external index. Prepared skill
  and plugin archives expose one parent and disclose their different adapter/schema capabilities.
- Node 24.21.0 build and all 763 checks passed locally: 239 host/tooling, 294 runtime, 167 catalog,
  and 63 evaluation checks. Exact-source Linux
  [run 35323945278](https://github.com/forsvn-labs/conquistador/actions/runs/35323945278)
  passed, including maintained runtime output. Both optional integration jobs passed on the
  identical candidate tree in
  [run 35323178867](https://github.com/forsvn-labs/conquistador/actions/runs/35323178867).
- All 38 methods passed bounded loading in source, operator and plugin packages. Compact skill
  resources also passed for all 38 methods; the largest required load was 52,737 bytes against the
  unchanged 196,608-byte limit. Compact skills deliberately omit the BB executor and schemas.
- A fresh Codex CLI 0.154.0 task read the installed parent, required standards, full campaign method
  and relevant resources before producing a synthetic launch draft. A correction changed audience
  and weekly capacity, preserved facts and gaps, and retained truthful same-context review. An
  earlier observation skipped the method body; it prompted the explicit read gate verified by this
  fresh run. These observations are not independent specialist review or human acceptance.
- Fresh downloads matched all six release files byte for byte. Artifact SHA-256 values:
  source ZIP `88687506af5f3e9427cf0563c4cdb29b6b409ef4697c306aefe1db0fb9394379`;
  npm tarball `8a5d9c7f44bab9185bd67deef487f88c5d8df040fa79b963f4454f893dc192a9`;
  prepared skill `38cff9b5c9c55c2a92fe4eec3d19d60adfa2ceb925fa5e86ef9f70e1afe8fa57`;
  prepared plugin `5ecc6842a04abd471a6499a4f8582d07b74fb30eb73592909ad4b682e5e9c534`.
- Source, ZIP, tarball and authenticated private-Git installs produced identical operator/native
  payload digests, passed graph diagnostics and preserved receiving-project files through the
  install/start/update/uninstall lifecycle. Both npm acquisition paths survived cache deletion.
  The default created no project manifest, dependency tree, lockfile, hook or service.
- Repository privacy, the remote branch/tag and prerelease status were verified. No registry
  package was published. CodeRabbit Free remained summary-only/pending with no actionable findings
  in its rechecked PR comment or inline comments; it is not counted as independent review. Other
  native hosts, plugin/MCP activation and human acceptance remain unverified.

## 2026-09-18, 0.0.10 private alpha

- Tenth private release at
  [`v0.0.10`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.10) from
  `6cb5f51518039f541a804064777d5817c4c70296` on `private-alpha` through
  [PR #5](https://github.com/forsvn-labs/conquistador/pull/5).
- Replaces the first-run architecture checklist with one complete project installation. Plain
  `conquistador` resolves one host and asks for one confirmation when the choice is clear.
  `--bot`, `--skills`, `--plugin`, and `--mcp` select one integration family;
  `--advanced` retains the combination guide.
- Makes manager ownership, adoption, duplicate discovery, dry-run preflight, recovery folders,
  Hermes trust, Grok Bot limitations, and plugin/MCP activation boundaries explicit. The default
  path finishes with one host-specific next step and one starter prompt.
- Node 24.21.0 build and all 751 checks passed locally: 227 host/tooling, 294 runtime, 167 catalog,
  and 63 evaluation. Exact-source Linux
  [run 35313351430](https://github.com/forsvn-labs/conquistador/actions/runs/35313351430)
  passed with both optional integration jobs.
- Fresh release downloads matched the clean source assembly. ZIP
  `c1398de2948ed43294182bb1c37433ddec918e1ad00172268b86653135bcfe2e`
  and npm tarball
  `1b20ae3f04a2737eee75395bab3d15c2bc883777022ed0e6bdd6d03e430ed10f`
  passed their 38-method install, doctor, and uninstall lifecycles. The authenticated private-Git
  path also passed after deleting npm's acquisition cache.
- npm registry publication remains disabled. Native Hermes trust/discovery, private Grok Bot
  import, native Windows/Linux host behavior, plugin/MCP host registration, and human first-task
  usefulness remain unverified.

## 2026-09-18, 0.0.9 private alpha

- Ninth private release at
  [`v0.0.9`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.9) from
  `60d487476fa504f3473ba3a1429228ca569219d8` on `private-alpha` through
  [PR #4](https://github.com/forsvn-labs/conquistador/pull/4).
- Adds a bounded deterministic selector that routes ordinary requests against the methods actually
  installed and can suggest up to three methods, one workflow, one role, and contained resources.
- Adds opt-in Codex and Claude Code `UserPromptSubmit` hooks while preserving unrelated host
  settings, domain restrictions, operator-off state, and explicit external-action authority.
- Node 24 build and 711 product checks passed locally and on exact-source Linux
  [run 35305874820](https://github.com/forsvn-labs/conquistador/actions/runs/35305874820). Both
  optional integration legs passed; the Eve fixture now uses a portable real temp directory.
- Downloaded release ZIP
  `f699c43734c40c4039a92bbc217fc50c87f64535f2928b0f88c038febf37868c` and npm tarball
  `0e51a4f654bbeb3acfe861d074b2f0c89b14720c0d50865c2fbdc8593a96a299` matched the clean source
  assembly. The authenticated private-Git cache-removal lifecycle passed with all 38 methods and
  preserved the receiving project.
- npm registry publication remains disabled. Claude Code activation, native Windows activation,
  broad routing quality, and human acceptance remain unverified.

## 2026-09-17, 0.0.8 private alpha

- Eighth private release at
  [`v0.0.8`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.8) from
  `5e31b7c0f87a22018db50b8f52a1df454534bd06` on `private-alpha`.
- Replaces exclusive setup routes with compatible multi-selection, including several native host
  skills, plugins, connectors, packages and experimental guidance in one reviewed plan.
- Separates Codex native discovery from BB operator/team execution. BB no longer appears as a Codex
  alias or claims a native skill, plugin registration or automatic router.
- Adds shared ownership for multiple operator-native skills, operator/harness contract reuse,
  shared staged plugin sources, read-only preflight, protected additive updates and truthful
  partial-install recovery instructions.
- Node 24 build and 703 tests passed locally. Exact source passed Linux CI in
  [run 35210717495](https://github.com/forsvn-labs/conquistador/actions/runs/35210717495).
- Downloaded release ZIP
  `b265144852bea4d30910316a3f21e683c919c07ba6724164e28c67758eb64087` and npm tarball
  `4939bf42ed9341470182c9c7771dc6dde75f3e9abe4e4918a14b342d96c76240` matched the clean source
  assembly. Both artifact lifecycles and the authenticated private-Git cache-removal lifecycle
  passed while preserving receiving-project files.
- npm registry publication remains disabled. Native host activation and Cursor duplicate-name
  precedence across compatible skill directories remain acceptance work.

## 2026-09-17, 0.0.7 private alpha

- Seventh private release at
  [`v0.0.7`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.7) from
  `e1bb066eaaab05022c12129ab2f06ba679b55ce8` on `private-alpha`.
- Corrects the persistent private-Git command with npm `--install-links`. npm 11 could otherwise
  report success while leaving the global executable linked to a temporary acquisition checkout.
- Documents uninstall then corrected reinstall for affected v0.0.6 global entries. Existing project
  `.conquistador/` and native skill copies remain available for ordinary update.
- Adds an authenticated private-Git release check using a neutral project and isolated prefix/cache.
  It verifies the executable resolves inside the durable prefix, deletes acquisition cache, then
  runs version, install, 38-method doctor, start, update, removal, and project preservation.
- Node 24 build and all 693 tests passed locally. Exact Linux CI passed at
  [run 35196396669](https://github.com/forsvn-labs/conquistador/actions/runs/35196396669). The
  immutable v0.0.7 tag passed the new cache-deletion lifecycle.
- Downloaded release ZIP `cb4fc7ebb334503d22c81f5c808c4d13ee30bd1524888ab1f7b8a717f59471f8`
  and npm tarball `383d5b2869ad84a681d7909a5ff568d1e6726c52daef957a456ef48d87250fc7`
  matched the exact committed-source artifacts.
- Final Astra handoff found no executable work waiting to ship. A fresh Node 24 build and all 693
  tests passed. After verified ref and ignored-artifact archives, nine stale BB worktrees and twelve
  stale local branches were retired while canonical and historical release refs were preserved.

## 2026-09-17, 0.0.6 private alpha

- Sixth private release at
  [`v0.0.6`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.6) from
  `40a9b7b3f635d17e9c0e79ec8b83884afcb10650` on `private-alpha`.
- Moved the complete operator to visible `.conquistador/`, added a root `SKILL.md`, and installed a
  native project skill for the selected Codex/BB, Claude Code, Cursor, or Copilot host. The complete
  package retains all 38 methods, resources, profile, contracts, schemas, and BB adapter.
- Added the bundled terminal guide, bare setup command, `start`, `skills`, paired lifecycle,
  protected updates, v0.0.5 migration, and `.conquistador-runs/` default for new runtime state.
- Node 24 build and 692 tests passed locally. Five transports passed 45 lifecycle commands. Fresh
  Codex 0.154.0 discovered the skill by name and a later fresh session no longer saw it after
  removal. Exact Linux CI passed at [run 35194277976](https://github.com/forsvn-labs/conquistador/actions/runs/35194277976).
- ZIP `59d0a91947c5a8787f82f5a072984b4bed9bb951629ae3b751b6e27aea5f8530` and npm tarball
  `3ed31f6770ca7691a28acdeb2468c101f8d442e61a50bfb9950c70ad6347d893` reproduced from source and
  matched their downloaded release assets.
- Post-release verification found that the README's global private-Git command omitted npm
  `--install-links`. npm 11 could leave a dangling executable despite reporting success. The release
  page now shows the corrected command; v0.0.7 carries the source documentation, recovery steps,
  regression check, and versioned fix without rewriting this tag.

## 2026-09-17, 0.0.5 private alpha

- Fifth private release, continuing the dogfood sequence at
  [`v0.0.5`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.5) from
  `1010e865378302aa7da5ad062b957444979f47cf` on `private-alpha`.
  Product, plugin, host, agent and MCP versions now agree on `0.0.5`. Historical tags retain
  their bytes. Public alpha remains planned for `0.1.0`; see the historical tag conflict in VERSIONS.
- Ships the complete project operator with manual activation, one discoverable parent and 38
  internal methods. Guided setup, owned update/removal, portable schemas, the BB adapter and
  local doctor share the same installation path. Parent method version is `2.9.1`.
- Makes pinned private Git through npm the default install. Verified npm/Bun tarballs, source and
  ZIP remain equivalent complete transports. Local MCP owns its server/library copy and survives
  removal of the acquisition cache. Installation starts no service, hook or watcher.
- Ships visible engagement briefs, public specialist titles, exact-digest review, one bounded
  correction and execution receipts. A real BB run completed six separate Codex contexts through
  correction and re-review. The final draft passed provider review; human acceptance is pending.
  A fresh manual file invocation also selected the copy method and disclosed same-context review.
- Corrects content-learning consent and evidence claims. A cycle decision, durable promotion and
  persistence permission are separate. Critic PASS grants no write authority; content-intelligence
  runtime behavior remains locally implemented and fixture-verified.
- Fixed hook CLI input on Linux subprocess sockets. Complete input now has a one-second deadline;
  malformed, oversized and unclosed streams return no advice. Linux container hook tests cover
  fragmented input and a producer that leaves stdin open. Native Claude hook delivery is unverified.
- Node 24.21.0 build, all 682 default tests and 66 focused checks passed. The release is scoped to
  manual macOS use and the observed BB execution. Automatic request admission, native host/plugin
  activation and native Windows/Linux execution remain unverified. Private shipment does not
  close the remaining human acceptance issues.
- The private prerelease carries fresh ZIP, npm tarball, SHA256SUMS and exact-commit assembly.json.
  The assembly remains an UNBOUND local packaging record. GitHub publication is recorded separately;
  neither the assembly nor provider draft review establishes human acceptance.
- Final source, ZIP, npm tarball, Bun tarball and immutable private-Git installation lifecycles all
  passed with matching managed digest `8c97f61f182ebacacc73da50ccac95837fe6d9feda9ae5b75f6feb9705316763`.
  All receiving projects were empty after removal. The final ZIP completed a six-context BB run
  through correction and passing re-review. [Linux CI passed](https://github.com/forsvn-labs/conquistador/actions/runs/35181792784).

## 0.1.0-dogfood.4 private prerelease

- Shipped private GitHub prerelease
  [`v0.1.0-dogfood.4`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.1.0-dogfood.4)
  from `45a3d27` on `dogfood/0.1.0`, with ZIP, npm tarball, checksums and unbound assembly record.
- Kept the pinned root skills.sh command as the single default, with prerequisites, installation
  traps, a first task, payload locations, and recovery together. Distinguished inventory from host
  activation and the compact managed payload from plugin/harness BB adapter files.
- Rewrote the product introduction, usage, dogfood checklist, integration guide, execution modes,
  and capability descriptions around a real task. Start with supplied context and permitted
  connections; add Executor when missing live access blocks the work, then resume. Kept plugins,
  MCP, CLI repair, Eve, and runtime setup after the first task or in linked advanced guidance.
- Added `release/completeness.json` and read-only `conquistador setup doctor --path ABS [--json]`.
  The doctor checks method identity, receipts, Git identity where available, and managed MCP
  executable paths separately from connector digests. Local file readiness is not host activation
  or provider proof.
- Node 24.21.0 build and all 620 default tests passed on the implementation branch, including
  doctor/manifest regression tests. Catalog validation and the synthetic local example also passed.
  No native host or live provider check was run for this ship.
- npm publication remains disabled. Original `v0.1.0` through `v0.1.0-dogfood.3` tags are unchanged.

## 0.1.0-dogfood.3 private prerelease

- Shipped private GitHub prerelease
  [`v0.1.0-dogfood.3`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.1.0-dogfood.3)
  from `5261038` on `dogfood/0.1.0`, with ZIP, npm tarball, checksums and unbound assembly record.
- Updated the parent method to 2.8.0. Core mission is elite growth, GTM, sales, marketing, and
  product knowledge work. When a task needs live accounts, the parent helps a new user install
  Executor, connect MCP, add only the needed sources, and continue.
- Added `conquistador connections setup` and `status`. They inspect the official CLI and print
  documented next steps. They do not themselves install a package or start a service.
- Added [connect accounts](skills/conquistador/methods/connect-accounts.md) with official Executor
  CLI and Cloud install commands from executor.sh docs.
- This private branch also carries the previously unreleased master-agent execution and
  Executor/Eve adoption work.
- Node 24.21.0 build and all 606 default tests passed, plus 27 Executor host tests. Native host
  activation and live provider/model jobs were not exercised.
- npm publication remains disabled. Original `v0.1.0` and `v0.1.0-dogfood.2` tags are unchanged.

## Executor and Eve adoption, included in dogfood.3

- Updated the parent method to 2.7.0. It guides missing account access through a secure host or
  Executor interface and uses one parent for explicitly requested durable work.
- Added lazy `connections`, `jobs`, and `integrations` commands in the complete distribution.
  Ordinary skill installation starts no service and adds no model or provider credentials.
- Added a private Executor MCP client with configuration drafts, operator UI handoff, bounded
  discovery, and a host-only callback for an exact GitHub repository metadata binding. It uses
  the existing catalog authority path; arbitrary provider dispatch remains unavailable.
- Added an optional Eve app using canonical skills and explicit owner/session commands. Worker and
  operator access are separate. Provider tools require approval through the configured Executor
  route. Credential rotation invalidates the previous gateway binding in both adapters.
- Added exact upstream pins, Bun lockfiles, a read-only npm release checker, daily release-watch CI,
  and optional installed-package/security checks. Updates require review and do not expand grants.
- Documented credential custody, service ownership, update policy, and the distinction between
  local package checks and live account evidence. This stage did not activate remote services.
- Bound Eve access credentials to a trusted configured origin. Missing or mismatched destinations
  fail before credential transmission; origin migration requires explicit configuration and rotation.
- Passed Node 24.21.0 build and all 606 default tests, plus 22 Executor and 13 Eve source tests,
  prepared-app checks, frozen installs, native builds, and clean dependency audits. Actual local
  Executor discovery and Eve HTTP authentication checks passed without provider calls or model jobs.
  Eve 0.55.0 and Executor 1.6.8 matched current npm releases. Toolchain major updates remain flagged
  for review. Live account, model, approval, and crash-recovery acceptance remain outstanding.

## Master-agent execution, included in dogfood.3

- Restored the unchanged v1 agent schema and explicit legacy package. The master package now
  declares v2 with a finite dispatch ceiling.
- Added callable BB child-thread dispatch, contained method/agent loading, dependency ordering,
  cancellation, parent integration, exact-digest review and explicit same-context fallback.
- Added host-owned stack route selection through extension manifests, connection references and
  Gateway. Reads enforce operation, identity, data and budget limits; Executor-only policy cannot
  select another transport. Added one exact GitHub metadata mapping and fixed HTTP Date conversion.
- Added creative production/review, search with separate DR/SaaS pages, and money-event diagnosis
  graphs using the existing durable runner. Step-specific completion criteria now reach the sealed
  judgment request. Missing model/data/vision access remains pending or an explicit handoff.
- Added focused package import guards and private-fingerprint checks with synthetic tests.
- Observed a BB team with a substantive revision finding and a later four-context run that passed
  draft review, plus a same-context fallback and successful bounded Executor metadata reads.
  None grants human acceptance or provider support.

- Passed the Node 24.12.0 build and all 595 default tests: 74 tooling, 291 runtime, 167 catalog
  and 63 Eval Lab, plus the 17-operation catalog check and synthetic local example.

## Master-agent contracts, included in dogfood.3

- Updated `/conquistador` to assemble a host-bounded specialist team for multi-part requests and use
  a sequential fallback when the host cannot create isolated contexts.
- Added seven GTM specialist assignment contracts for ads, copy, direct-response landing pages, SaaS
  landing pages, data diagnosis, campaign data, and creative assets. They compose the existing 38
  outcomes and 21 workflows.
- Added an existing-stack setup method for CLI, MCP, warehouse, and operator-supplied Executor access.
  It preserves human control over authentication, spend, and external writes.
- Added execution-mode documentation to every compact installation and updated the portable master
  agent contract. The fixed advisor/worker package remains separate.
- Passed the Node 24 build and all 544 default tests: 43 tooling, 278 runtime, 160 catalog and 63
  Eval Lab. The 17-operation catalog check and synthetic local contract example also passed.

## 0.1.0-dogfood.2 private prerelease

- Shipped private GitHub prerelease
  [`v0.1.0-dogfood.2`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.1.0-dogfood.2)
  from `0ae8df0` on `dogfood/0.1.0`, with ZIP, npm tarball, checksums and unbound assembly record.
- Made direct skills, remote host plugins and local stdio MCP the default install paths, with a
  clone as fallback. Each route includes removal instructions.
- Default `conquistador mcp` serves bundled methods through the host model and tools without an
  HTTP service or API key; explicit `--url` keeps the optional runtime bridge.
- Node 24 build and 544 tests passed, plus direct private skills/npm Git install checks, local MCP
  protocol/read/refusal checks, exact archive checks and Linux CI. Native host activation and live
  model/provider behavior were not exercised.
- npm publication remains disabled. Original `v0.1.0` tag and assets are unchanged.

## 0.1.0 direct installation

- Made skills.sh and remote host plugins direct installation options, with a clone as a fallback.
- Added default local MCP over stdio for bundled method access without a runtime service or API key.
- Kept `mcp --url` for the existing runtime bridge and made no-URL connector setup local by default.
- Added private Git npm launchers and paired removal instructions. Preserved the npm private guard.

## 0.1.0 guided setup follow-up

- Added one guided setup command and matching local install, status, update and uninstall actions.
- Made the complete coding-agent skill the default, with optional plugin, MCP and harness choices.
- Separated local package preparation from host activation and preserved user data during removal.
- Shortened the quick start and moved platform commands and manual procedures into separate guides.
- Kept the private release's frozen artifacts unchanged; this follow-up belongs to current source.

## 0.1.0 private packaging integration

- Clarified product value, installation choices, first requests, review and private dogfood use.
- Included the usage guide and its linked preview, learning and proactive guides in each staged
  install. Kept complete-distribution commands separate from staged usage. Added checks for local
  Markdown link containment and refusal to replace or remove edited usage guides.
- Added `dogfood/0.1.0` to push checks while retaining `main` and read-only CI permissions.
- Updated product status for exact committed-source packaging. Preserved the npm publication guard,
  product 0.1.0, parent 2.4.3 and the separate identity of earlier artifacts.

## 0.1.0, private dogfood

- Added the npm publication guard, removed the public publish default and added DOGFOOD guidance.
  Deferred public distribution, public feedback sending and landing work.
- Bundled all 38 outcome methods behind `/conquistador`, including explicit engineering routing.
  Parent 2.4.3 prepares routine prerequisites through the host.
- Added a complete root skills.sh entry, Claude/Codex marketplace metadata, Agent Plugins
  validation and one native Claude agent. Removed unintended native discovery of squad prose.
- Added persistent install/upgrade/remove with edited-tree protection. Repaired contained method
  paths for single-agent and squad packages and restricted the advisor to review work.
- Added Lavish AXI preview/annotation guidance with pinned cached Bun/npm launchers and command
  telemetry opt-out. Kept preview feedback, private memory and public disclosure separate.
- Removed automatic run-completion learning writes that ignored memory-off and treated content
  acceptance as learning consent. Preserved existing data, run artifacts and explicit state APIs.
- Added opt-in static host-event advice without network calls, automatic hook registration or a
  background scheduler.
- Added self-contained bootstrap/build/test commands, read-only CI and local ZIP/npm packaging
  from a clean Git commit. Local package records remain unbound and unpublished.
- Added the compiled Node 24 runtime, supported playbook chat, narrow MCP, owned artifact reads,
  separate HTTP review/action authority and a host-injected typed operation bridge. Durable
  dispatch intent prevents automatic replay of uncertain operations.
- Added typed catalog contracts and Eval SDK examples using explicit synthetic fixtures.
- Added opt-in feedback drafting with redaction, exact public payload consent and manual fallback.
- Replaced source-derived methods with original procedures and removed private narratives and
  historical evidence from the distribution. Preserved applicable licenses and notices.
- Added a contained Conquistador mascot shared by the plugin composer icon and logo.

## Final helper corrections, included in dogfood.3

- Removed Claude TaskCompleted context-advice registration. SessionStart and Stop retain the
  documented context feedback contract. Owned legacy registrations can still be removed.
- Suppressed hook advice on malformed, partial, oversized, mismatched or recursive input. Hook
  errors now exit 1 with a fixed diagnostic so they cannot block work or reveal config content.
- Corrected mode status for configurations with no enabled registered event.
- Clarified that compact domain skill copies need host enforcement; automatic load checks belong
  to the callable coordinator. Native delivery and Executor documentation verification remain open.

That review passed validation on Node 24.19.0: build and all 599 default tests, with 78 tooling,
291 runtime, 167 catalog and 63 Eval Lab tests. The catalog check validates 17 operations and
the synthetic local example passes. A focused scan checked 1,530 tracked product files against
four private fingerprints with no matches. These checks do not establish native hook delivery.
