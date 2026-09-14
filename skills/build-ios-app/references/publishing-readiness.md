# Distribution readiness checklist

Run this checklist against the real archive, App Store Connect record, and current official Apple
requirements. A source-only pass is never a distribution-readiness verdict.

## Build evidence

- compatible macOS/Xcode host, clean build/tests, archive validation, and warnings recorded;
- exact team, bundle identifier, version, build, scheme, device families, and deployment targets;
- capabilities, entitlements, privacy manifests, usage descriptions, dependencies, symbols, and
  export-compliance decisions inspected;
- signing identity and provisioning verified from actual archive evidence.

## Store evidence

- app record and processed build exist in the intended account;
- metadata, URLs, categories, privacy, age rating, content rights, review access, screenshots, and
  release mode are complete for the actual platform set;
- live App Store Connect validation has no unresolved blocker;
- current official rules were checked and dated.

## Authority

- exact upload, TestFlight, submission, pricing/availability, or release action is named;
- operator approval covers the exact account, app, build, payload, audience, and action;
- rollback or cancellation limits and post-action verification are understood.

Return ready, blocked, or unverified per cell. Do not collapse an untested cell into PASS.
