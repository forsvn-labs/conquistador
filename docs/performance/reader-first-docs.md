# Lean context and reader-first documentation

Source assessment: 2026-11-06. This records source behavior and a proposed evaluation,
not a release, hosted deployment, or measured improvement in model output.

## Product direction

Keep Conquistador as a creative and strategy layer in the practitioner's existing agent.
Use one method library with progressive loading. A separate lite library would add a second
set of methods to maintain without addressing what the host actually reads.

The existing installation exposes one parent skill. The shared method policy selects short
entries for most commands; detailed methods remain available. Briefs bound included context
and defer resources. These controls are already present in `tools/stage-method-library.mjs`,
`tools/method-policy.mjs`, and `tools/brief.mjs`. Files stored on disk are not the same as text
loaded into a model. Host tool definitions, retrieved facts, tool results, and repeated reads
also contribute to context use.

The docs command was an exception: its routing metadata required three historical resources,
and its method instructed the host to load roles and references before delivery. This change
makes those resources optional and keeps ordinary documentation self-contained. It preserves
source checks, expected outcomes, recovery, and truthful verification statements.

## Reader-first docs

Use `/conquistador docs` and name the reader and task, for example:

> Write a guide for our marketing team explaining how contacts move from import to review.
> Use plain language and a Pele diagram. Explain what happens when an import fails.

The method now defaults to a non-technical product reader. It supports DevRel explanations
and technical references when requested. It prefers Pele rendering from editable Mermaid
source, includes a text explanation, and reports when rendering is unverified.
The full source/npm package now includes `tools/render-diagram.mjs` with pinned Pele 1.13.0.
Skill-only installations still need their host's renderer. Run from the package root:

```sh
node tools/render-diagram.mjs input.mmd output.svg
```

Keep the input alongside the SVG. Invalid input exits unsuccessfully; existing output files
are preserved. The helper disables active links and external images for documentation exports.
Pele API reference: https://pele.run/api (checked 2026-11-06).

## Next evidence to collect

Evaluate email edits, strategy briefs, product guides, and multi-stage campaigns against the
same tasks and facts. Record startup metadata, tool schemas, guidance bytes, retrieved facts,
repeat reads, completion, factual errors, and human usefulness separately. Compare output
quality before reducing further guidance. Byte budgets are not tokenizer-independent token
counts, and a package check cannot prove host context consumption.

For the user's Context Store integration, first identify its actual service and retrieval
contract. No named Context Store integration was found in the inspected docs and integration
methods. Do not describe that connection as verified. The desired behavior is task-scoped
retrieval of relevant facts with source and freshness information, bounded results, and reuse
of unchanged facts within the conversation. This remains proposed integration work.

## Repeatable checks

Run from the repository root:

```sh
node --test tools/docs-loading.test.mjs tools/thin-surfaces.test.mjs tools/search-index.test.mjs
node --test tools/routing-contract.test.mjs tools/context-selection.test.mjs tools/skills-mcp.test.mjs
```

These check routing and loading contracts. They do not replace a human evaluation of generated
guides or native-client and hosted-MCP acceptance.

## Implemented measurement harness

```sh
node tools/e2e/context-footprint.mjs
node --test tools/render-diagram.test.mjs tools/explicit-docs.test.mjs
```

The harness launches the local MCP server over stdio with an isolated working directory and
synthetic caller facts. It checks email, positioning, and docs in compact and full modes,
asserts route selection and complete tool-result byte ceilings, and writes `report.json` plus
raw `responses.json` under `dist/e2e/context-footprint/`. Startup fields measure the installed
entry template, tool definitions, and server instructions separately. Do not sum all fields:
text is already part of the tool result, which is already part of the RPC response.

The harness caught explicit docs being ranked after an inferred article. Explicit commands
now lead inferred matches after the existing access checks. Regression tests preserve this.
No new budget is imposed on external integrations based on these local-only results.

A local sample at `dist/e2e/diagrams/contact-review.svg` was rendered with Pele and visually
inspected using headless Chrome. Its source is synthetic, not verified product behavior.

The renderer package check is repeatable with `node tools/e2e/renderer-package.mjs`. It packs
the current tree, installs the tarball with Bun in a temporary directory, runs the installed
helper, and saves package integrity plus its verdict under `dist/e2e/renderer-package/`.
The installed-path test exposed and fixed a symlink entry-point issue.
