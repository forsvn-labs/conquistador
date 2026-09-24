# Vendored anti-slop source

The repository's `catalog/.oxlintrc.json` already registered this plugin and pinned
`oxlint` and `@oxlint/plugins` to 1.82.0. The plugin files were absent from the
v0.0.11 source. This change restores that registered path without changing the
rule list, severities, or local `no-runtime-typeof` option. Root development
dependencies use the same versions because a plugin imported from `tools/` must
resolve `@oxlint/plugins` from the repository root. The root `.oxlintrc.json`
registers the same generic rules for source JavaScript checks.

Source: the bundled `install-anti-slop` skill snapshot available on 2026-09-24.
The source repository and commit are unknown. The pristine bundle is identified
by SHA-256 `6a5e9b6e859ea6668a06dd49fc158056c36617d50685a49ac2394ea9ab2be340`
over its 38 files, sorted by relative path, each hashed as
`path + NUL + bytes + NUL`. The copied files matched that digest before this
provenance file was added. There was no prior vendored tree or recoverable base
in this repository.

The generic plugin is registered by the catalog and root configurations. The Effect rules
remain unregistered because no package manifest declares a direct `effect`
dependency. The nested `vendor/eslint-stylistic` license and provenance remain
with the copied source.
