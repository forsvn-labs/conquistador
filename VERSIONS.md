# Versions

Product, plugin, host, and portable-agent manifests identify this unshipped candidate as `0.0.7`.
Private alpha and dogfood are the same private delivery channel. The shipped sixth release is `0.0.6`; this prepares the seventh.
Future private releases increment the `0.0.x` version. The planned public alpha starts at `0.1.0`.
The live private source branch is `private-alpha`. npm publication stays disabled.

The four older private releases retain their original tags and bytes: `v0.1.0`,
`v0.1.0-dogfood.2`, `v0.1.0-dogfood.3`, and `v0.1.0-dogfood.4`.
The historical private `v0.1.0` tag already exists at `dea03b3`. The eventual public alpha needs an
explicit tag migration or a separate public release repository before it can reuse that exact
Git tag. This private release does not move or delete any historical tag.

Each skill declares its own `metadata.version` in `skills/<name>/SKILL.md`. Internal module and
schema versions are independent of the product version. A 1.x or 2.x internal method version does
not mean that a public product release with that number occurred.

When changing a method, record its meaningful version change and behavior in source. Keep the
product version in package.json, plugin overlays, host/agent metadata, and matching schemas
consistent. Package records bind a clean Git commit and archive checksums. Local package identity
is UNBOUND and does not grant publication authority or human acceptance.
