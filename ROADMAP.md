# Product roadmap

## Next private-alpha acceptance

1. Observe the plugin hooks in a real Codex session (after hook trust), Cursor, Copilot CLI, and
   Grok CLI. Only Claude Code sessions have been observed.
2. Repeat `node tools/e2e/knowledge-use.mjs` with more runs and more tasks after the plan limit
   resets, across all nine tour areas (`--set breadth`), and add a quality comparison (blind review
   of before and after answers), not only reads.
3. Seek Hung's verdict on a real task in his own agent: playbook relevance, clarity, and usefulness.
   Tune the briefing engine and the vault playbook threshold from those corrections.
4. Decide where to host the HTTP playbook server for Muse and other connector apps, then deploy it
   with a token and submit the Muse connector.

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
   not establish v0.0.13 behavior, the other hosts, all methods, independent review or human acceptance.
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
`npm i -g @forsvn/conquistador` the primary installation command. List the same plugin in the
Claude Code, Codex, Cursor, and Copilot marketplaces, the skills.sh directory, and the Muse
connector platform. Before changing the publication
guard, verify scope ownership, release authentication and provenance, package contents, license
files, and registry tarball identity. From an empty npm cache and user-writable global prefix, run
version, guided setup, doctor, start, update, and uninstall against the published version. Confirm
that the receiving project gets no manifest, dependency directory, or lockfile. Keep the private
Git and release-asset routes as documented fallbacks.
