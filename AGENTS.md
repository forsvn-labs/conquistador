# Conquistador contributor instructions

For a complete product checkout, use the instructions below. A portable-only plugin contains
skills and documentation; its host loads the skill contracts and does not run these development
commands.

This is the editable product source, kept private for private-alpha delivery. Read README.md, CONTRIBUTING.md, INSTALL.md, and the
relevant module README before changing behavior. Node 24 and npm are the supported local toolchain.

- Keep this repository private. Do not push, publish, change visibility or remove the npm private
  guard without the user's explicit authorization. Local commits and private packages are allowed.
- `skills/<outcome>/` owns an independently usable method. `skills/conquistador/` owns parent routing.
- `runtime/`, `catalog/`, and `evals/` own runner, typed tools, and evidence contracts.
- `hosts/` and `agents/` contain installation contracts; `tools/` contains local development helpers.
- Keep methods original and retain applicable MIT license and notices. Never add private knowledge,
  customer transcripts, credentials, internal decisions, or private workspace history to this repo.
- Select the relevant skill; do not load the whole library. Preserve explicit human authority for
  publication, spend, external actions, and feedback disclosure. Use Executor for authorized live calls.
- Do not turn synthetic fixtures, passing tests, or local package records into live/provider/human proof.
- Run `npm run build` and `npm test` after code changes. Use focused module tests while iterating.
  Keep maintained runtime/lib output in sync with source and commit it when source changes.
- `npm run package` creates local unbound artifacts from a clean exact Git commit. It does not
  publish, sign, grant approval, or complete release acceptance. No remote action is implicit.

Default tests and development commands are self-contained. `test:source` and historical
candidate-authority tools are maintainer interfaces for the separate private evidence workspace;
they are not public checkout prerequisites. Missing private authority must fail closed.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
