# App Store production handoff

Use this reference only when the operator asks for App Store preparation or submission. It is
tool-agnostic and assumes no cloud builder, private pipeline, attempt database, or vendor CLI.

## Authority boundary

Source inspection can prepare a handoff; it cannot prove signing, upload, processing, review, or
release. Before giving consequential distribution advice, refresh the official Apple sources in
[`apple-platform-authority.md`](apple-platform-authority.md) and record the check date. If current
verification is unavailable, label volatile requirements unverified.

Creating identifiers, changing capabilities, using credentials, signing, uploading, submitting for
review, changing price or availability, and releasing an approved version require explicit approval
for the exact account, app, build, and action.

## Preparation sequence

1. Inspect the real Xcode project/workspace, target, scheme, deployment targets, bundle identifier,
   version/build numbers, device families, entitlements, privacy manifests, capabilities, and archive
   configuration.
2. Run the strongest available clean build, tests, and archive validation on a compatible macOS/Xcode
   host. Record commands, destination, results, warnings, and every untested cell.
3. Inspect the archive in Xcode Organizer or another Apple-supported, source-inspectable tool. Verify
   signing only from actual signing evidence.
4. Prepare listing metadata and real screenshots for the platforms the source actually supports.
   Check field limits, screenshot sets, privacy answers, age rating, export compliance, review notes,
   support/privacy URLs, category, content rights, and release mode against current App Store Connect.
5. Preflight the selected build and listing in App Store Connect without submitting. Resolve all
   validation errors and preserve the exact build identity.
6. Present one review packet: account/team, app and bundle identifier, version/build, archive evidence,
   metadata revision, screenshot set, privacy/export answers, release mode, blockers, and the exact
   requested mutation.
7. Upload or submit only after approval. Re-read the resulting App Store Connect state and report it;
   never infer success from a command starting.

## Stop conditions

- No macOS/Xcode/archive/signing environment: return a bounded handoff, not “App Store ready.”
- Missing or stale Apple authority: mark dependent advice unverified.
- Missing real screenshots or metadata: name the blocker; do not fabricate assets or answers.
- Ambiguous account, app, version, build, or release mode: stop before mutation.
- Unexpected App Store Connect state: preserve evidence and ask the operator to resolve the specific
  state; do not invent a force-resolve operation.

Metadata fields and platform requirements change. Prefer the live App Store Connect form and current
official documentation over copied schemas or remembered limits.
