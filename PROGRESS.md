# Product progress

## Private-alpha 0.0.6 candidate

The 0.0.5 artifacts were shipped, but its default setup left users with an adapter folder,
no native skill entry, a long package command and unclear next steps. Its file-integrity checks
did not establish a usable first-task experience. The installation regression is recorded for
tracking; its live issue creation is pending confirmation.

Implemented locally, not released:

- The complete operator uses `.conquistador/SKILL.md` and `library/`. BB adapter, profile,
  contracts, schemas, all 38 methods and their resources remain available.
- Guided setup uses bundled Clack prompts with route/host choices, confirmation, progress and
  a concrete first task. The configured native skill is included in the owned project lifecycle.
- Bare `conquistador` opens setup. `start` repeats the first task; `skills` lists capabilities.
  The recommended persistent CLI acquires once, avoiding repeated Git resolution on launch.
- Paired operator/skill updates stage before replacement. Modified, unowned or linked content
  is refused. Existing unchanged managed skills can be explicitly adopted. Updates preserve
  domains; legacy `.conquistador-operator` migrates through the project update command.
- Existing runtime state is preserved. New run data uses `.conquistador-runs`; existing unmanaged
  `.conquistador/runs` stays the runtime default until deliberately moved.

Validation for final implementation `5d6d921` passed on macOS ARM64 with Node 24.21.0 and npm 11.19.0:

- Build and all 692 tests. Fourteen focused ownership/migration/guide checks and thirteen
  install/guide checks passed. A later lifecycle review added a low-level paired-install guard;
  its 19 focused tests and the repeated build plus complete 692-test suite passed.
- Five complete transports passed 45 startup/lifecycle commands with identical operator and
  native-skill digests. Source archive, ZIP, npm tarball, Bun tarball and a persistent npm CLI
  preserved the receiving project and removed both owned copies.
- Actual v0.0.5 plain and domain-restricted installations migrated. Modified legacy files were
  refused. Domain migration preserved the same restriction and omitted disallowed methods.
- Fresh native Codex CLI 0.154.0 discovered the installed skill in its available-skills list,
  invoked it by name without a supplied path, selected Write product or campaign copy, and
  returned a factual synthetic draft with a same-context review receipt. This passed on both
  `9392be7` and `5d6d921`; the final source's task took 95.19 seconds, including model work.
  After the first installation's removal, a separate fresh session reported the skill absent.
  Final-source removal also restored the receiving project. These are two observed Codex tasks,
  not general method quality, another host's acceptance, or a human verdict.
- Exact-commit macOS terminal cancellation and installation passed. The first prompt appeared
  in 0.047–0.056 seconds; the automated route/host/confirmation install/check flow took 1.827 seconds.
- Cold v0.0.5 private Git npx acquisition plus help took 27.097 seconds. A cold local 0.0.6 tarball
  npx invocation took 2.991 seconds; these are different acquisition paths. The persistent CLI
  setup-help median was 0.039 seconds across seven local launches. The recommendation avoids
  repeated acquisition, not the initial network cost.

All five final-source transports produced operator digest
`e6a80c81a6e5d68c7275c1c589441957af5de3a438d4c2c77747b308743b4ab0` and native-skill digest
`d3e418186861f58f5c54668a10826f66c7c9054534e96e67ffda7962475c6880`.
The exact ZIP and npm tarball contain the bundled TUI and no node_modules or esbuild binary.
The guide needs no npm bootstrap in source/ZIP installs. Packages remain local, UNBOUND and
unpublished. Build and suite commands were `npm run build` and `npm test` under Node 24;
exact packaging used `node tools/package.mjs` with an external evidence destination.

Final implementation `5d6d921` archive checksums:

- `conquistador-0.0.6.zip`: `d5959778f6ed77597d6dee29f4b861a6b8fa27b3ee3b269ed110ecda093401d6`.
- `forsvn-conquistador-0.0.6.tgz`: `6ac85688f7eee24eba29cd8ac39f0491a3c4807bf9b21e908d19b23f4670b690`.

The following evidence-only commit updates this progress and the roadmap. Its separately packaged
archives have their own checksums; execution evidence above remains bound to `5d6d921`.
Native Claude/Cursor/Copilot, native Windows/Linux, and acquisition of the future private Git tag
remain unverified. The candidate is ready for a private release decision within those stated limits.

`CHANGELOG.md` retains the shipped 0.0.5 record. Nothing in this entry publishes 0.0.6 or closes
human acceptance of the previous BB team run.
