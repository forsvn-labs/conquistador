# Product roadmap

## Next private-alpha acceptance

The [v0.0.12 private release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.12)
is shipped from `738d24268bee03e0bc8880d22b21b665951881c9`. Its six downloaded assets,
Node 24 build, 764 tests, and authenticated cold private-Git tag acquisition passed. The observed
CLI, operator and four native skills report 0.0.12 and 38 methods. Codex and Cursor copies have
intentional private edits and need preservation on update; Claude Code and Copilot copies are clean.
These are package and local installation checks, not native task or human acceptance.

1. Restore fresh Codex CLI execution on the exact released build, then observe native skill
   discovery, full method/resource reads, a useful first task and a correction. Even
   `codex --version` hung and exited without output in the release check, so no fresh
   v0.0.12 native task was observed. Seek the user's verdict on clarity, routing relevance and
   usefulness. Keep the installed route, negative-control, selected-project update,
   malformed-profile and MCP-read checks as separate local evidence.
2. Check update preservation for the modified Codex and Cursor copies before any automatic
   replacement. Observe fresh host behavior separately from clean receipts. A second native
   host and independent specialist contexts remain unverified.

## Private-alpha follow-up

1. Obtain the human verdict for the observed six-context BB run and record concrete task feedback.
   The run completed specialists, integration, exact-digest review, one correction and re-review.
   FOR-247 and FOR-248 retain their remaining acceptance scope until the required verdict exists.
2. Observe a host adapter calling request admission in project, manual and off modes. Check
   unrelated coding requests, removal and same-context fallback. Setup prepares files but does not
   register routing or start a watcher. Native automatic activation remains unverified.
3. Extend native parent-first discovery acceptance to fresh Claude, Copilot and Cursor sessions. Confirm
   one entry, selected-method loading, capability disclosure, cache refresh, update and removal.
   A fresh Codex CLI 0.154.0 launch task and correction on the 0.0.11 tree read the native parent,
   full selected method, required standards and relevant resources. That earlier observation does
   not establish v0.0.12 behavior, the other hosts, all methods, independent review or human acceptance.
4. Verify native Windows/Linux installation and host execution before claiming those platforms.
   macOS transports and Linux CI results do not certify native Windows or Linux host activation.

Use the [private-alpha checklist](docs/PRIVATE-ALPHA.md). Installed files, provider observations,
human acceptance and release authority remain separate evidence classes.

## Later product work

- Report live capability readiness with installed, permitted, connected, executable and verified
  states. Resolve project context with provenance, freshness, precedence and explicit conflicts.
- Add consent-bound project memory and retrieval. A review pass does not authorize persistence.
  Unify product context, voice, style, audience and channel contracts with clear overrides.
- Add method-specific quality evaluations that separate deterministic validity, model review,
  human verdict and observed outcomes. Do not imply quality coverage for all 38 methods.
- Verify Executor setup and task resumption with a separately authorized account operation.
  Observe permissions, cancellation and recovery. Discovery or login alone does not prove a task.
- Check local MCP repair after Node replacement and native Windows path and file-lock behavior.
  Exercise optional previews, Claude hooks and domain restrictions in the consuming host.
- Exercise requested Eve jobs with a named owner, selected model and budget, approval, cancellation
  and saved-state recovery. Keep optional dependency pins until upgrades are reviewed.

Public alpha is planned to start at `0.1.0`. The historical private tag already uses that name;
resolve its migration explicitly before the public release. See [version policy](VERSIONS.md).
Public distribution, registry publication, marketplaces, visibility changes and landing work need
that later decision. The current private-alpha channel continues the earlier dogfood sequence.

For the public-alpha release, publish the exact `@forsvn/conquistador` package to npm and make
`npm i -g @forsvn/conquistador` the primary installation command. Before changing the publication
guard, verify scope ownership, release authentication and provenance, package contents, license
files, and registry tarball identity. From an empty npm cache and user-writable global prefix, run
version, guided setup, doctor, start, update, and uninstall against the published version. Confirm
that the receiving project gets no manifest, dependency directory, or lockfile. Keep the private
Git and release-asset routes as documented fallbacks.
