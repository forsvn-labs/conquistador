# Legacy name migration

Conquistador carries methods curated from earlier FORSVN skill homes. Predecessor history is
preserved in git and inventory records. This file is the public mapping. Current installs resolve
by exact canonical ID, entity kind, and exact path only.

## Forward path (documentation mapping only)

| Historical name/path | Current route |
|---|---|
| `meta-skills` | Absorbed external source/submodule (`79eaeef6`, `44231714`); methods now live as Conquistador outcome skills under `skills/skills/<outcome>/`, installed through the portable plugin |
| `forsvn-skills` → `forsvn` | Rename recorded at `72cec24f`; install the current plugin by its canonical `conquistador` identity |
| `forsvn-preview` → `conquistador-preview` | Unified at `f1209abc`; historical review runtime with no install alias |

## Reverse path (reversibility without mutation)

Pin the predecessor repository at the recorded commits (`79eaeef6`, `44231714`, `72cec24f`,
`f1209abc`) in Git history. Nothing in this repository mutates, renames, or re-publishes the
predecessor. Reversing means using the predecessor's own history, never an alias this product
provides.

## No runtime alias

No runtime alias is installed. This product ships no compatibility shim, and no historical spelling
resolves at install time.

## Private alpha 0.0.6 project layout

The operator root is `.conquistador`, with the parent skill visible as `SKILL.md`. Run
`conquistador operator update` from the receiving project to migrate an unchanged
`.conquistador-operator` copy and prepare the default Codex skill. The guide lets you select
Claude Code, Cursor, Copilot or files-only instead. Existing unchanged managed skills can join
this lifecycle; unowned, edited or differently restricted copies are preserved by refusal.

The operator and its configured native skill update and uninstall together. Keep artifacts outside
both owned folders. If both old and new roots exist, use an explicit `--path` after inspecting them.
Status and doctor can still read the legacy root. Explicit path updates retain that chosen path.

Older runtime data may already occupy `.conquistador/runs`. Installation does not overwrite it.
Keep using that explicit runtime path or move it yourself before choosing the new operator root.
New runtime commands default to `.conquistador-runs`. Existing unmanaged `.conquistador/runs`
remains the default when present so installed product files and run data have
separate lifecycles. No existing runs are moved, reinterpreted or deleted.

### Repair the v0.0.6 global Git launcher

The original v0.0.6 README omitted npm's `--install-links` option. npm 11 could report a successful
global Git install while leaving the executable linked to its temporary acquisition directory.
Remove that dangling package before installing v0.0.7 or later; npm cannot always replace the broken link in
place:

```sh
npm uninstall -g @forsvn/conquistador
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.9
conquistador version
```

This changes the global CLI only. Existing project `.conquistador/` and native skill copies remain
owned and can be updated afterward with `conquistador operator update`.
