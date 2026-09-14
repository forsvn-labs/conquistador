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
