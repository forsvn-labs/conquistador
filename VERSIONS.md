# Versions

The product and plugin manifests identify as **0.1.0**, the existing product version. Operator changes and private-alpha preparation are unshipped; no new tag or version is assigned.
Local build and package records do not establish release approval or a previously shipped version.

Each skill declares its own `metadata.version` in `skills/<name>/SKILL.md`. Internal module and
schema versions are independent of the product version. A 1.x or 2.x internal method version does
not mean that a public product release with that number occurred.

When changing a method, record its meaningful version change and behavior in source. When changing
the public product version, keep package.json and plugin overlays consistent. Package records bind
the exact clean public Git commit and archive checksums. No private historical ledger is needed
for the public development commands, and local package identity never grants publication authority.
