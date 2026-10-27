# Thin methods across entry points

This change extends the decision in PR #108 to every default method loader.
Methods without a winning human blind test use their short entry. The detailed
files remain available for an explicit read or a future blind test.

## Inventory before implementation

| Entry point | Existing default | Required behavior |
| --- | --- | --- |
| CLI brief, hooks, and chat fallback | Briefs use short entries, but chat points at the procedure | Keep the same routes and budgets. Send chat fallback to the shared default document. |
| App corpus in `runtime/src/corpus.ts` | `COMMAND.md`, linked references, parent, and shared standards | Select by the existing route, then serve thin entries without shared process text. |
| Served steps in `runtime/src/skill-assets.ts` | `COMMAND.md` and its local reference graph | Use the entry for thin commands. Keep the complete byte inventory for package identity. |
| Standalone `skill:<name>` install | Rename `COMMAND.md` to the discoverable `SKILL.md` | Build the discoverable skill from canonical metadata and the short entry. Retain archived source bytes. |
| Specialist assignments and team coordinators | Role, command procedures, standards, and deferred resources. Composition reloads the parent. | Load thin role and method entries without deferred method pipelines. Reuse the declared entries during composition and correction. Preserve the explicit team protocol, tools, knowledge, and domain restrictions. |
| Resource planner | Procedure, shared standards, and optional references | Return only the entry for a thin command. |
| MCP method and file discovery | Advertise procedures and list all supporting files | Advertise thin entries. Keep explicit archive reads available. |
| Local, HTTP, and hosted MCP briefs | Shared briefing engine | Keep byte and route parity. The hosted Worker is not deployed by this work. |
| Parent skills, plugins, and operator packages | Transformed complete library with one discoverable parent | Preserve library byte parity and include the shared policy dependency. |
| Upload-only bot packs | Full command procedures and references, with mandatory process notes in every answer | Export thin entries alone. Put sales-page craft in a conditional file and keep the full flow method under the spec play. |
| Shared play steps | Video production, artifact hygiene, and share-card procedures | Use short entries for these untested marketing steps and retain their detailed files. |

## Scope and checks

`tools/method-policy.mjs` owns the method selection policy. Untested commands are
thin by default. A missing entry is an error and cannot restore the detailed
procedure. Copy loads its full method only for a sales page or sales letter.

The failure modes and repeatable checks are in `tools/thin-surfaces.test.mjs`.
The existing routing corpus checks command and play selection. Installed payload
tests check library byte parity, links, domain restrictions, and callable loaders.

Outbound, social, copy sales pages and letters, engineering commands, platform
utilities, factcheck, Vietnamese, and the spec play keep their existing methods.
The spec play retains the detailed flow method that it needs.
Kept plays retain only their declared method dependencies. Adding a kept play
cannot restore an unrelated thin command's detailed procedure.

Upload-only chat apps cannot remove already uploaded knowledge from a model's
context. Their pack labels sales-page and spec-flow sections as conditional.
Tests verify the exported bytes and instructions, not retrieval or compliance in
those external apps.

The three shared play steps belong to thin marketing plays. Their entries retain
truthful capture, file preservation, actual-output checks, and approval rules.
They do not add production records or process sections to the requested artifact.

These checks establish method loading and installed behavior. They do not
establish model quality, new human preferences, native host activation, a public
release, or a hosted deployment.

Run the regression checks from the repository root with Node 24 or later:

```sh
node --test tools/thin-surfaces.test.mjs
npm run build
npm test
node tools/e2e/routing-breadth.mjs
node tools/e2e/app-integration.mjs
```

The routing and app checks write repeatable reports under `dist/e2e/`.
