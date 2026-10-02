# Sequential fallback — iOS app build

Use when the host cannot run implementers, reviewers, simulator/device runners, or Xcode tooling as
separate contexts. Keep the same method; change only the machinery. Label the result
**single-context implementation**, not independent verification. This fallback never creates a
nested repository without explicit consent and never claims a build that did not run.

## Order of work

1. **Inspect project and authority.** Read repository instructions, project/workspace settings,
   targets, schemes, deployment targets, dependencies, capabilities, tests, and dirty worktree state.
   Refresh the official Apple authority map
   ([apple platform authority](../references/apple-platform-authority.md)) before any volatile
   platform or distribution claim, recording source and check date. Never require or invoke an
   [opaque executable](../SKILL.md) such as the excluded historical `ios-cli`.
2. **Plan one vertical slice** with a stable ID, the flow it implements, affected surfaces, test
   plan, rollback, and human-owned prerequisites (certificates, devices, accounts).
3. **Implement the slice** in the project's established framework and architecture, covering states,
   permissions, accessibility, and recovery paths per the front door.
4. **Self-review pass.** Re-read the diff as a hostile reviewer: entitlement/Info.plist drift,
   force-unwraps on failure paths, missing Dynamic Type/VoiceOver support, secrets in code,
   opportunistic cleanup riding along.
5. **Verify what actually ran.** Execute every check available here (build, unit, UI, simulator)
   with recorded commands, destination, scheme, and results. Anything unavailable — Xcode, SDK,
   signing identity, device — is an **untested cell** named with its blocker. Source inspection alone
   supports "implemented", never "verified".
6. **Deliver or hand off at the release boundary:** implemented behavior or bounded handoff, changed
   files, verification evidence, privacy/capability review, risks, and the human-owned next step.

## Bootstrap gates

When bootstrapping a greenfield skeleton with [`../scripts/bootstrap.sh`](../scripts/bootstrap.sh):

- run `--dry-run` first and review the printed plan;
- give an absolute output path outside any existing git work tree;
- git initialization, staging, and commit happen **only** with explicit consent
  (`--git-consent yes` or `CONQUISTADOR_BOOTSTRAP_GIT_CONSENT=YES`) — default is no git actions;
- re-running against an already-bootstrapped output directory is a no-op success, not a rebuild.

## Stops

- **Missing input:** no usable Xcode project or archive → deliver a bounded handoff; do not invent a
  project structure for a real request.
- **Factual uncertainty:** volatile Apple rule cannot be confirmed against official sources → label
  it unverified and mark the dependent step blocked.
- **Credential stop:** signing identities, Apple accounts, device registrations are absent → those
  cells stay untested; never request or store credentials in chat.
- **External action:** creating identifiers, changing entitlements, joining programs, accepting fees,
  signing, registering devices, uploading builds, TestFlight distribution, and submission require
  explicit approval for the exact account and payload.
- **Critic failure:** unresolved self-review findings ship listed as open risks, not silently fixed.
- **Human verdict:** readiness claims end at the human who runs the untested cells; nothing here
  certifies App Store readiness.
