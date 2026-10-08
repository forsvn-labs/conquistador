# Versions

Product, plugin, host, and portable-agent manifests identify `0.4.0`. The first public alpha
was `0.2.0`. Each public release is tagged `vX.Y.Z` and published to npm as
`@forsvn/conquistador` by the release workflow (see CONTRIBUTING.md). Install it with
`npm install -g @forsvn/conquistador` or run it with `npx @forsvn/conquistador`.

The public alpha is `0.2.0`, not `0.1.0`, because the tag `v0.1.0` already names a private dogfood
release from 2026-09-15 (`dea03b3`). No historical tag moves. Public releases continue from
`0.2.x` on the `main` branch.

The private prereleases keep their tags and assets: `v0.0.5` to
[`v0.0.17`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.17) (from merged source
`e01306315e9c0f4656701bdcaf6b39468ab221b2`), and the older `v0.1.0`, `v0.1.0-dogfood.2`,
`v0.1.0-dogfood.3`, and `v0.1.0-dogfood.4`. None of them was published to npm. Check the tag,
source commit, and `SHA256SUMS` before you install from release assets. The local
`assembly.json` stays `UNBOUND`, and package verification is not host or human acceptance.

Each skill declares its own `metadata.version` in `skills/<name>/SKILL.md`. Internal module and
schema versions are independent of the product version. A 1.x or 2.x internal method version does
not mean that a public product release with that number occurred.

When changing a method, record its meaningful version change and behavior in source. Keep the
product version in package.json, plugin overlays, host/agent metadata, and matching schemas
consistent. Package records bind a clean Git commit and archive checksums. Local package identity
is UNBOUND and does not grant publication authority or human acceptance.
