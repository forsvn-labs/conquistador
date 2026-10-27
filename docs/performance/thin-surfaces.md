# Thin methods across entry points

This change extends the decision in PR #108 to every default method loader.
Methods without a winning human blind test use their short entry. The detailed
files remain available for an explicit read or a future blind test.

## Inventory before implementation

| Entry point | Existing default | Required behavior |
| --- | --- | --- |
| CLI brief and hooks | Selected `ENTRY.md` files for thin requests | Keep the same routes, entries, and budgets. |
| App corpus in `runtime/src/corpus.ts` | `COMMAND.md`, linked references, parent, and shared standards | Select by the existing route, then serve thin entries without shared process text. |
| Served steps in `runtime/src/skill-assets.ts` | `COMMAND.md` and its local reference graph | Use the entry for thin commands. Keep the complete byte inventory for package identity. |
| Standalone `skill:<name>` install | Rename `COMMAND.md` to the discoverable `SKILL.md` | Build the discoverable skill from canonical metadata and the short entry. Retain archived source bytes. |
| Specialist assignments | Role, command procedures, standards, and deferred resources | Load thin role and method entries without deferred pipelines. Preserve declared tools, knowledge, and domain restrictions. |
| Resource planner | Procedure, shared standards, and optional references | Return only the entry for a thin command. |
| MCP method and file discovery | Advertise procedures and list all supporting files | Advertise thin entries. Keep explicit archive reads available. |
| Local, HTTP, and hosted MCP briefs | Shared briefing engine | Keep byte and route parity. The hosted Worker is not deployed by this work. |
| Parent skills, plugins, and operator packages | Transformed complete library with one discoverable parent | Preserve library byte parity and include the shared policy dependency. |
| Shared play steps | Video production, artifact hygiene, and share-card procedures | Use short entries for these untested marketing steps and retain their detailed files. |

## Scope and checks

The failure modes and repeatable checks are in `tools/thin-surfaces.test.mjs`.
The existing routing corpus checks command and play selection. Installed payload
tests check library byte parity, links, domain restrictions, and callable loaders.

Outbound, social, copy sales pages and letters, engineering commands, platform
utilities, factcheck, Vietnamese, and the spec play keep their existing methods.
The spec play retains the detailed flow method that it needs.

The three shared play steps belong to thin marketing plays. Their entries retain
truthful capture, file preservation, actual-output checks, and approval rules.
They do not add production records or process sections to the requested artifact.

These checks establish method loading and installed behavior. They do not
establish model quality, new human preferences, native host activation, a public
release, or a hosted deployment.
