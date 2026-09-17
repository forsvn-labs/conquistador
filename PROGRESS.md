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

Validation for implementation `9392be7` passed on macOS ARM64 with Node 24.21.0 and npm 11.19.0:

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
  returned a factual synthetic draft with a same-context review receipt. After removal, a
  separate fresh session reported the skill absent. This is one observed Codex task, not general
  method quality, another host's acceptance, or a human verdict.
- Exact-commit macOS terminal cancellation and installation passed. The first prompt appeared
  in 0.048–0.051 seconds; the automated three-confirmation install/check flow took 1.759 seconds.
- Cold v0.0.5 private Git npx acquisition plus help took 27.097 seconds. A cold local 0.0.6 tarball
  npx invocation took 2.991 seconds; these are different acquisition paths. The persistent CLI
  setup-help median was 0.039 seconds across seven local launches. The recommendation avoids
  repeated acquisition, not the initial network cost.

The exact ZIP and npm tarball contain the bundled TUI and no node_modules or esbuild binary.
The guide needs no npm bootstrap in source/ZIP installs. Packages remain local, UNBOUND and
unpublished. Final packaging and the small lifecycle/help follow-up are being verified.

`CHANGELOG.md` retains the shipped 0.0.5 record. Nothing in this entry publishes 0.0.6 or closes
human acceptance of the previous BB team run.
