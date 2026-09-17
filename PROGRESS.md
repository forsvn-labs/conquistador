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

Node 24 build and all 692 tests passed. Fourteen focused ownership/migration/guide checks and
thirteen install/guide checks also passed. Clean exact-commit packaging, transport lifecycle,
native discovery, and measured acquisition/startup evidence are still being verified.
A real macOS terminal flow showed selection, confirmation, progress, checking and first-task
instructions; Ctrl-C cancellation made no writes. This is not a native-host task verdict.

`CHANGELOG.md` retains the shipped 0.0.5 record. Nothing in this entry publishes 0.0.6 or closes
human acceptance of the previous BB team run.
