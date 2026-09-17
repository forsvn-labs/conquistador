# Product progress

## Private-alpha 0.0.7 shipped

Private alpha 0.0.6 shipped from `40a9b7b3f635d17e9c0e79ec8b83884afcb10650` after its exact
Linux CI run passed. The release assets reproduced from committed source and their downloaded
checksums matched. A post-release test then exercised the README's advertised global private-Git
command rather than the previously tested tarball-backed persistent CLI.

npm 11.19.0 reported success for the original command but linked the installed package to its
temporary Git checkout. The resulting `conquistador` executable was dangling. Both GitHub shorthand
and `git+https` reproduced the failure from neutral projects and isolated prefixes. The missing
`--install-links` flag was a release-path defect; the `.conquistador` implementation and release
artifacts were intact.

The 0.0.7 release:

- makes `npm install -g --ignore-scripts --install-links git+https://...#v0.0.7` the primary command;
- explains why private-Git global installs need a durable copy and keeps `--ignore-scripts`;
- documents uninstall-then-reinstall recovery because npm could not replace an existing dangling
  v0.0.6 link in place;
- adds `verify:private-git`, an authenticated release check that installs from the actual Git tag in
  a neutral project and isolated prefix/cache, verifies the executable resolves inside the prefix,
  deletes acquisition cache, then runs version, install, doctor, start, update and uninstall;
- keeps the npx fallback explicit and leaves tarball acquisition as a separate verified path.

Observed verification on macOS ARM64, Node 24.21.0 and npm 11.19.0:

- The Node 24 build and all 693 tests passed after the version, completeness manifest, documentation,
  migration, and authenticated release-check changes.
- A fresh corrected v0.0.6 global Git install stayed executable after its acquisition cache was
  removed. It exposed `.conquistador/SKILL.md` and the Codex native skill, passed doctor with all 38
  methods, ran start/update/uninstall, and preserved the receiving project's sentinel file.
- Reinstalling directly over a dangling v0.0.6 link failed with npm `ENOTDIR`. Global uninstall then
  corrected reinstall repaired it; the same cache-deletion and lifecycle checks passed.
- `tools/verify-private-git-install.mjs` independently passed against both immutable v0.0.6 and
  v0.0.7 tags with cache removal before the lifecycle. Exact v0.0.7 source
  `e1bb066eaaab05022c12129ab2f06ba679b55ce8` passed Linux CI
  [run 35196396669](https://github.com/forsvn-labs/conquistador/actions/runs/35196396669).
- Freshly downloaded v0.0.7 assets matched their release checksums: ZIP
  `cb4fc7ebb334503d22c81f5c808c4d13ee30bd1524888ab1f7b8a717f59471f8` and npm tarball
  `383d5b2869ad84a681d7909a5ff568d1e6726c52daef957a456ef48d87250fc7`.
- The explicit npx fallback also launched version 0.0.6 from an empty cache. The durable global
  install remains recommended because repeated private-Git acquisition took about 16–27 seconds.

Astra's focused review recommended this bounded patch. It rejects postinstall or CLI self-repair as
the primary fix because a dangling executable cannot run its own diagnostic. Native-host expansion
and the optional GBrain learning backend remain separate work.

The final handoff audit found no executable change waiting to ship. It began from the release
shipping record `ebdd951`; the v0.0.7 tag remains `e1bb066e`, both release CI runs are green, and the
four downloaded assets match their recorded hashes. A fresh Node 24 build and all 693 tests passed.
Current branch changes after the tag are shipping, audit, and cleanup records only.

After an all-ref recovery bundle and separate archives for ignored Eve and operator artifacts, BB
destroyed nine stale linked worktree environments. Twelve stale local branch refs were removed.
The canonical checkout, `private-alpha`, historical `dogfood/0.1.0`, all tags, remote branches,
release assets, and thread evidence remain preserved.

## Private-alpha 0.0.6 implementation and release evidence

The 0.0.5 artifacts were shipped, but its default setup left users with an adapter folder,
no native skill entry, a long package command and unclear next steps. Its file-integrity checks
did not establish a usable first-task experience. The installation regression is recorded for
tracking; its live issue creation is pending confirmation.

Shipped privately in v0.0.6:

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

The following evidence-only commit updated this progress and the roadmap. Its separately packaged
archives have their own checksums; execution evidence above remains bound to `5d6d921`.
Native Claude/Cursor/Copilot and native Windows/Linux remain unverified. The source shipped
privately within those stated limits.

The 0.0.6 release did not close human acceptance of the previous BB team run.
